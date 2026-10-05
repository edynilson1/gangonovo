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

async function recordSessionUsingTables(args: RecordArgs) {
  let session: {
    id: string;
    xp_earned: number;
    score: number;
    game_type: string;
    result: string | null;
  } | null = null;

  const { data: inserted, error: sessionError } = await supabaseAdmin
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
    .select("id, xp_earned, score, game_type, result")
    .maybeSingle();

  if (!sessionError && inserted) {
    session = inserted;
  } else if (sessionError?.code === "23505") {
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("game_sessions")
      .select("id, xp_earned, score, game_type, result")
      .eq("user_id", args.userId)
      .eq("client_token", args.clientToken)
      .maybeSingle();
    if (lookupError || !existing) {
      console.error("[XP] Não foi possível recuperar a sessão para repetir o registo.", {
        code: lookupError?.code,
        message: lookupError?.message,
        gameType: args.gameType,
      });
      throw new Error("Não foi possível registar a partida.");
    }
    session = existing;
  } else {
    console.error("[XP] Falha ao guardar sessão pelas tabelas.", {
      code: sessionError?.code,
      message: sessionError?.message,
      details: sessionError?.details,
      hint: sessionError?.hint,
      gameType: args.gameType,
    });
    throw new Error("Não foi possível registar a partida.");
  }

  const { data: existingXp, error: lookupXpError } = await supabaseAdmin
    .from("xp_transactions")
    .select("id")
    .eq("game_session_id", session.id)
    .maybeSingle();
  if (lookupXpError) {
    console.error("[XP] Falha ao verificar a transação da sessão.", {
      code: lookupXpError.code,
      message: lookupXpError.message,
      gameType: args.gameType,
    });
    throw new Error("Não foi possível registar o XP.");
  }

  if (!existingXp) {
    const { error: xpError } = await supabaseAdmin.from("xp_transactions").insert({
      user_id: args.userId,
      amount: session.xp_earned,
      source: session.game_type,
      game_session_id: session.id,
    });
    if (xpError) {
      console.error("[XP] Falha ao guardar transação pelas tabelas.", {
        code: xpError.code,
        message: xpError.message,
        details: xpError.details,
        hint: xpError.hint,
        gameType: args.gameType,
      });
      throw new Error("Não foi possível registar o XP.");
    }

    if (args.countWin && session.result === "win") {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("wins")
        .eq("id", args.userId)
        .single();
      if (profileError) {
        console.error("[XP] Falha ao carregar vitórias do perfil.", {
          code: profileError.code,
          message: profileError.message,
        });
        throw new Error("A partida foi registada, mas não foi possível atualizar as vitórias.");
      }

      const { error: winsError } = await supabaseAdmin
        .from("profiles")
        .update({ wins: profile.wins + 1 })
        .eq("id", args.userId);
      if (winsError) {
        console.error("[XP] Falha ao atualizar vitórias do perfil.", {
          code: winsError.code,
          message: winsError.message,
        });
        throw new Error("A partida foi registada, mas não foi possível atualizar as vitórias.");
      }
    }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("total_xp, wins")
    .eq("id", args.userId)
    .single();
  if (profileError) {
    console.error("[XP] Falha ao confirmar o perfil atualizado.", {
      code: profileError.code,
      message: profileError.message,
    });
    throw new Error("A partida foi registada, mas não foi possível confirmar o XP.");
  }

  return {
    sessionId: session.id,
    xpEarned: session.xp_earned,
    score: session.score,
    totalXp: profile.total_xp,
    wins: profile.wins,
  };
}

/** Grava sessão + transação de XP com a chave de serviço (o cliente nunca escreve XP). */
export async function recordSession(args: RecordArgs) {
  const { data, error } = await supabaseAdmin.rpc("record_game_session", {
    p_user_id: args.userId,
    p_game_type: args.gameType,
    p_client_token: args.clientToken,
    p_score: args.score,
    p_xp: args.xp,
    p_duration: Math.round(args.durationMs / 1000),
    p_result: args.result,
    p_metadata: args.metadata as never,
    p_count_win: args.countWin,
  });
  if (error) {
    if (error.code === "PGRST202") {
      console.warn("[XP] Migração atómica ainda não aplicada; a usar registo compatível.", {
        gameType: args.gameType,
      });
      return recordSessionUsingTables(args);
    }
    console.error("[XP] Falha ao registar sessão de jogo.", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      gameType: args.gameType,
    });
    throw new Error("Não foi possível registar a partida.");
  }
  const recorded = data?.[0];
  if (!recorded) {
    console.error("[XP] Registo atómico da partida não devolveu o perfil atualizado.", {
      gameType: args.gameType,
    });
    throw new Error("Não foi possível confirmar o XP da partida.");
  }

  return {
    sessionId: recorded.session_id,
    xpEarned: recorded.xp_earned,
    score: recorded.score,
    totalXp: recorded.total_xp,
    wins: recorded.wins,
  };
}

/** Repetir a chamada para o mesmo resultado devolve a recompensa sem a atribuir duas vezes. */
export async function recordSessionQuiet(args: RecordArgs) {
  try {
    return await recordSession(args);
  } catch (error) {
    console.error("[XP] Falha ao registar partida online.", {
      error: error instanceof Error ? error.message : String(error),
      gameType: args.gameType,
    });
    return null;
  }
}
