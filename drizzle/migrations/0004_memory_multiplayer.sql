CREATE TABLE public.memory_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  category text NOT NULL,
  pairs integer NOT NULL CHECK (pairs BETWEEN 6 AND 10),
  deck jsonb NOT NULL,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
  turn_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_card_key text,
  revealed_keys text[] NOT NULL DEFAULT '{}',
  matched_keys text[] NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 0,
  host_score integer NOT NULL DEFAULT 0,
  guest_score integer NOT NULL DEFAULT 0,
  turn_available_at timestamptz,
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX memory_rooms_matchmaking_idx
  ON public.memory_rooms (category, pairs, status, created_at);
CREATE INDEX memory_rooms_host_status_idx ON public.memory_rooms (host_id, status);
CREATE INDEX memory_rooms_guest_status_idx ON public.memory_rooms (guest_id, status);

GRANT SELECT ON public.memory_rooms TO authenticated;
GRANT ALL ON public.memory_rooms TO service_role;
ALTER TABLE public.memory_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Memory rooms readable by participants"
  ON public.memory_rooms FOR SELECT TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

ALTER TABLE public.memory_rooms REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_rooms;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
