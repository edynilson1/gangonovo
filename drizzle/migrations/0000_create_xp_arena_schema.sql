-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  total_xp integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  last_xp_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (lower(username));
CREATE INDEX profiles_rank_idx ON public.profiles (total_xp DESC, wins DESC, last_xp_at ASC);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- GAME SESSIONS
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  duration integer NOT NULL DEFAULT 0,
  result text,
  client_token text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX game_sessions_user_token_idx ON public.game_sessions (user_id, client_token);
CREATE INDEX game_sessions_user_created_idx ON public.game_sessions (user_id, created_at DESC);

GRANT SELECT ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own sessions"
  ON public.game_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- XP TRANSACTIONS
CREATE TABLE public.xp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  source text NOT NULL,
  game_session_id uuid REFERENCES public.game_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xp_transactions_user_idx ON public.xp_transactions (user_id, created_at DESC);

GRANT SELECT ON public.xp_transactions TO authenticated;
GRANT ALL ON public.xp_transactions TO service_role;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own xp transactions"
  ON public.xp_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- QUIZ QUESTIONS
CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_answer smallint NOT NULL,
  difficulty smallint NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quiz_questions_category_idx ON public.quiz_questions (category, active);

GRANT SELECT ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quiz questions readable by authenticated"
  ON public.quiz_questions FOR SELECT TO authenticated USING (active);

-- PROFILE AUTO-CREATION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- XP AGGREGATION
CREATE OR REPLACE FUNCTION public.apply_xp_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET total_xp = GREATEST(0, total_xp + NEW.amount),
      last_xp_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_xp_transaction_insert
AFTER INSERT ON public.xp_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_xp_transaction();

