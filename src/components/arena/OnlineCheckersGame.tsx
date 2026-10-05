import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { CheckersBoard } from "@/components/arena/CheckersBoard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getRoom, leaveRoom, playMove, type RoomRow } from "@/lib/online.functions";
import { legalSteps, opponent, type Board, type Player, type Pos } from "@/lib/games/checkers";

type Props = { roomId: string; onLeave: () => void };

function isPos(value: unknown): value is Pos {
  if (!value || typeof value !== "object") return false;
  const pos = value as { row?: unknown; col?: unknown };
  return (
    Number.isInteger(pos.row) &&
    Number.isInteger(pos.col) &&
    (pos.row as number) >= 0 &&
    (pos.row as number) < 8 &&
    (pos.col as number) >= 0 &&
    (pos.col as number) < 8
  );
}

function forcedCaptureFrom(room: RoomRow, board: Board, side: Player): Pos | null {
  if (!room.last_move || typeof room.last_move !== "object" || Array.isArray(room.last_move)) {
    return null;
  }
  const move = room.last_move as { [key: string]: unknown };
  const captures = move["captures"];
  const to = move["to"];
  if (!Array.isArray(captures) || captures.length === 0 || !isPos(to)) return null;
  if (board[to.row]?.[to.col]?.player !== side) return null;
  return legalSteps(board, side, to).some((step) => step.capture) ? to : null;
}

export function OnlineCheckersGame({ roomId, onLeave }: Props) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingMove, setPlayingMove] = useState(false);

  const refresh = useCallback(async () => {
    const current = await getRoom({ data: { roomId } });
    setRoom(current.room);
    setMyId(current.myId);
    setSelected(null);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const current = await getRoom({ data: { roomId } });
        if (!active) return;
        setRoom(current.room);
        setMyId(current.myId);
      } catch (error) {
        if (active)
          toast.error(error instanceof Error ? error.message : "Não foi possível carregar a sala.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const channel = supabase
      .channel(`checkers-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkers_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (active) {
            setRoom(
              (previous) =>
                ({
                  ...(previous ?? {}),
                  ...(payload.new as Partial<RoomRow>),
                }) as RoomRow,
            );
            setSelected(null);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function closeRoom() {
    try {
      await leaveRoom({ data: { roomId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sair da partida.");
    } finally {
      onLeave();
    }
  }

  if (loading || !room || !myId) {
    return <div className="arena-card p-6 text-center text-sm">A ligar à partida de damas…</div>;
  }

  const board = room.board as Board;
  const mySide: Player =
    room.host_id === myId
      ? room.host_side === "p"
        ? "black"
        : "white"
      : room.host_side === "p"
        ? "white"
        : "black";
  const currentSide: Player = room.turn === "p" ? "black" : "white";
  const myTurn = room.status === "playing" && currentSide === mySide;
  const chainFrom = myTurn ? forcedCaptureFrom(room, board, mySide) : null;
  const legal = myTurn ? legalSteps(board, mySide, chainFrom) : [];
  const targets = selected
    ? legal.filter((step) => step.from.row === selected.row && step.from.col === selected.col)
    : [];
  const winnerSide =
    room.winner_id === null
      ? null
      : room.winner_id === room.host_id
        ? room.host_side === "p"
          ? "black"
          : "white"
        : room.host_side === "p"
          ? "white"
          : "black";

  async function clickSquare(row: number, col: number) {
    if (!myTurn || playingMove) return;
    const target = targets.find((step) => step.to.row === row && step.to.col === col);
    if (target) {
      setPlayingMove(true);
      try {
        await playMove({ data: { roomId, from: target.from, to: target.to } });
        await refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Jogada não aceite.");
        await refresh();
      } finally {
        setPlayingMove(false);
      }
      return;
    }

    const piece = board[row]?.[col];
    if (
      piece?.player === mySide &&
      legal.some((step) => step.from.row === row && step.from.col === col)
    ) {
      setSelected({ row, col });
    } else if (!chainFrom) {
      setSelected(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="arena-card flex items-center justify-between gap-3 p-4 text-sm">
        <span>
          {room.status === "finished"
            ? winnerSide === null
              ? "Empate"
              : winnerSide === mySide
                ? "Ganhaste!"
                : "O adversário ganhou"
            : myTurn
              ? "A tua vez"
              : "À espera da jogada do adversário…"}
        </span>
        <span>{room.move_count} lances</span>
      </div>
      <CheckersBoard
        board={board}
        selected={selected}
        targets={targets}
        legal={legal}
        onSquare={(row, col) => void clickSquare(row, col)}
        mySide={mySide}
        flipped={mySide === "white"}
        disabled={!myTurn || playingMove}
      />
      <Button variant="outline" className="w-full" onClick={() => void closeRoom()}>
        {room.status === "playing" ? "Desistir da partida" : "Voltar aos jogos"}
      </Button>
    </section>
  );
}
