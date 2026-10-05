/**
 * Regras de XP — usadas exclusivamente no servidor.
 * O cliente nunca envia XP; envia apenas desempenho bruto, que é validado aqui.
 */

export const XP_CAPS = {
  memory: 220,
  quiz: 220,
  checkers: 220,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Cada partida concluída atribui uma recompensa aleatória entre 110 e 220 XP. */
function randomMatchXp(): number {
  return 110 + Math.floor(Math.random() * 111);
}

export type MemoryPerformance = {
  pairsTotal: number;
  pairsFound: number;
  attempts: number;
  durationMs: number;
};

export function memoryXp(p: MemoryPerformance): { xp: number; score: number; completed: boolean } {
  const completed = p.pairsFound >= p.pairsTotal;
  const accuracy = p.attempts > 0 ? clamp(p.pairsFound / p.attempts, 0, 1) : 0;

  const expectedMs = p.pairsTotal * 4200;
  const speedRatio = clamp((expectedMs * 1.6 - p.durationMs) / (expectedMs * 1.2), 0, 1);
  const speedBonus = completed ? Math.round(32 * speedRatio) : 0;

  const score = Math.round(p.pairsFound * 100 * accuracy + speedBonus * 5);
  return { xp: randomMatchXp(), score, completed };
}

export type QuizPerformance = {
  total: number;
  correct: number;
  bestStreak: number;
  avgAnswerMs: number;
  questionTimeLimitMs: number;
};

export function quizXp(p: QuizPerformance): { xp: number; score: number } {
  const accuracy = p.total > 0 ? clamp(p.correct / p.total, 0, 1) : 0;

  const streakBonus = Math.min(30, Math.max(0, p.bestStreak - 1) * 6);
  const speedRatio = clamp(1 - p.avgAnswerMs / p.questionTimeLimitMs, 0, 1);
  const speedBonus = Math.round(28 * speedRatio * accuracy);

  const score = p.correct * 100 + streakBonus * 10 + speedBonus * 5;
  return { xp: randomMatchXp(), score };
}

/** "amigo" = partida local a dois; "online" = partida 1x1 validada no servidor. */
export type CheckersLevel = "facil" | "medio" | "dificil" | "amigo" | "online";

export type CheckersPerformance = {
  result: "win" | "loss" | "draw";
  moves: number;
  durationMs: number;
  difficulty: CheckersLevel;
  capturedByPlayer: number;
  capturedByAi: number;
};

export function checkersXp(p: CheckersPerformance): { xp: number; score: number } {
  const difficultyMultiplier = { facil: 1, medio: 1.3, dificil: 1.6, amigo: 1.2, online: 1.55 }[
    p.difficulty
  ];

  const score = Math.round(
    (p.result === "win" ? 500 : p.result === "draw" ? 250 : 100) * difficultyMultiplier +
      p.capturedByPlayer * 20 -
      p.capturedByAi * 10,
  );
  return { xp: randomMatchXp(), score: Math.max(0, score) };
}

export function xpLevel(totalXp: number): { level: number; current: number; needed: number } {
  let level = 1;
  let remaining = totalXp;
  let needed = 300;
  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = Math.round(needed * 1.25);
  }
  return { level, current: remaining, needed };
}
