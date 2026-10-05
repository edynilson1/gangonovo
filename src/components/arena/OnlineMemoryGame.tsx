import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getMemoryRoom, leaveMemoryMatch, playMemoryCard } from "@/lib/multiplayer.functions";

type Room = Database["public"]["Tables"]["memory_rooms"]["Row"];
type Card = { key: string; value: string };
type Props = { roomId: string; onLeave: () => void };

export function OnlineMemoryGame({ roomId, onLeave }: Props) {
  const queryClient = useQueryClient();
  const [room, setRoom] = useState<Room | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingCard, setPlayingCard] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    const current = await getMemoryRoom({ data: { roomId } });
    setRoom(current.room);
    setMyId(current.myId);
    setLoading(false);
    if (current.room.status === "finished") {
      await queryClient.invalidateQueries({ queryKey: ["arena"] });
    }
  }, [queryClient, roomId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const current = await getMemoryRoom({ data: { roomId } });
        if (active) {
          setRoom(current.room);
          setMyId(current.myId);
        }
      } catch (error) {
        if (active)
          toast.error(error instanceof Error ? error.message : "Não foi possível carregar a sala.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();

    const channel = supabase
      .channel(`memory-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "memory_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (active) setRoom(payload.new as Room);
        },
      )
      .subscribe();
    const ticker = setInterval(() => setNow(Date.now()), 200);

    return () => {
      active = false;
      clearInterval(ticker);
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function chooseCard(cardKey: string) {
    if (!room || playingCard || room.turn_user_id !== myId || room.status !== "playing") return;
    setPlayingCard(true);
    try {
      await playMemoryCard({ data: { roomId, cardKey } });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registar a jogada.");
      await refresh();
    } finally {
      setPlayingCard(false);
    }
  }

  if (loading || !room || !myId) {
    return <div className="arena-card p-6 text-center text-sm">A ligar à partida de memória…</div>;
  }

  const deck = room.deck as unknown as Card[];
  const myTurn = room.turn_user_id === myId;
  const revealedKeys =
    room.turn_available_at && new Date(room.turn_available_at).getTime() <= now
      ? room.revealed_keys.filter((key) => room.matched_keys.includes(key))
      : room.revealed_keys;
  const winnerText =
    room.winner_id === null
      ? "Empate!"
      : room.winner_id === myId
        ? "Ganhaste!"
        : "O adversário ganhou";

  async function leave() {
    try {
      await leaveMemoryMatch({ data: { roomId } });
      onLeave();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sair da partida.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="arena-card flex items-center justify-between gap-3 p-4 text-sm">
        <span>
          {room.status === "finished"
            ? winnerText
            : myTurn
              ? "A tua vez de escolher duas cartas"
              : "À espera do adversário…"}
        </span>
        <span>
          {room.host_score} – {room.guest_score}
        </span>
      </div>

      <div className={`grid gap-2 ${room.pairs > 8 ? "grid-cols-5" : "grid-cols-4"}`}>
        {deck.map((card) => {
          const matched = room.matched_keys.includes(card.key);
          const open = matched || revealedKeys.includes(card.key);
          return (
            <button
              key={card.key}
              type="button"
              disabled={!myTurn || playingCard || matched || open || room.status !== "playing"}
              onClick={() => void chooseCard(card.key)}
              aria-label={open ? `Carta ${card.value}` : "Carta virada para baixo"}
              className={`aspect-square rounded-xl text-2xl transition-colors ${
                open ? "bg-surface-2 ring-2 ring-primary" : "arena-gradient"
              } ${matched ? "opacity-60" : ""} disabled:cursor-default`}
            >
              {open ? card.value : "?"}
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Acertaste num par? Continuas a jogar. Se falhares, passa a vez.
      </p>
      <Button variant="outline" className="w-full" onClick={() => void leave()}>
        {room.status === "playing" ? "Desistir da partida" : "Voltar aos jogos"}
      </Button>
    </section>
  );
}
