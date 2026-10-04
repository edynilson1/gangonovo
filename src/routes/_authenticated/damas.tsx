import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BottomNav } from "@/components/arena/BottomNav";
import { CheckersBoard } from "@/components/arena/CheckersBoard";
import { useProfileGate } from "@/hooks/useProfileGate";
import { Button } from "@/components/ui/button";
import { submitCheckersResult } from "@/lib/arena.functions";
import {
  applyStep,
  BOARD_SIZE,
  createInitialBoard,
  gameStatus,
  legalSteps,
  findLegalStep,
  type Board,
  type Step,
  type Pos,
} from "@/lib/games/checkers";

export const Route = createFileRoute("/_authenticated/damas")({
  head: () => ({
    meta: [
      { title: "Damas — XP Arena" },
      {
        name: "description",
        content: "Damas 8x8 contra o computador com três dificuldades e XP por desempenho.",
      },
      { property: "og:title", content: "Damas — XP Arena" },
      { property: "og:description", content: "Captura obrigatória, promoção a dama e XP no fim." },
    ],
  }),
  component: CheckersGame,
});

type Phase = "setup" | "playing" | "result";
type GameResult = "win" | "loss" | "draw";
type Difficulty = "facil" | "medio" | "dificil";

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "facil", label: "Fácil" },
  { id: "medio", label: "Médio" },
  { id: "dificil", label: "Difícil" },
];

