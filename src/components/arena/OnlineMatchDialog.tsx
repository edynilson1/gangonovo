import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cancelCheckersMatchmaking,
  cancelMemoryMatchmaking,
  findCheckersMatch,
  findMemoryMatch,
} from "@/lib/multiplayer.functions";

type Props = {
  game: "damas" | "memoria";
  memoryOptions?: { category: string; pairs: 6 | 8 | 10 };
  onMatched: (roomId: string) => void;
  onClose: () => void;
};

export function OnlineMatchDialog({ game, memoryOptions, onMatched, onClose }: Props) {
  const roomIdRef = useRef<string | null>(null);
  const finishedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const memoryCategory = memoryOptions?.category ?? "frutas";
  const memoryPairs = memoryOptions?.pairs ?? 6;

  useEffect(() => {
    let active = true;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const search = async () => {
      if (!active || running || finishedRef.current) return;
      running = true;
      try {
        const match =
          game === "damas"
            ? await findCheckersMatch()
            : await findMemoryMatch({
                data: { category: memoryCategory, pairs: memoryPairs },
              });
        if (!active) {
          if (match.status === "waiting") {
            try {
              if (game === "damas") {
                await cancelCheckersMatchmaking({ data: { roomId: match.roomId } });
              } else {
                await cancelMemoryMatchmaking({ data: { roomId: match.roomId } });
              }
            } catch (cause) {
              console.error("Falha ao cancelar uma sala criada após fechar a procura.", cause);
            }
          }
          return;
        }
        roomIdRef.current = match.roomId;
        setError(null);
        if (match.status === "matched") {
          finishedRef.current = true;
          onMatched(match.roomId);
          return;
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Não foi possível procurar jogador.");
        }
      } finally {
        running = false;
      }
      if (active && !finishedRef.current) timer = setTimeout(search, 1800);
    };

    void search();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [game, memoryCategory, memoryPairs, onMatched]);

  async function close() {
    finishedRef.current = true;
    if (roomIdRef.current) {
      try {
        if (game === "damas") {
          await cancelCheckersMatchmaking({ data: { roomId: roomIdRef.current } });
        } else {
          await cancelMemoryMatchmaking({ data: { roomId: roomIdRef.current } });
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Não foi possível fechar a procura.");
        finishedRef.current = false;
        return;
      }
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="online-match-title"
        className="arena-card relative w-full max-w-sm p-6 text-center"
      >
        <button
          type="button"
          aria-label="Fechar procura de jogador"
          onClick={() => void close()}
          className="absolute right-3 top-3 rounded-lg p-2 hover:bg-surface-2"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <h2 id="online-match-title" className="text-lg font-semibold">
          À espera de outro jogador
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A partida começa automaticamente quando alguém entrar.
        </p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button variant="outline" className="mt-5 w-full" onClick={() => void close()}>
          Cancelar e voltar ao jogo a solo
        </Button>
      </section>
    </div>
  );
}
