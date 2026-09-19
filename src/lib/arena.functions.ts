import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COUNTRY_CODES } from "@/lib/countries";
import {
  checkersXp,
  memoryXp,
  quizXp,
  type CheckersPerformance,
  type MemoryPerformance,
} from "@/lib/xp-rules";

export type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  total_xp: number;
  wins: number;
  created_at: string;
};

export type LeaderboardEntry = {
  rank: number;
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  total_xp: number;
  wins: number;
};

const MAX_SESSIONS_PER_HOUR = 40;

/** Impede acumulação abusiva de recompensas em pouco tempo. */
async function assertRateLimit(supabase: any, userId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("game_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw new Error("Não foi possível validar a partida. Tenta novamente.");
  if ((count ?? 0) >= MAX_SESSIONS_PER_HOUR) {
    throw new Error("Limite de partidas por hora atingido. Faz uma pausa e volta em breve.");
  }
}

type RecordArgs = {
  userId: string;
  gameType: string;
  clientToken: string;
  score: number;
  xp: number;
  durationMs: number;
  result: string | null;
  metadata: Record<string, unknown>;
  countWin: boolean;
};

/** Delegado ao módulo server-only, que usa a chave de serviço. */
async function recordSession(args: RecordArgs) {
  const { recordSession: record } = await import("@/lib/match.server");
  return record(args);
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, country_code, total_xp, wins, created_at")
      .eq("id", userId)
      .maybeSingle();

    const { data: rank } = await supabase.rpc("user_rank", { _user_id: userId });

    const { data: recent } = await supabase
      .from("xp_transactions")
      .select("id, amount, source, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);

    return {
      profile: (profile ?? null) as ProfileRow | null,
      rank: (rank as number | null) ?? null,
      recentXp: recent ?? [],
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9_]{3,16}$/, "Usa 3-16 caracteres: letras, números ou _"),
        displayName: z.string().trim().min(2, "Nome muito curto").max(24, "Nome muito longo"),
        avatarUrl: z.string().url().max(300),
        countryCode: z.enum(COUNTRY_CODES as [string, ...string[]]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        username: data.username,
        display_name: data.displayName,
        avatar_url: data.avatarUrl,
        ...(data.countryCode ? { country_code: data.countryCode } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      if (error.code === "23505") throw new Error("Esse nome de utilizador já está em uso.");
      throw new Error("Não foi possível guardar o perfil.");
    }
    return { ok: true };
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: top, error } = await supabase.rpc("leaderboard_top", { _limit: 25 });
    if (error) throw new Error("Não foi possível carregar o ranking.");
    const { data: rank } = await supabase.rpc("user_rank", { _user_id: userId });
    return {
      top: (top ?? []) as LeaderboardEntry[],
      myRank: (rank as number | null) ?? null,
      myId: userId,
    };
  });

export const getMyHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("game_sessions")
      .select("id, game_type, score, xp_earned, duration, result, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(25);
    return { sessions: data ?? [] };
  });

/* ---------------------------- MEMÓRIA ---------------------------- */

export const submitMemoryResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientToken: z.string().uuid(),
        category: z.string().min(2).max(24),
        pairsTotal: z.number().int().min(6).max(10),
        pairsFound: z.number().int().min(0).max(10),
        attempts: z.number().int().min(0).max(300),
        durationMs: z.number().int().min(0).max(30 * 60 * 1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRateLimit(supabase, userId);

    if (data.pairsFound > data.pairsTotal || data.attempts < data.pairsFound) {
      throw new Error("Resultado inválido.");
    }
    // Tempo mínimo plausível por par encontrado, para travar resultados fabricados.
    if (data.durationMs < data.pairsFound * 600) {
      throw new Error("Resultado inválido.");
    }

    const perf: MemoryPerformance = {
      pairsTotal: data.pairsTotal,
      pairsFound: data.pairsFound,
      attempts: data.attempts,
      durationMs: data.durationMs,
    };
    const { xp, score, completed } = memoryXp(perf);

    return recordSession({
      userId,
      gameType: "memoria",
      clientToken: data.clientToken,
      score,
      xp,
      durationMs: data.durationMs,
      result: completed ? "win" : "incomplete",
      metadata: { ...perf, category: data.category },
      countWin: completed,
    });
  });

