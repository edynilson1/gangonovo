CREATE OR REPLACE FUNCTION public.record_game_session(
  p_user_id uuid,
  p_game_type text,
  p_client_token text,
  p_score integer,
  p_xp integer,
  p_duration integer,
  p_result text,
  p_metadata jsonb,
  p_count_win boolean
)
RETURNS TABLE (
  session_id uuid,
  xp_earned integer,
  score integer,
  total_xp integer,
  wins integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recorded_session public.game_sessions%ROWTYPE;
BEGIN
  INSERT INTO public.game_sessions (
    user_id,
    game_type,
    client_token,
    score,
    xp_earned,
    duration,
    result,
    metadata
  )
  VALUES (
    p_user_id,
    p_game_type,
    p_client_token,
    p_score,
    p_xp,
    p_duration,
    p_result,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, client_token) DO NOTHING;

  SELECT *
  INTO recorded_session
  FROM public.game_sessions
  WHERE user_id = p_user_id
    AND client_token = p_client_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session could not be loaded after insert';
  END IF;

  PERFORM 1
  FROM public.xp_transactions
  WHERE game_session_id = recorded_session.id
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.xp_transactions (user_id, amount, source, game_session_id)
    VALUES (
      recorded_session.user_id,
      recorded_session.xp_earned,
      recorded_session.game_type,
      recorded_session.id
    );

    IF p_count_win THEN
      UPDATE public.profiles
      SET wins = wins + 1
      WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    recorded_session.id,
    recorded_session.xp_earned,
    recorded_session.score,
    profile.total_xp,
    profile.wins
  FROM public.profiles AS profile
  WHERE profile.id = p_user_id;
END;
$$;

WITH duplicate_transactions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY game_session_id
      ORDER BY created_at, id
    ) AS duplicate_number
  FROM public.xp_transactions
  WHERE game_session_id IS NOT NULL
)
DELETE FROM public.xp_transactions AS xp_row
USING duplicate_transactions AS duplicate
WHERE xp_row.id = duplicate.id
  AND duplicate.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS xp_transactions_game_session_unique_idx
  ON public.xp_transactions (game_session_id)
  WHERE game_session_id IS NOT NULL;

WITH recovered_sessions AS (
  INSERT INTO public.xp_transactions (user_id, amount, source, game_session_id)
  SELECT session.user_id, session.xp_earned, session.game_type, session.id
  FROM public.game_sessions AS session
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.xp_transactions AS existing_xp
    WHERE existing_xp.game_session_id = session.id
  )
  RETURNING user_id, game_session_id
)
UPDATE public.profiles AS profile
SET wins = profile.wins + recovered.wins
FROM (
  SELECT recovered.user_id, COUNT(*)::integer AS wins
  FROM recovered_sessions AS recovered
  JOIN public.game_sessions AS session ON session.id = recovered.game_session_id
  WHERE session.result = 'win'
  GROUP BY recovered.user_id
) AS recovered
WHERE profile.id = recovered.user_id;

REVOKE ALL ON FUNCTION public.record_game_session(
  uuid, text, text, integer, integer, integer, text, jsonb, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_game_session(
  uuid, text, text, integer, integer, integer, text, jsonb, boolean
) TO service_role;
