import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, RotateCcw, Timer, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BottomNav } from "@/components/arena/BottomNav";
import { OnlineMatchDialog } from "@/components/arena/OnlineMatchDialog";
import { OnlineMemoryGame } from "@/components/arena/OnlineMemoryGame";
import { useProfileGate } from "@/hooks/useProfileGate";
import { Button } from "@/components/ui/button";
import { submitMemoryResult } from "@/lib/arena.functions";
import {
  buildMemoryDeck,
  MEMORY_CATEGORIES,
  MEMORY_DIFFICULTIES,
  type MemoryCard,
} from "@/lib/games/memory-data";

export const Route = createFileRoute("/_authenticated/memoria")({
  head: () => ({
    meta: [
      { title: "Jogo da Memória — XP Arena" },
      {
        name: "description",
        content:
          "Encontra todos os pares no menor tempo e com menos tentativas para ganhar mais XP.",
      },
      { property: "og:title", content: "Jogo da Memória — XP Arena" },
      {
        property: "og:description",
        content: "Pares por categoria, com tempo e precisão a valer XP.",
      },
    ],
  }),
  component: MemoryGame,
});

type Phase = "setup" | "playing" | "result";

function MemoryGame() {
  const queryClient = useQueryClient();
  useProfileGate();
  const [phase, setPhase] = useState<Phase>("setup");
  const [category, setCategory] = useState(MEMORY_CATEGORIES[0]!.id);
  const [pairs, setPairs] = useState<(typeof MEMORY_DIFFICULTIES)[number]["pairs"]>(
    MEMORY_DIFFICULTIES[0].pairs,
  );

  const [deck, setDeck] = useState<MemoryCard[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [found, setFound] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [result, setResult] = useState<{ xp: number; totalXp: number } | null>(null);
  const [onlineWaiting, setOnlineWaiting] = useState(false);
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);

  const startRef = useRef(0);
  const tokenRef = useRef("");
  const finishedRef = useRef(false);
  const handleOnlineMatch = useCallback((roomId: string) => {
    setOnlineRoomId(roomId);
    setOnlineWaiting(false);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [phase]);

  function startGame() {
    setDeck(buildMemoryDeck(category, pairs));
    setFlipped([]);
    setAttempts(0);
    setFound(0);
    setElapsed(0);
    setResult(null);
    setSubmissionError(null);
    setLocked(false);
    finishedRef.current = false;
    startRef.current = Date.now();
    tokenRef.current = crypto.randomUUID();
    setPhase("playing");
  }

  const finish = useCallback(
    async (pairsFound: number, totalAttempts: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const durationMs = Date.now() - startRef.current;
      setPhase("result");
      setSubmitting(true);
      setSubmissionError(null);
      try {
        const res = await submitMemoryResult({
          data: {
            clientToken: tokenRef.current,
            category,
            pairsTotal: pairs,
            pairsFound,
            attempts: totalAttempts,
            durationMs,
          },
        });
        setResult({ xp: res.xpEarned, totalXp: res.totalXp });
        await queryClient.invalidateQueries({ queryKey: ["arena"] });
      } catch (error) {
        finishedRef.current = false;
        const message =
          error instanceof Error ? error.message : "Não foi possível registar a partida.";
        setSubmissionError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [category, pairs, queryClient],
  );

  function handleFlip(card: MemoryCard) {
    if (phase !== "playing" || locked || card.matched || flipped.includes(card.key)) return;
    const next = [...flipped, card.key];
    if (next.length < 2) {
      setFlipped(next);
      return;
    }
    setFlipped(next);
    setLocked(true);
    const [firstKey, secondKey] = next;
    const first = deck.find((c) => c.key === firstKey)!;
    const second = deck.find((c) => c.key === secondKey)!;
    const totalAttempts = attempts + 1;
    setAttempts(totalAttempts);

    if (first.value === second.value) {
      const updated = deck.map((c) => (c.value === first.value ? { ...c, matched: true } : c));
      const pairsFound = found + 1;
      setTimeout(() => {
        setDeck(updated);
        setFound(pairsFound);
        setFlipped([]);
        setLocked(false);
        if (pairsFound >= pairs) void finish(pairsFound, totalAttempts);
      }, 320);
    } else {
      setTimeout(() => {
        setFlipped([]);
        setLocked(false);
      }, 700);
    }
  }

  const seconds = Math.floor(elapsed / 1000);

  return (
    <div className="arena-hero min-h-screen">
      <main className="arena-safe-bottom mx-auto w-full max-w-md px-4 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <Link
            to="/jogos"
            aria-label="Voltar aos jogos"
            className="rounded-lg p-2 hover:bg-surface-2"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <h1 className="text-xl font-bold">Jogo da Memória</h1>
        </div>

        {onlineRoomId ? (
          <OnlineMemoryGame roomId={onlineRoomId} onLeave={() => setOnlineRoomId(null)} />
        ) : (
          <>
            {phase === "setup" && (
              <div className="space-y-6">
                <section>
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Categoria
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {MEMORY_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        aria-pressed={category === cat.id}
                        className={`arena-card flex items-center gap-2 p-4 text-sm font-medium ${
                          category === cat.id ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        <span aria-hidden="true" className="text-xl">
                          {cat.emoji}
                        </span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Dificuldade
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {MEMORY_DIFFICULTIES.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setPairs(d.pairs)}
                        aria-pressed={pairs === d.pairs}
                        className={`arena-card p-3 text-sm font-medium ${
                          pairs === d.pairs ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        {d.label}
                        <span className="block text-xs text-muted-foreground">{d.pairs} pares</span>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="grid gap-2">
                  <Button className="h-12 w-full" onClick={startGame}>
                    Jogar a solo
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 w-full"
                    onClick={() => setOnlineWaiting(true)}
                  >
                    <Users className="mr-2 size-4" aria-hidden="true" />
                    Jogar online
                  </Button>
                </div>
              </div>
            )}

            {phase === "playing" && (
              <>
                <div className="arena-card mb-4 flex items-center justify-between px-4 py-3 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Timer className="size-4 text-primary" aria-hidden="true" /> {seconds}s
                  </span>
                  <span>
                    Pares {found}/{pairs}
                  </span>
                  <span>Tentativas {attempts}</span>
                </div>

                <div
                  className={`grid gap-2 ${pairs > 8 ? "grid-cols-5" : "grid-cols-4"}`}
                  role="grid"
                  aria-label="Tabuleiro de cartas"
                >
                  {deck.map((card) => {
                    const isOpen = card.matched || flipped.includes(card.key);
                    return (
                      <button
                        key={card.key}
                        onClick={() => handleFlip(card)}
                        aria-label={isOpen ? `Carta ${card.value}` : "Carta virada para baixo"}
                        className={`aspect-square rounded-xl text-2xl transition-colors ${
                          isOpen
                            ? "animate-card-flip bg-surface-2 ring-2 ring-primary"
                            : "arena-gradient opacity-90"
                        } ${card.matched ? "opacity-60" : ""}`}
                      >
                        <span aria-hidden={!isOpen}>{isOpen ? card.value : "?"}</span>
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  className="mt-5 h-11 w-full"
                  onClick={() => void finish(found, attempts)}
                >
                  Terminar partida
                </Button>
              </>
            )}

            {phase === "result" && (
              <div className="arena-card p-6 text-center">
                {submitting ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">A calcular o teu XP…</p>
                  </div>
                ) : (
                  <>
                    {submissionError ? (
                      <>
                        <p className="text-sm text-destructive">{submissionError}</p>
                        <Button
                          className="mt-4 h-11 w-full"
                          onClick={() => void finish(found, attempts)}
                        >
                          Tentar registar novamente
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {found >= pairs ? "Completaste o tabuleiro!" : "Partida terminada"}
                        </p>
                        <p className="animate-xp-pop mt-2 text-4xl font-bold text-primary">
                          +{result?.xp ?? 0} XP
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          XP total: {result?.totalXp ?? 0}
                        </p>
                      </>
                    )}

                    {!submissionError && (
                      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                        <div className="rounded-xl bg-surface-2 p-3">
                          <dt className="text-xs text-muted-foreground">Tempo</dt>
                          <dd className="font-semibold">{seconds}s</dd>
                        </div>
                        <div className="rounded-xl bg-surface-2 p-3">
                          <dt className="text-xs text-muted-foreground">Tentativas</dt>
                          <dd className="font-semibold">{attempts}</dd>
                        </div>
                        <div className="rounded-xl bg-surface-2 p-3">
                          <dt className="text-xs text-muted-foreground">Pares</dt>
                          <dd className="font-semibold">
                            {found}/{pairs}
                          </dd>
                        </div>
                      </dl>
                    )}

                    {!submissionError && (
                      <div className="mt-6 space-y-2">
                        <Button className="h-12 w-full" onClick={startGame}>
                          <RotateCcw className="mr-2 size-4" aria-hidden="true" /> Jogar novamente
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 w-full"
                          onClick={() => setPhase("setup")}
                        >
                          Mudar categoria
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
        {onlineWaiting && (
          <OnlineMatchDialog
            game="memoria"
            memoryOptions={{ category, pairs }}
            onMatched={handleOnlineMatch}
            onClose={() => setOnlineWaiting(false)}
          />
        )}
      </main>
      <BottomNav />
    </div>
  );
}