/* ------------------------------ QUIZ ----------------------------- */

export const QUIZ_CATEGORIES = [
  { id: "geral", label: "Conhecimentos Gerais", emoji: "🧠" },
  { id: "matematica", label: "Matemática", emoji: "➗" },
  { id: "ciencia", label: "Ciência", emoji: "🔬" },
  { id: "tecnologia", label: "Tecnologia", emoji: "💻" },
] as const;

export const QUIZ_QUESTION_MS = 20_000;

export const getQuizRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ category: z.enum(["geral", "matematica", "ciencia", "tecnologia"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("quiz_questions")
      .select("id, question, options, category, difficulty")
      .eq("category", data.category)
      .eq("active", true);

    if (error) throw new Error("Não foi possível carregar as perguntas.");

    const questions = (rows ?? [])
      .sort(() => Math.random() - 0.5)
      .slice(0, 10)
      .map((q) => ({
        id: q.id,
        question: q.question,
        options: (q.options as string[]) ?? [],
        difficulty: q.difficulty,
      }));

    return { questions, timeLimitMs: QUIZ_QUESTION_MS };
  });

export const submitQuizResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientToken: z.string().uuid(),
        category: z.string().min(2).max(24),
        durationMs: z.number().int().min(0).max(30 * 60 * 1000),
        answers: z
          .array(
            z.object({
              questionId: z.string().uuid(),
              choice: z.number().int().min(-1).max(5),
              timeMs: z.number().int().min(0).max(QUIZ_QUESTION_MS + 2000),
            }),
          )
          .min(1)
          .max(10),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRateLimit(supabase, userId);

    const ids = data.answers.map((a) => a.questionId);
    const { data: rows, error } = await supabase
      .from("quiz_questions")
      .select("id, correct_answer")
      .in("id", ids);
    if (error || !rows) throw new Error("Não foi possível validar as respostas.");

    const correctById = new Map(rows.map((r) => [r.id, r.correct_answer]));

    let correct = 0;
    let streak = 0;
    let bestStreak = 0;
    let totalTime = 0;
    const detail = data.answers.map((a) => {
      const isCorrect = correctById.get(a.questionId) === a.choice;
      if (isCorrect) {
        correct += 1;
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
      } else {
        streak = 0;
      }
      totalTime += a.timeMs;
      return { questionId: a.questionId, correct: isCorrect };
    });

    const total = data.answers.length;
    const { xp, score } = quizXp({
      total,
      correct,
      bestStreak,
      avgAnswerMs: total > 0 ? totalTime / total : QUIZ_QUESTION_MS,
      questionTimeLimitMs: QUIZ_QUESTION_MS,
    });

    const recorded = await recordSession({
      userId,
      gameType: "quiz",
      clientToken: data.clientToken,
      score,
      xp,
      durationMs: data.durationMs,
      result: correct >= Math.ceil(total * 0.6) ? "win" : "loss",
      metadata: { category: data.category, correct, total, bestStreak },
      countWin: correct >= Math.ceil(total * 0.6),
    });

    return { ...recorded, correct, total, bestStreak, detail };
  });

/* ------------------------------ DAMAS ---------------------------- */

export const submitCheckersResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientToken: z.string().uuid(),
        result: z.enum(["win", "loss", "draw"]),
        difficulty: z.enum(["facil", "medio", "dificil"]),
        moves: z.number().int().min(0).max(500),
        capturedByPlayer: z.number().int().min(0).max(12),
        capturedByAi: z.number().int().min(0).max(12),
        durationMs: z.number().int().min(0).max(60 * 60 * 1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRateLimit(supabase, userId);

    if (data.result === "win" && (data.moves < 8 || data.capturedByPlayer < 4)) {
      throw new Error("Resultado inválido.");
    }

    const perf: CheckersPerformance = {
      result: data.result,
      moves: data.moves,
      durationMs: data.durationMs,
      difficulty: data.difficulty,
      capturedByPlayer: data.capturedByPlayer,
      capturedByAi: data.capturedByAi,
    };
    const { xp, score } = checkersXp(perf);

    return recordSession({
      userId,
      gameType: "damas",
      clientToken: data.clientToken,
      score,
      xp,
      durationMs: data.durationMs,
      result: data.result,
      metadata: { ...perf },
      countWin: data.result === "win",
    });
  });
