import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  applyStep,
  createInitialBoard,
  findLegalStep,
  gameStatus,
  isBoard,
  legalSteps,
  opponent,
  type Board,
  type Pos,
  type Player,
} from "@/lib/games/checkers";
import { checkersXp } from "@/lib/xp-rules";

type RoomSide = "p" | "a";

export type RoomPlayer = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
} | null;

export type RoomRow = {
  id: string;
  host_id: string;
  guest_id: string | null;
  status: "waiting" | "playing" | "finished" | "cancelled";
  board: Json;
  turn: RoomSide;
  host_side: RoomSide;
  move_count: number;
  idle_moves: number;
  captures_p: number;
  captures_a: number;
  last_move: Json | null;
  winner_id: string | null;
  outcome: "win" | "draw" | "abandon" | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  host: RoomPlayer;
  guest: RoomPlayer;
};

const ROOM_SELECT =
  "id, host_id, guest_id, status, board, turn, host_side, move_count, idle_moves, captures_p, captures_a, last_move, winner_id, outcome, started_at, finished_at, created_at, " +
  "host:profiles!checkers_rooms_host_id_fkey(id, username, display_name, avatar_url, country_code), " +
  "guest:profiles!checkers_rooms_guest_id_fkey(id, username, display_name, avatar_url, country_code)";

const posSchema = z.object({
  row: z.number().int().min(0).max(7),
  col: z.number().int().min(0).max(7),
});

function toPlayer(side: string): Player {
  if (side === "p") return "black";
  if (side === "a") return "white";
  throw new Error("Lado da partida inválido.");
}

function toRoomSide(player: Player): RoomSide {
  return player === "black" ? "p" : "a";
}

function boardFromJson(value: Json): Board {
  if (!isBoard(value)) throw new Error("O tabuleiro da partida é inválido.");
  return value;
}

function boardToJson(board: Board): Json {
  return board;
}

function chainedCaptureFrom(value: Json | null, board: Board, player: Player): Pos | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const previousMove = value as { [key: string]: Json | undefined };
  const destination = posSchema.safeParse(previousMove["to"]);
  const captures = previousMove["captures"];
  if (!destination.success || !Array.isArray(captures) || captures.length === 0) {
    return null;
  }

  const piece = board[destination.data.row]?.[destination.data.col];
  if (piece?.player !== player) return null;

  const availableSteps = legalSteps(board, player, destination.data);
  return availableSteps.some((step) => step.capture) ? destination.data : null;
}

/* --------------------------- PRESENÇA --------------------------- */

export const setPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ status: z.enum(["online", "in_game", "offline"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_presence").upsert({
      user_id: context.userId,
      status: data.status,
      last_seen_at: new Date().toISOString(),
    });
    if (error) throw new Error("Não foi possível atualizar o teu estado.");
    return { ok: true };
  });

/* ----------------------------- SALAS ---------------------------- */

export const listRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("checkers_rooms")
      .select(ROOM_SELECT)
      .in("status", ["waiting", "playing"])
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error("Não foi possível carregar as salas.");

    const rooms = (data ?? []) as unknown as RoomRow[];
    const mine =
      rooms.find((r) => r.host_id === context.userId || r.guest_id === context.userId) ?? null;

    const ids = [
      ...new Set(rooms.flatMap((r) => [r.host_id, r.guest_id].filter(Boolean) as string[])),
    ];
    const { data: presence } = ids.length
      ? await context.supabase
          .from("user_presence")
          .select("user_id, status, last_seen_at")
          .in("user_id", ids)
      : { data: [] as { user_id: string; status: string; last_seen_at: string }[] };

    return { rooms, myRoomId: mine?.id ?? null, presence: presence ?? [], myId: context.userId };
  });

export const getRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: room, error } = await context.supabase
      .from("checkers_rooms")
      .select(ROOM_SELECT)
      .eq("id", data.roomId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a sala.");
    if (!room) throw new Error("Sala não encontrada.");
    return { room: room as unknown as RoomRow, myId: context.userId };
  });

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Uma sala aberta por jogador: cancela salas antigas à espera.
    await supabaseAdmin
      .from("checkers_rooms")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("host_id", userId)
      .eq("status", "waiting");

    const { data: existing } = await supabaseAdmin
      .from("checkers_rooms")
      .select("id")
      .eq("status", "playing")
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .maybeSingle();
    if (existing) return { roomId: existing.id, resumed: true };

    const { data: room, error } = await supabaseAdmin
      .from("checkers_rooms")
      .insert({
        host_id: userId,
        board: boardToJson(createInitialBoard()) as never,
        turn: "p",
        host_side: "p",
        status: "waiting",
      })
      .select("id")
      .single();
    if (error || !room) throw new Error("Não foi possível criar a sala.");
    return { roomId: room.id, resumed: false };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: room } = await supabaseAdmin
      .from("checkers_rooms")
      .select("id, host_id, guest_id, status")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Sala não encontrada.");
    if (room.host_id === userId || room.guest_id === userId) return { roomId: room.id };
    if (room.status !== "waiting" || room.guest_id) throw new Error("Esta sala já está cheia.");

    // Atualização condicional: impede dois jogadores a entrar ao mesmo tempo.
    const { data: joined, error } = await supabaseAdmin
      .from("checkers_rooms")
      .update({
        guest_id: userId,
        status: "playing",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.roomId)
      .eq("status", "waiting")
      .is("guest_id", null)
      .select("id");
    if (error) throw new Error("Não foi possível entrar na sala.");
    if (!joined || joined.length === 0) throw new Error("Esta sala já está cheia.");
    return { roomId: data.roomId };
  });

