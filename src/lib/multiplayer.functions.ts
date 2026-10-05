import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { createInitialBoard } from "@/lib/games/checkers";
import { buildMemoryDeck, MEMORY_CATEGORIES } from "@/lib/games/memory-data";
import { memoryXp } from "@/lib/xp-rules";

const roomIdSchema = z.object({ roomId: z.string().uuid() });
const memoryOptionsSchema = z.object({
  category: z.enum(MEMORY_CATEGORIES.map((item) => item.id) as [string, ...string[]]),
  pairs: z.union([z.literal(6), z.literal(8), z.literal(10)]),
});

export const findCheckersMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { data: current, error: currentError } = await supabaseAdmin
      .from("checkers_rooms")
      .select("id, host_id, guest_id, status")
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .in("status", ["waiting", "playing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentError) throw new Error("Não foi possível procurar uma partida de damas.");

    if (current?.status === "playing") {
      return { roomId: current.id, status: "matched" as const };
    }
    if (current?.status === "waiting") {
      return { roomId: current.id, status: "waiting" as const };
    }

    const { data: waiting, error: waitingError } = await supabaseAdmin
      .from("checkers_rooms")
      .select("id")
      .eq("status", "waiting")
      .is("guest_id", null)
      .neq("host_id", userId)
      .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
      .order("created_at", { ascending: true })
      .limit(10);
    if (waitingError) throw new Error("Não foi possível procurar um adversário.");

    for (const room of waiting ?? []) {
      const { data: joined } = await supabaseAdmin
        .from("checkers_rooms")
        .update({
          guest_id: userId,
          status: "playing",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id)
        .eq("status", "waiting")
        .is("guest_id", null)
        .select("id")
        .maybeSingle();
      if (joined) return { roomId: joined.id, status: "matched" as const };
    }

    await supabaseAdmin
      .from("checkers_rooms")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("host_id", userId)
      .eq("status", "waiting");

    const { data: created, error: createError } = await supabaseAdmin
      .from("checkers_rooms")
      .insert({
        host_id: userId,
        board: createInitialBoard() as never,
        turn: "p",
        host_side: "p",
        status: "waiting",
      })
      .select("id")
      .single();
    if (createError || !created) throw new Error("Não foi possível criar a sala de damas.");
    return { roomId: created.id, status: "waiting" as const };
  });

export const cancelCheckersMatchmaking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roomIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("checkers_rooms")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.roomId)
      .eq("host_id", context.userId)
      .eq("status", "waiting");
    if (error) throw new Error("Não foi possível cancelar a procura de adversário.");
    return { ok: true };
  });

export const findMemoryMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => memoryOptionsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { data: current, error: currentError } = await supabaseAdmin
      .from("memory_rooms")
      .select("id, host_id, guest_id, status, category, pairs")
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .in("status", ["waiting", "playing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentError) throw new Error("Não foi possível procurar uma partida de memória.");

    if (current?.status === "playing") {
      return { roomId: current.id, status: "matched" as const };
    }
    if (
      current?.status === "waiting" &&
      current.category === data.category &&
      current.pairs === data.pairs
    ) {
      return { roomId: current.id, status: "waiting" as const };
    }
    if (current?.status === "waiting") {
      await supabaseAdmin
        .from("memory_rooms")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", current.id)
        .eq("host_id", userId)
        .eq("status", "waiting");
    }

    const { data: waiting, error: waitingError } = await supabaseAdmin
      .from("memory_rooms")
      .select("id")
      .eq("category", data.category)
      .eq("pairs", data.pairs)
      .eq("status", "waiting")
      .is("guest_id", null)
      .neq("host_id", userId)
      .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
      .order("created_at", { ascending: true })
      .limit(10);
    if (waitingError) throw new Error("Não foi possível procurar um adversário.");

    for (const room of waiting ?? []) {
      const { data: joined } = await supabaseAdmin
        .from("memory_rooms")
        .update({
          guest_id: userId,
          status: "playing",
          turn_user_id: userId,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id)
        .eq("status", "waiting")
        .is("guest_id", null)
        .select("id")
        .maybeSingle();
      if (joined) return { roomId: joined.id, status: "matched" as const };
    }

    await supabaseAdmin
      .from("memory_rooms")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("host_id", userId)
      .eq("status", "waiting");

    const deck = buildMemoryDeck(data.category, data.pairs);
    const { data: created, error: createError } = await supabaseAdmin
      .from("memory_rooms")
      .insert({
        host_id: userId,
        category: data.category,
        pairs: data.pairs,
        deck: deck as never,
      })
      .select("id")
      .single();
    if (createError || !created) throw new Error("Não foi possível criar a sala de memória.");
    return { roomId: created.id, status: "waiting" as const };
  });

export const cancelMemoryMatchmaking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roomIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("memory_rooms")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.roomId)
      .eq("host_id", context.userId)
      .eq("status", "waiting");
    if (error) throw new Error("Não foi possível cancelar a procura de adversário.");
    return { ok: true };
  });

