-- País no perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code TEXT;

-- ============ PRESENÇA ============
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online','in_game','offline')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presence readable by authenticated" ON public.user_presence;
CREATE POLICY "presence readable by authenticated" ON public.user_presence
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "presence own upsert" ON public.user_presence;
CREATE POLICY "presence own upsert" ON public.user_presence
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "presence own update" ON public.user_presence;
CREATE POLICY "presence own update" ON public.user_presence
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ SALAS DE DAMAS ============
CREATE TABLE IF NOT EXISTS public.checkers_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished','cancelled')),
  board JSONB NOT NULL,
  turn TEXT NOT NULL DEFAULT 'p' CHECK (turn IN ('p','a')),
  host_side TEXT NOT NULL DEFAULT 'p' CHECK (host_side IN ('p','a')),
  move_count INT NOT NULL DEFAULT 0,
  idle_moves INT NOT NULL DEFAULT 0,
  captures_p INT NOT NULL DEFAULT 0,
  captures_a INT NOT NULL DEFAULT 0,
  last_move JSONB,
  winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  outcome TEXT CHECK (outcome IN ('win','draw','abandon')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkers_rooms_status_idx ON public.checkers_rooms(status, created_at DESC);

GRANT SELECT ON public.checkers_rooms TO authenticated;
GRANT ALL ON public.checkers_rooms TO service_role;
ALTER TABLE public.checkers_rooms ENABLE ROW LEVEL SECURITY;

-- Leitura pública (autenticados) para a lista de salas; escrita só via servidor.
DROP POLICY IF EXISTS "rooms readable by authenticated" ON public.checkers_rooms;
CREATE POLICY "rooms readable by authenticated" ON public.checkers_rooms
  FOR SELECT TO authenticated USING (true);

-- ============ MENSAGENS ============
CREATE TABLE IF NOT EXISTS public.checkers_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.checkers_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkers_messages_room_idx ON public.checkers_messages(room_id, created_at);

GRANT SELECT ON public.checkers_messages TO authenticated;
GRANT ALL ON public.checkers_messages TO service_role;
ALTER TABLE public.checkers_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages readable by participants" ON public.checkers_messages;
CREATE POLICY "messages readable by participants" ON public.checkers_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.checkers_rooms r
      WHERE r.id = checkers_messages.room_id
        AND (r.host_id = auth.uid() OR r.guest_id = auth.uid())
    )
  );

-- ============ REALTIME ============
ALTER TABLE public.checkers_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.checkers_messages REPLICA IDENTITY FULL;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.checkers_rooms;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.checkers_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============ RANKING COM PAÍS ============
DROP FUNCTION IF EXISTS public.leaderboard_top(integer);
CREATE OR REPLACE FUNCTION public.leaderboard_top(_limit integer DEFAULT 25)
RETURNS TABLE (
  rank bigint,
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  country_code text,
  total_xp integer,
  wins integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.total_xp DESC, p.wins DESC, p.last_xp_at ASC NULLS LAST, p.created_at ASC) AS rank,
    p.id, p.username, p.display_name, p.avatar_url, p.country_code, p.total_xp, p.wins
  FROM public.profiles p
  WHERE p.username IS NOT NULL
  ORDER BY p.total_xp DESC, p.wins DESC, p.last_xp_at ASC NULLS LAST, p.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 25), 1), 100);
$$;