/** Cancela uma sala à espera ou desiste de uma partida a decorrer. */
export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: room } = await supabaseAdmin
      .from("checkers_rooms")
      .select("*")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Sala não encontrada.");
    if (room.host_id !== userId && room.guest_id !== userId)
      throw new Error("Não estás nesta sala.");

    if (room.status === "waiting") {
      await supabaseAdmin
        .from("checkers_rooms")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", room.id);
      return { ok: true, finished: false };
    }

    if (room.status === "playing") {
      const winnerId = room.host_id === userId ? room.guest_id : room.host_id;
      await finishRoom(room, winnerId, "abandon");
      return { ok: true, finished: true };
    }
    return { ok: true, finished: true };
  });

/* ---------------------------- JOGADAS --------------------------- */

export const playMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ roomId: z.string().uuid(), from: posSchema, to: posSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: room } = await supabaseAdmin
      .from("checkers_rooms")
      .select("*")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Sala não encontrada.");
    if (room.status !== "playing") throw new Error("A partida não está a decorrer.");

    const hostSide = toPlayer(room.host_side);
    const mySide: Player | null =
      room.host_id === userId ? hostSide : room.guest_id === userId ? opponent(hostSide) : null;
    if (!mySide) throw new Error("Não estás nesta partida.");
    if (room.turn !== toRoomSide(mySide)) throw new Error("Não é a tua vez.");

    const board = boardFromJson(room.board);
    // Validação completa das regras no servidor: captura obrigatória incluída.
    const chainFrom = chainedCaptureFrom(room.last_move, board, mySide);
    const move = findLegalStep(board, mySide, data.from, data.to, chainFrom);
    if (!move) throw new Error("Jogada inválida.");

    const result = applyStep(board, move);
    const nextBoard = result.board;
    const nextTurn = result.continues ? mySide : opponent(mySide);

    const captures = move.capture ? 1 : 0;
    const idleMoves = move.capture ? 0 : room.idle_moves + 1;
    const updated = {
      board: nextBoard as never,
      turn: toRoomSide(nextTurn),
      move_count: room.move_count + 1,
      idle_moves: idleMoves,
      captures_p: toRoomSide(mySide) === "p" ? room.captures_p + captures : room.captures_p,
      captures_a: toRoomSide(mySide) === "a" ? room.captures_a + captures : room.captures_a,
      last_move: {
        from: move.from,
        to: move.to,
        captures: move.capture ? [move.capture] : [],
      } as never,
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("checkers_rooms").update(updated).eq("id", room.id);

    const status = gameStatus(nextBoard, nextTurn, idleMoves);
    const finished = status !== "playing";
    if (finished) {
      const winnerSide = status === "black_won" ? "black" : status === "white_won" ? "white" : null;
      const winnerId =
        winnerSide === null ? null : winnerSide === hostSide ? room.host_id : room.guest_id;
      await finishRoom({ ...room, ...updated }, winnerId, winnerSide === null ? "draw" : "win");
    }

    return { ok: true, finished };
  });

type RoomState = {
  id: string;
  host_id: string;
  guest_id: string | null;
  host_side: string;
  move_count: number;
  captures_p: number;
  captures_a: number;
  started_at: string | null;
};

/** Fecha a partida e atribui XP no servidor aos dois jogadores. */
async function finishRoom(
  room: RoomState,
  winnerId: string | null,
  outcome: "win" | "draw" | "abandon",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { recordSessionQuiet } = await import("@/lib/match.server");

  const finishedAt = new Date();
  await supabaseAdmin
    .from("checkers_rooms")
    .update({
      status: "finished",
      winner_id: winnerId,
      outcome,
      finished_at: finishedAt.toISOString(),
      updated_at: finishedAt.toISOString(),
    })
    .eq("id", room.id);

  const durationMs = room.started_at
    ? Math.max(0, finishedAt.getTime() - new Date(room.started_at).getTime())
    : 0;
  const hostSide = toPlayer(room.host_side);
  const participants = [room.host_id, room.guest_id].filter(Boolean) as string[];

  for (const playerId of participants) {
    const side: Player = playerId === room.host_id ? hostSide : opponent(hostSide);
    const result = winnerId === null ? "draw" : winnerId === playerId ? "win" : "loss";
    const perf = {
      result: result as "win" | "loss" | "draw",
      moves: room.move_count,
      durationMs,
      difficulty: "online" as const,
      capturedByPlayer: toRoomSide(side) === "p" ? room.captures_p : room.captures_a,
      capturedByAi: toRoomSide(side) === "p" ? room.captures_a : room.captures_p,
    };
    const { xp, score } = checkersXp(perf);
    await recordSessionQuiet({
      userId: playerId,
      gameType: "damas",
      clientToken: `room-${room.id}`,
      score,
      xp,
      durationMs,
      result,
      metadata: { ...perf, mode: "online", roomId: room.id, outcome },
      countWin: result === "win",
    });
  }
}

/* ------------------------------ CHAT ---------------------------- */

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("checkers_messages")
      .select("id, room_id, user_id, body, created_at")
      .eq("room_id", data.roomId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error("Não foi possível carregar o chat.");
    return { messages: rows ?? [] };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ roomId: z.string().uuid(), body: z.string().trim().min(1).max(280) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room } = await supabaseAdmin
      .from("checkers_rooms")
      .select("id, host_id, guest_id")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Sala não encontrada.");
    if (room.host_id !== context.userId && room.guest_id !== context.userId) {
      throw new Error("Não estás nesta sala.");
    }
    const { error } = await supabaseAdmin
      .from("checkers_messages")
      .insert({ room_id: data.roomId, user_id: context.userId, body: data.body });
    if (error) throw new Error("Não foi possível enviar a mensagem.");
    return { ok: true };
  });