function CheckersGame() {
  const queryClient = useQueryClient();
  useProfileGate();
  const [phase, setPhase] = useState<Phase>("setup");
  const [difficulty, setDifficulty] = useState<Difficulty>("facil");
  const [board, setBoard] = useState<Board>(createInitialBoard);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [turn, setTurn] = useState<"black" | "white">("black"); // Jogador é preto ("black")
  const [chainFrom, setChainFrom] = useState<Pos | null>(null);
  const [moves, setMoves] = useState(0);
  const [capturedByPlayer, setCapturedByPlayer] = useState(0);
  const [capturedByAi, setCapturedByAi] = useState(0);
  const [outcome, setOutcome] = useState<GameResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reward, setReward] = useState<{ xp: number; totalXp: number } | null>(null);

  const startRef = useRef(0);
  const tokenRef = useRef("");
  const statsRef = useRef({ moves: 0, byPlayer: 0, byAi: 0 });

  const playerLegalSteps = legalSteps(board, turn, chainFrom);
  const selectedTargets = selected
    ? playerLegalSteps.filter((s) => s.from.row === selected.row && s.from.col === selected.col)
    : [];

  const finish = useCallback(
    async (result: GameResult) => {
      setOutcome(result);
      setPhase("result");
      setSubmitting(true);
      try {
        const res = await submitCheckersResult({
          data: {
            clientToken: tokenRef.current,
            result,
            difficulty,
            moves: statsRef.current.moves,
            capturedByPlayer: statsRef.current.byPlayer,
            capturedByAi: statsRef.current.byAi,
            durationMs: Date.now() - startRef.current,
          },
        });
        setReward({ xp: res.xpEarned, totalXp: res.totalXp });
        await queryClient.invalidateQueries({ queryKey: ["arena"] });
      } catch (error) {
        toast.error((error as Error).message || "Não foi possível registar a partida.");
      } finally {
        setSubmitting(false);
      }
    },
    [difficulty, queryClient],
  );

  function startGame() {
    setBoard(createInitialBoard());
    setSelected(null);
    setChainFrom(null);
    setTurn("black");
    setMoves(0);
    setCapturedByPlayer(0);
    setCapturedByAi(0);
    setOutcome(null);
    setReward(null);
    statsRef.current = { moves: 0, byPlayer: 0, byAi: 0 };
    startRef.current = Date.now();
    tokenRef.current = crypto.randomUUID();
    setPhase("playing");
  }

  function executeStep(step: Step) {
    const result = applyStep(board, step);
    statsRef.current.moves += 1;
    if (step.capture) {
      if (turn === "black") {
        statsRef.current.byPlayer += 1;
        setCapturedByPlayer(statsRef.current.byPlayer);
      } else {
        statsRef.current.byAi += 1;
        setCapturedByAi(statsRef.current.byAi);
      }
    }

    setMoves(statsRef.current.moves);
    setBoard(result.board);

    // Verificar status do jogo
    const status = gameStatus(result.board, turn === "black" ? "white" : "black");
    if (status !== "playing") {
      if (status === "black_won") {
        void finish(turn === "black" ? "win" : "loss");
      } else if (status === "white_won") {
        void finish(turn === "black" ? "loss" : "win");
      } else {
        void finish("draw");
      }
      return;
    }

    // Captura múltipla contínua
    if (result.continues) {
      setChainFrom(step.to);
      setSelected(step.to);
      return;
    }

    setChainFrom(null);
    setSelected(null);
    setTurn((prev) => (prev === "black" ? "white" : "black"));
  }

  // Turno do Computador (Brancas - "white")
  useEffect(() => {
    if (phase !== "playing" || turn !== "white") return;

    const timeout = setTimeout(() => {
      const steps = legalSteps(board, "white");
      if (steps.length === 0) {
        void finish("win");
        return;
      }

      // IA simples escolhe um lance aleatório válido (ou o primeiro de captura se houver)
      const captureSteps = steps.filter((s) => s.capture !== null);
      const pool = captureSteps.length > 0 ? captureSteps : steps;
      const randomStep = pool[Math.floor(Math.random() * pool.length)];

      if (randomStep) {
        executeStep(randomStep);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [phase, turn, board, finish]);

  const handleSquare = (row: number, col: number) => {
    if (phase !== "playing" || turn !== "black") return;

    if (chainFrom) {
      // Durante uma sequência de captura, só pode mover a mesma peça
      const step = findLegalStep(board, "black", chainFrom, { row, col }, chainFrom);
      if (step) {
        executeStep(step);
      }
      return;
    }

    const target = selectedTargets.find((s) => s.to.row === row && s.to.col === col);
    if (target) {
      executeStep(target);
      return;
    }

    const piece = board[row]?.[col];
    if (piece?.player === "black" && playerLegalSteps.some((s) => s.from.row === row && s.from.col === col)) {
      setSelected({ row, col });
    } else {
      setSelected(null);
    }
  };

  return (
    <div className="arena-hero min-h-screen">
      <main className="arena-safe-bottom mx-auto w-full max-w-md px-4 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <Link to="/jogos" aria-label="Voltar aos jogos" className="rounded-lg p-2 hover:bg-surface-2">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <h1 className="text-xl font-bold">Damas</h1>
        </div>

        {phase === "setup" && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Tabuleiro 8x8 contra o computador. A captura é obrigatória e as peças promovem a dama na
              última linha.
            </p>
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Dificuldade
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    aria-pressed={difficulty === d.id}
                    className={`arena-card p-3 text-sm font-medium ${
                      difficulty === d.id ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <Button className="h-12 w-full" onClick={startGame}>
              Começar partida
            </Button>
          </div>
        )}

        {phase === "playing" && (
          <>
            <div className="arena-card mb-4 flex items-center justify-between px-4 py-3 text-sm">
              <span>{turn === "black" ? "A tua vez" : "Computador a pensar…"}</span>
              <span>Lances {moves}</span>
              <span>
                {capturedByPlayer} ✕ {capturedByAi}
              </span>
            </div>

            <CheckersBoard
              board={board}
              selected={selected}
              targets={selectedTargets}
              legal={playerLegalSteps}
              onSquare={handleSquare}
              mySide="black"
            />

            <Button variant="outline" className="mt-5 h-11 w-full" onClick={() => void finish("loss")}>
              Desistir
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
                <p className="text-sm text-muted-foreground">
                  {outcome === "win" ? "Vitória!" : outcome === "draw" ? "Empate" : "Derrota"}
                </p>
                <p className="animate-xp-pop mt-2 text-4xl font-bold text-primary">
                  +{reward?.xp ?? 0} XP
                </p>
                <p className="mt-1 text-xs text-muted-foreground">XP total: {reward?.totalXp ?? 0}</p>
                <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-muted-foreground">Lances</dt>
                    <dd className="font-semibold">{moves}</dd>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-muted-foreground">Capturas</dt>
                    <dd className="font-semibold">{capturedByPlayer}</dd>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-muted-foreground">Perdidas</dt>
                    <dd className="font-semibold">{capturedByAi}</dd>
                  </div>
                </dl>
                <div className="mt-6 space-y-2">
                  <Button className="h-12 w-full" onClick={startGame}>
                    <RotateCcw className="mr-2 size-4" aria-hidden="true" /> Jogar novamente
                  </Button>
                  <Button variant="outline" className="h-11 w-full" onClick={() => setPhase("setup")}>
                    Mudar dificuldade
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}