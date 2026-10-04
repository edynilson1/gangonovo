import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2, RotateCcw, Timer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BottomNav } from "@/components/arena/BottomNav";
import { useProfileGate } from "@/hooks/useProfileGate";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getQuizRound,
  QUIZ_CATEGORIES,
  QUIZ_QUESTION_MS,
  submitQuizResult,
} from "@/lib/arena.functions";

export const Route = createFileRoute("/_authenticated/quiz")({
  head: () => ({
    meta: [
      { title: "Quiz — XP Arena" },
      {
        name: "description",
        content:
          "10 perguntas cronometradas de conhecimentos gerais, matemática, ciência e tecnologia.",
      },
      { property: "og:title", content: "Quiz — XP Arena" },
      {
        property: "og:description",
        content: "Responde rápido, acerta em sequência e ganha mais XP.",
      },
    ],
  }),
  component: QuizGame,
});

type Question = { id: string; question: string; options: string[]; difficulty: number };
type Answer = { questionId: string; choice: number; timeMs: number };
type Phase = "setup" | "loading" | "playing" | "result";
type CategoryId = (typeof QUIZ_CATEGORIES)[number]["id"];

function QuizGame() {
  const queryClient = useQueryClient();
  useProfileGate();
  const [phase, setPhase] = useState<Phase>("setup");
  const [category, setCategory] = useState<CategoryId>("geral");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(QUIZ_QUESTION_MS);
  const [streak, setStreak] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    xp: number;
    correct: number;
    total: number;
    bestStreak: number;
    totalXp: number;
  } | null>(null);

  const questionStart = useRef(0);
  const roundStart = useRef(0);
  const tokenRef = useRef("");
  const answersRef = useRef<Answer[]>([]);

  const submitRound = useCallback(
    async (finalAnswers: Answer[]) => {
      setPhase("result");
      setSubmitting(true);
      try {
        const res = await submitQuizResult({
          data: {
            clientToken: tokenRef.current,
            category,
            durationMs: Date.now() - roundStart.current,
            answers: finalAnswers,
          },
        });
        setResult({
          xp: res.xpEarned,
          correct: res.correct,
          total: res.total,
          bestStreak: res.bestStreak,
          totalXp: res.totalXp,
        });
        await queryClient.invalidateQueries({ queryKey: ["arena"] });
      } catch (error) {
        toast.error((error as Error).message || "Não foi possível registar a partida.");
      } finally {
        setSubmitting(false);
      }
    },
    [category, queryClient],
  );

  const commitAnswer = useCallback(
    (choice: number) => {
      const question = questions[index];
      if (!question) return;
      const answer: Answer = {
        questionId: question.id,
        choice,
        timeMs: Math.min(QUIZ_QUESTION_MS, Date.now() - questionStart.current),
      };
      const next = [...answersRef.current, answer];
      answersRef.current = next;
      setAnswers(next);
      setSelected(choice);
      setStreak((s) => (choice >= 0 ? s + 1 : 0));

      setTimeout(() => {
        if (index + 1 >= questions.length) {
          void submitRound(next);
        } else {
          setIndex(index + 1);
          setSelected(null);
          setRemaining(QUIZ_QUESTION_MS);
          questionStart.current = Date.now();
        }
      }, 450);
    },
    [index, questions, submitRound],
  );

  useEffect(() => {
    if (phase !== "playing" || selected !== null) return;
    const id = setInterval(() => {
      const left = QUIZ_QUESTION_MS - (Date.now() - questionStart.current);
      if (left <= 0) {
        clearInterval(id);
        commitAnswer(-1);
      } else {
        setRemaining(left);
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, selected, index, commitAnswer]);

  async function startRound() {
    setPhase("loading");
    try {
      const round = await getQuizRound({ data: { category } });
      if (round.questions.length === 0) {
        toast.error("Ainda não há perguntas nesta categoria.");
        setPhase("setup");
        return;
      }
      setQuestions(round.questions);
      setIndex(0);
      setAnswers([]);
      answersRef.current = [];
      setSelected(null);
      setStreak(0);
      setResult(null);
      setRemaining(QUIZ_QUESTION_MS);
      tokenRef.current = crypto.randomUUID();
      roundStart.current = Date.now();
      questionStart.current = Date.now();
      setPhase("playing");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível carregar o quiz.");
      setPhase("setup");
    }
  }

  const current = questions[index];

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
          <h1 className="text-xl font-bold">Quiz</h1>
        </div>

        {phase === "setup" && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              10 perguntas, {QUIZ_QUESTION_MS / 1000}s por pergunta. Acertos seguidos valem bónus.
            </p>
            <div className="grid gap-3">
              {QUIZ_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  aria-pressed={category === cat.id}
                  className={`arena-card flex items-center gap-3 p-4 text-sm font-medium ${
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
            <Button className="h-12 w-full" onClick={() => void startRound()}>
              Começar quiz
            </Button>
          </div>
        )}

        {phase === "loading" && (
          <div className="arena-card flex flex-col items-center gap-3 p-10">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">A preparar perguntas…</p>
          </div>
        )}

        {phase === "playing" && current && (
          <div>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span>
                Pergunta {index + 1}/{questions.length}
              </span>
              <span className="flex items-center gap-1.5">
                <Timer className="size-4 text-primary" aria-hidden="true" />
                {Math.ceil(remaining / 1000)}s
              </span>
              <span className="text-primary">🔥 {streak}</span>
            </div>
            <Progress value={(remaining / QUIZ_QUESTION_MS) * 100} className="h-1.5" />

            <div className="arena-card mt-4 p-5">
              <h2 className="text-base font-semibold">{current.question}</h2>
            </div>

            <div className="mt-4 grid gap-2">
              {current.options.map((option, optionIndex) => (
                <button
                  key={option}
                  disabled={selected !== null}
                  onClick={() => commitAnswer(optionIndex)}
                  className={`arena-card p-4 text-left text-sm transition-colors ${
                    selected === optionIndex ? "ring-2 ring-primary" : ""
                  } disabled:opacity-70`}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              As respostas são corrigidas no servidor no fim da partida.
            </p>
          </div>
        )}

        {phase === "result" && (
          <div className="arena-card p-6 text-center">
            {submitting ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">A corrigir e calcular XP…</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Quiz terminado</p>
                <p className="animate-xp-pop mt-2 text-4xl font-bold text-primary">
                  +{result?.xp ?? 0} XP
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  XP total: {result?.totalXp ?? 0}
                </p>

                <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-muted-foreground">Certas</dt>
                    <dd className="flex items-center justify-center gap-1 font-semibold">
                      <Check className="size-4 text-primary" aria-hidden="true" />
                      {result?.correct ?? 0}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-muted-foreground">Erradas</dt>
                    <dd className="flex items-center justify-center gap-1 font-semibold">
                      <X className="size-4 text-destructive" aria-hidden="true" />
                      {(result?.total ?? 0) - (result?.correct ?? 0)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-muted-foreground">Sequência</dt>
                    <dd className="font-semibold">{result?.bestStreak ?? 0}</dd>
                  </div>
                </dl>

                <div className="mt-6 space-y-2">
                  <Button className="h-12 w-full" onClick={() => void startRound()}>
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
              </>
            )}
          </div>
        )}

        {answers.length > 0 && phase === "playing" && (
          <span className="sr-only">Respostas registadas</span>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