export const leaveMemoryMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roomIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room, error } = await supabaseAdmin
      .from("memory_rooms")
      .select("*")
      .eq("id", data.roomId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a partida.");
    if (!room || (room.host_id !== context.userId && room.guest_id !== context.userId)) {
      throw new Error("Não estás nesta partida.");
    }
    if (room.status === "waiting") {
      const { error: cancelError } = await supabaseAdmin
        .from("memory_rooms")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", room.id)
        .eq("status", "waiting");
      if (cancelError) throw new Error("Não foi possível cancelar a sala.");
      return { ok: true };
    }
    if (room.status !== "playing" || !room.guest_id) return { ok: true };

    const winnerId = room.host_id === context.userId ? room.guest_id : room.host_id;
    const finishedAt = new Date();
    const { data: finished, error: finishError } = await supabaseAdmin
      .from("memory_rooms")
      .update({
        status: "finished",
        winner_id: winnerId,
        first_card_key: null,
        turn_available_at: null,
        finished_at: finishedAt.toISOString(),
        updated_at: finishedAt.toISOString(),
      })
      .eq("id", room.id)
      .eq("status", "playing")
      .select("id")
      .maybeSingle();
    if (finishError) throw new Error("Não foi possível terminar a partida.");
    if (!finished) return { ok: true };

    const durationMs = Math.max(
      0,
      finishedAt.getTime() - new Date(room.started_at ?? finishedAt).getTime(),
    );
    const players = [
      { userId: room.host_id, score: room.host_score, otherScore: room.guest_score },
      { userId: room.guest_id, score: room.guest_score, otherScore: room.host_score },
    ];
    const { recordSession } = await import("@/lib/match.server");
    for (const player of players) {
      const result = player.userId === winnerId ? "win" : "loss";
      const reward = memoryXp({
        pairsTotal: room.pairs,
        pairsFound: player.score,
        attempts: room.attempts,
        durationMs,
      });
      await recordSession({
        userId: player.userId,
        gameType: "memoria",
        clientToken: `memory-room-${room.id}`,
        score: reward.score,
        xp: reward.xp,
        durationMs,
        result,
        metadata: {
          mode: "online",
          roomId: room.id,
          category: room.category,
          pairsTotal: room.pairs,
          pairsFound: player.score,
          opponentPairs: player.otherScore,
          attempts: room.attempts,
          abandonedBy: context.userId,
        },
        countWin: result === "win",
      });
    }
    return { ok: true };
  });

export const getMemoryRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roomIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: room, error } = await context.supabase
      .from("memory_rooms")
      .select("*")
      .eq("id", data.roomId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a partida de memória.");
    if (!room || (room.host_id !== context.userId && room.guest_id !== context.userId)) {
      throw new Error("Partida de memória não encontrada.");
    }
    return { room, myId: context.userId };
  });