-- RANKING FUNCTIONS
CREATE OR REPLACE FUNCTION public.leaderboard_top(_limit integer DEFAULT 25)
RETURNS TABLE (
  rank bigint,
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_xp integer,
  wins integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROW_NUMBER() OVER (ORDER BY p.total_xp DESC, p.wins DESC, p.last_xp_at ASC NULLS LAST) AS rank,
         p.id, p.username, p.display_name, p.avatar_url, p.total_xp, p.wins
  FROM public.profiles p
  WHERE p.username IS NOT NULL
  ORDER BY p.total_xp DESC, p.wins DESC, p.last_xp_at ASC NULLS LAST
  LIMIT LEAST(GREATEST(_limit, 1), 100)
$$;

CREATE OR REPLACE FUNCTION public.user_rank(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.rank FROM (
    SELECT p.id, ROW_NUMBER() OVER (ORDER BY p.total_xp DESC, p.wins DESC, p.last_xp_at ASC NULLS LAST) AS rank
    FROM public.profiles p
    WHERE p.username IS NOT NULL
  ) r WHERE r.id = _user_id
$$;

GRANT EXECUTE ON FUNCTION public.leaderboard_top(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_rank(uuid) TO authenticated;

-- SEED QUIZ QUESTIONS
INSERT INTO public.quiz_questions (category, question, options, correct_answer, difficulty) VALUES
('geral','Qual é a capital de Portugal?','["Lisboa","Porto","Braga","Faro"]',0,1),
('geral','Quantos continentes existem?','["5","6","7","8"]',2,1),
('geral','Qual é o maior oceano do mundo?','["Atlântico","Índico","Ártico","Pacífico"]',3,1),
('geral','Em que país estão as pirâmides de Gizé?','["México","Egito","Peru","Sudão"]',1,1),
('geral','Qual é a moeda do Japão?','["Yuan","Won","Iene","Rupia"]',2,1),
('geral','Quem pintou a Mona Lisa?','["Van Gogh","Da Vinci","Picasso","Rembrandt"]',1,1),
('geral','Qual o animal terrestre mais rápido?','["Leão","Chita","Cavalo","Antílope"]',1,1),
('geral','Quantos jogadores tem uma equipa de futebol em campo?','["9","10","11","12"]',2,1),
('geral','Qual é o rio mais longo de África?','["Congo","Nilo","Zambeze","Níger"]',1,2),
('geral','Em que continente fica Angola?','["Ásia","Europa","África","Oceania"]',2,1),
('geral','Qual é a língua mais falada no mundo como nativa?','["Inglês","Mandarim","Espanhol","Hindi"]',1,2),
('geral','Quantas cores tem o arco-íris?','["5","6","7","8"]',2,1),
('matematica','Quanto é 7 x 8?','["54","56","58","64"]',1,1),
('matematica','Qual é a raiz quadrada de 144?','["11","12","13","14"]',1,1),
('matematica','Quanto é 15% de 200?','["25","30","35","40"]',1,1),
('matematica','Qual é o próximo número: 2, 4, 8, 16, ...?','["20","24","32","64"]',2,1),
('matematica','Quantos graus tem a soma dos ângulos de um triângulo?','["90","180","270","360"]',1,1),
('matematica','Quanto é 9² - 4²?','["55","65","70","72"]',1,2),
('matematica','Qual é o valor aproximado de pi?','["2.71","3.14","3.41","1.62"]',1,1),
('matematica','Quanto é 120 / 8?','["12","14","15","16"]',2,1),
('matematica','Um número primo entre 20 e 30 é:','["21","23","25","27"]',1,1),
('matematica','Quanto é 2^10?','["512","1024","2048","256"]',1,2),
('matematica','Se x + 5 = 12, quanto vale x?','["5","6","7","8"]',2,1),
('matematica','Qual é a área de um quadrado de lado 6?','["24","30","36","42"]',2,1),
('ciencia','Qual é o símbolo químico da água?','["H2O","CO2","O2","NaCl"]',0,1),
('ciencia','Qual planeta é conhecido como planeta vermelho?','["Vénus","Marte","Júpiter","Mercúrio"]',1,1),
('ciencia','Qual é o órgão que bombeia o sangue?','["Pulmão","Fígado","Coração","Rim"]',2,1),
('ciencia','Qual gás as plantas absorvem na fotossíntese?','["Oxigénio","Azoto","Dióxido de carbono","Hidrogénio"]',2,1),
('ciencia','Quantos ossos tem o corpo humano adulto?','["186","206","226","246"]',1,2),
('ciencia','Qual é a velocidade aproximada da luz?','["300 mil km/s","150 mil km/s","30 mil km/s","3 mil km/s"]',0,2),
('ciencia','Qual é o metal líquido à temperatura ambiente?','["Ferro","Mercúrio","Chumbo","Zinco"]',1,1),
('ciencia','Qual cientista propôs a teoria da relatividade?','["Newton","Einstein","Galileu","Bohr"]',1,1),
('ciencia','Qual é o maior planeta do sistema solar?','["Saturno","Júpiter","Netuno","Urano"]',1,1),
('ciencia','O que mede a escala de Richter?','["Temperatura","Vento","Sismos","Chuva"]',2,1),
('ciencia','Qual parte da célula contém o ADN?','["Membrana","Núcleo","Citoplasma","Ribossoma"]',1,2),
('ciencia','Qual vitamina obtemos da luz solar?','["A","B12","C","D"]',3,1),
('tecnologia','O que significa CPU?','["Central Processing Unit","Computer Power Unit","Control Program Utility","Central Program Unit"]',0,1),
('tecnologia','Qual linguagem é usada para estilizar páginas web?','["HTML","CSS","SQL","Python"]',1,1),
('tecnologia','Quem fundou a Microsoft com Paul Allen?','["Steve Jobs","Bill Gates","Elon Musk","Larry Page"]',1,1),
('tecnologia','O que significa HTTP?','["HyperText Transfer Protocol","High Transfer Text Protocol","HyperText Transport Page","Host Transfer Protocol"]',0,1),
('tecnologia','Quantos bits tem um byte?','["4","8","16","32"]',1,1),
('tecnologia','Qual empresa criou o Android?','["Apple","Google","Samsung","Nokia"]',1,1),
('tecnologia','O que é um algoritmo?','["Um tipo de vírus","Uma sequência de passos","Um cabo de rede","Um monitor"]',1,1),
('tecnologia','Qual destes é um sistema de base de dados?','["React","PostgreSQL","Docker","Figma"]',1,1),
('tecnologia','O que significa IA?','["Interface Aberta","Inteligência Artificial","Internet Avançada","Índice Automático"]',1,1),
('tecnologia','Qual protocolo protege sites com cifragem?','["FTP","HTTPS","SMTP","POP3"]',1,1),
('tecnologia','Qual é a unidade maior: GB ou TB?','["GB","TB","São iguais","Depende"]',1,1),
('tecnologia','Qual linguagem corre nativamente no navegador?','["Java","JavaScript","C#","Ruby"]',1,1);
