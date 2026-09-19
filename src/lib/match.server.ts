import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RecordArgs = {
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

/** Grava sessão + transação de XP com a chave de serviço (o cliente nunca escreve XP). */
export async function recordSession(args: RecordArgs) {
  const { data: session, error } = await supabaseAdmin
    .from("game_sessions")
    .insert({
      user_id: args.userId,
      game_type: args.gameType,
      client_token: args.clientToken,
      score: args.score,
      xp_earned: args.xp,
      duration: Math.round(args.durationMs / 1000),
      result: args.result,
      metadata: args.metadata as never,
    })
    .select("id")
    .single();

  if (error) {
    // Índice único (user_id, client_token): resultado duplicado não é recompensado outra vez.
    if (error.code === "23505" || error.code === "23505".replace("5", "5")) {
      throw new Error("Este resultado já foi registado.");
    }
    if (error.code === "23505" || error.message.includes("duplicate")) {
      throw new Error("Este resultado já foi registado.");
    }
    throw new Error("Não foi possível registar a partida.");
  }

  const { error: xpError } = await supabaseAdmin.from("xp_transactions").insert({
    user_id: args.userId,
    amount: args.xp,
    source: args.gameType,
    game_session_id: session.id,
  });
  if (xpError) throw new Error("Não foi possível registar o XP.");

  if (args.countWin) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wins")
      .eq("id", args.userId)
      .single();
    await supabaseAdmin
      .from("profiles")
      .update({ wins: (profile?.wins ?? 0) + 1 })
      .eq("id", args.userId);
  }

  const { data: updated } = await supabaseAdmin
    .from("profiles")
    .select("total_xp, wins")
    .eq("id", args.userId)
    .single();

  return {
    sessionId: session.id,
    xpEarned: args.xp,
    score: args.score,
    totalXp: updated?.total_xp ?? 0,
    wins: updated?.wins ?? 0,
  };
}

/** Versão tolerante: usada em partidas online, onde o resultado pode chegar duas vezes. */
export async function recordSessionQuiet(args: RecordArgs) {
  try {
    return await recordSession(args);
  } catch {
    return null;
  }
}