export const playMemoryCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    roomIdSchema.extend({ cardKey: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room, error } = await supabaseAdmin
      .from("memory_rooms")
      .select("*")
      .eq("id", data.roomId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a partida.");
    if (!room || (room.host_id !== context.userId && room.guest_id !== context.userId)) {
      throw new Error("Não estás nesta partida.");
    }
    if (room.status !== "playing") throw new Error("A partida não está a decorrer.");
    if (room.turn_user_id !== context.userId) throw new Error("Ainda não é a tua vez.");
    if (room.matched_keys.includes(data.cardKey)) throw new Error("Essa carta já foi encontrada.");

    const deck = room.deck as unknown as { key: string; value: string }[];
    const card = deck.find((entry) => entry.key === data.cardKey);
    if (!card) throw new Error("Carta inválida.");
    const now = new Date();
    const firstCardKey = room.first_card_key;
    const updatedAt = now.toISOString();

    if (!firstCardKey) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("memory_rooms")
        .update({
          first_card_key: data.cardKey,
          revealed_keys: [data.cardKey],
          updated_at: updatedAt,
        })
        .eq("id", room.id)
        .eq("status", "playing")
        .eq("turn_user_id", context.userId)
        .is("first_card_key", null)
        .select("id")
        .maybeSingle();
      if (updateError || !updated) throw new Error("A jogada já mudou; atualiza o tabuleiro.");
      return { ok: true };
    }

    if (firstCardKey === data.cardKey) throw new Error("Escolhe uma carta diferente.");
    if (room.turn_available_at && new Date(room.turn_available_at).getTime() > now.getTime()) {
      throw new Error("Espera um instante antes de virar a próxima carta.");
    }
    const firstCard = deck.find((entry) => entry.key === firstCardKey);
    if (!firstCard) throw new Error("A carta anterior da partida é inválida.");

    const isMatch = firstCard.value === card.value;
    const matchedKeys = isMatch
      ? [...new Set([...room.matched_keys, firstCard.key, card.key])]
      : room.matched_keys;
    const complete = matchedKeys.length === deck.length;
    const guestId = room.guest_id!;
    const hostScore = room.host_score + (isMatch && room.host_id === context.userId ? 1 : 0);
    const guestScore = room.guest_score + (isMatch && guestId === context.userId ? 1 : 0);
    const winnerId =
      !complete || hostScore === guestScore
        ? null
        : hostScore > guestScore
          ? room.host_id
          : guestId;
    const nextTurn = isMatch
      ? context.userId
      : context.userId === room.host_id
        ? guestId
        : room.host_id;
    const lockUntil = isMatch ? null : new Date(now.getTime() + 750).toISOString();
    const update = {
      attempts: room.attempts + 1,
      first_card_key: null,
      revealed_keys: isMatch ? matchedKeys : [firstCard.key, card.key],
      matched_keys: matchedKeys,
      host_score: hostScore,
      guest_score: guestScore,
      turn_user_id: nextTurn,
      turn_available_at: lockUntil,
      status: complete ? "finished" : "playing",
      winner_id: complete ? winnerId : null,
      finished_at: complete ? updatedAt : null,
      updated_at: updatedAt,
    };
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("memory_rooms")
      .update(update)
      .eq("id", room.id)
      .eq("status", "playing")
      .eq("turn_user_id", context.userId)
      .eq("first_card_key", firstCardKey)
      .select("id")
      .maybeSingle();
    if (updateError || !updated) throw new Error("A jogada já mudou; atualiza o tabuleiro.");

    if (complete) {
      const durationMs = Math.max(0, now.getTime() - new Date(room.started_at ?? now).getTime());
      const players = [
        { userId: room.host_id, score: hostScore, otherScore: guestScore },
        { userId: guestId, score: guestScore, otherScore: hostScore },
      ];
      const { recordSession } = await import("@/lib/match.server");
      for (const player of players) {
        const result =
          player.score === player.otherScore
            ? "draw"
            : player.score > player.otherScore
              ? "win"
              : "loss";
        const reward = memoryXp({
          pairsTotal: room.pairs,
          pairsFound: player.score,
          attempts: room.attempts + 1,
          durationMs,
        });
        await recordSession({
          userId: player.userId,
          gameType: "memoria",
          clientToken: `memory-room-${room.id}`,
          score: reward.score,
          xp: reward.xp,
          durationMs,
          result,
          metadata: {
            mode: "online",
            roomId: room.id,
            category: room.category,
            pairsTotal: room.pairs,
            pairsFound: player.score,
            opponentPairs: player.otherScore,
            attempts: room.attempts + 1,
          },
          countWin: result === "win",
        });
      }
    }

    return { ok: true, finished: complete };
  });
