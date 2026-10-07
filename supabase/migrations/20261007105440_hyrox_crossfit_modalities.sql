-- Etapa 7: modalidades híbridas — Corrida, CrossFit e Hyrox.
--
-- Compatibilidade: todo treino existente vira modality = 'corrida' (DEFAULT)
-- e não tem blocos → continua exatamente como hoje (distância, pace, séries).
-- Treinos de Hyrox/CrossFit são descritos por blocos ordenados
-- (training_blocks); o aluno registra o resultado de cada bloco no check-in
-- (checkin_block_results).
--
-- Multi-tenant: exercises tem organization_id (NULL = exercício global do
-- sistema, só leitura); training_blocks herda a organização de trainings e
-- checkin_block_results herda de checkins → aluno (mesmos padrões da Etapa 3).

-- ─── 1. trainings ───────────────────────────────────────────────────────────

ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'corrida',
  ADD COLUMN IF NOT EXISTS wod_format text,
  ADD COLUMN IF NOT EXISTS time_cap_seconds integer;

ALTER TABLE public.trainings DROP CONSTRAINT IF EXISTS trainings_modality_check;
ALTER TABLE public.trainings
  ADD CONSTRAINT trainings_modality_check CHECK (modality IN ('corrida', 'crossfit', 'hyrox'));
ALTER TABLE public.trainings DROP CONSTRAINT IF EXISTS trainings_wod_format_check;
ALTER TABLE public.trainings
  ADD CONSTRAINT trainings_wod_format_check
  CHECK (wod_format IS NULL OR wod_format IN ('for_time', 'amrap', 'emom', 'rounds', 'tabata'));
ALTER TABLE public.trainings DROP CONSTRAINT IF EXISTS trainings_time_cap_check;
ALTER TABLE public.trainings
  ADD CONSTRAINT trainings_time_cap_check CHECK (time_cap_seconds IS NULL OR time_cap_seconds > 0);

CREATE INDEX IF NOT EXISTS idx_trainings_modality ON public.trainings (modality);

-- ─── 2. exercises ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.exercises (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  modality           text NOT NULL CHECK (modality IN ('corrida', 'crossfit', 'hyrox')),
  metric             text NOT NULL CHECK (metric IN ('distance', 'reps', 'time', 'load')),
  default_distance_m integer CHECK (default_distance_m IS NULL OR default_distance_m > 0),
  default_reps       integer CHECK (default_reps IS NULL OR default_reps > 0),
  -- ordem de exibição (ex.: as 8 estações oficiais do Hyrox na ordem da prova)
  sort_order         integer NOT NULL DEFAULT 0,
  -- NULL = exercício global do sistema (seed abaixo). Admin cria exercícios
  -- próprios na sua organização (default resolve_org_id()).
  organization_id    uuid DEFAULT private.resolve_org_id()
                     REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exercises IS 'Exercícios/estações usados nos blocos de treino. organization_id NULL = global (somente leitura para as assessorias).';

CREATE UNIQUE INDEX IF NOT EXISTS exercises_scope_name_key
  ON public.exercises (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
CREATE INDEX IF NOT EXISTS idx_exercises_organization_id ON public.exercises (organization_id);

-- Usuário autenticado não grava exercício global (organization_id NULL) nem em
-- outra organização — mesmo trigger das tabelas do tenant (Etapa 2).
DROP TRIGGER IF EXISTS trg_enforce_organization_id ON public.exercises;
CREATE TRIGGER trg_enforce_organization_id
  BEFORE INSERT OR UPDATE OF organization_id ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION private.enforce_organization_id();

-- Seed global: 8 estações oficiais do Hyrox (na ordem da prova) + movimentos
-- clássicos de CrossFit. Idempotente pelo nome.
INSERT INTO public.exercises (name, modality, metric, default_distance_m, default_reps, sort_order, organization_id)
SELECT v.name, v.modality, v.metric, v.default_distance_m, v.default_reps, v.sort_order, NULL::uuid
FROM (VALUES
  ('SkiErg',             'hyrox',    'distance', 1000, NULL, 1),
  ('Sled Push',          'hyrox',    'distance',   50, NULL, 2),
  ('Sled Pull',          'hyrox',    'distance',   50, NULL, 3),
  ('Burpee Broad Jump',  'hyrox',    'distance',   80, NULL, 4),
  ('Rowing',             'hyrox',    'distance', 1000, NULL, 5),
  ('Farmers Carry',      'hyrox',    'distance',  200, NULL, 6),
  ('Sandbag Lunges',     'hyrox',    'distance',  100, NULL, 7),
  ('Wall Balls',         'hyrox',    'reps',      NULL, 100, 8),
  ('Pull-up',            'crossfit', 'reps',      NULL, NULL, 10),
  ('Push-up',            'crossfit', 'reps',      NULL, NULL, 11),
  ('Air Squat',          'crossfit', 'reps',      NULL, NULL, 12),
  ('Burpee',             'crossfit', 'reps',      NULL, NULL, 13),
  ('Box Jump',           'crossfit', 'reps',      NULL, NULL, 14),
  ('Double Unders',      'crossfit', 'reps',      NULL, NULL, 15),
  ('Thruster',           'crossfit', 'load',      NULL, NULL, 16),
  ('Wall Ball',          'crossfit', 'reps',      NULL, NULL, 17),
  ('Kettlebell Swing',   'crossfit', 'reps',      NULL, NULL, 18),
  ('Toes-to-Bar',        'crossfit', 'reps',      NULL, NULL, 19),
  ('Handstand Push-up',  'crossfit', 'reps',      NULL, NULL, 20),
  ('Deadlift',           'crossfit', 'load',      NULL, NULL, 21),
  ('Clean',              'crossfit', 'load',      NULL, NULL, 22),
  ('Snatch',             'crossfit', 'load',      NULL, NULL, 23),
  ('Row',                'crossfit', 'distance',  NULL, NULL, 24)
) AS v(name, modality, metric, default_distance_m, default_reps, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises e
  WHERE e.organization_id IS NULL AND lower(e.name) = lower(v.name)
);

-- ─── 3. training_blocks ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.training_blocks (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id                uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  sort_order                 integer NOT NULL CHECK (sort_order >= 0),
  block_type                 text NOT NULL CHECK (block_type IN ('run', 'station', 'wod', 'rest')),
  exercise_id                uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  distance_m                 integer CHECK (distance_m IS NULL OR distance_m > 0),
  reps                       integer CHECK (reps IS NULL OR reps > 0),
  load_kg                    numeric(6, 2) CHECK (load_kg IS NULL OR load_kg > 0),
  duration_seconds           integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  target_pace_seconds_per_km integer CHECK (target_pace_seconds_per_km IS NULL OR target_pace_seconds_per_km > 0),
  rounds                     integer CHECK (rounds IS NULL OR rounds > 0),
  notes                      text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_blocks_training ON public.training_blocks (training_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_training_blocks_exercise ON public.training_blocks (exercise_id);

-- ─── 4. checkin_block_results ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checkin_block_results (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id              uuid NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  training_block_id       uuid NOT NULL REFERENCES public.training_blocks(id) ON DELETE CASCADE,
  actual_duration_seconds integer CHECK (actual_duration_seconds IS NULL OR actual_duration_seconds >= 0),
  actual_reps             integer CHECK (actual_reps IS NULL OR actual_reps >= 0),
  actual_load_kg          numeric(6, 2) CHECK (actual_load_kg IS NULL OR actual_load_kg >= 0),
  actual_distance_m       integer CHECK (actual_distance_m IS NULL OR actual_distance_m >= 0),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkin_block_results_checkin_block_key UNIQUE (checkin_id, training_block_id)
);

CREATE INDEX IF NOT EXISTS idx_checkin_block_results_block ON public.checkin_block_results (training_block_id);

DROP TRIGGER IF EXISTS set_checkin_block_results_updated_at ON public.checkin_block_results;
CREATE TRIGGER set_checkin_block_results_updated_at
  BEFORE UPDATE ON public.checkin_block_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 5. Helpers de RLS (SECURITY DEFINER: sem recursão de policies) ─────────

CREATE OR REPLACE FUNCTION private.training_in_my_org(p_training_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trainings t
    WHERE t.id = p_training_id AND t.organization_id = private.current_org_id()
  )
$$;

CREATE OR REPLACE FUNCTION private.exercise_visible(p_exercise_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.exercises e
    WHERE e.id = p_exercise_id
      AND (e.organization_id IS NULL OR e.organization_id = private.current_org_id())
  )
$$;

-- Dono do check-in (aluno logado).
CREATE OR REPLACE FUNCTION private.checkin_is_mine(p_checkin_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.id = p_checkin_id AND c.student_id = auth.uid()
  )
$$;

-- Check-in de aluno da organização do admin.
CREATE OR REPLACE FUNCTION private.checkin_in_my_org(p_checkin_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.id = p_checkin_id AND private.user_in_my_org(c.student_id)
  )
$$;

-- /preview-aluno: check-in do Aluno Demo da organização do admin.
CREATE OR REPLACE FUNCTION private.checkin_is_demo_in_my_org(p_checkin_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.id = p_checkin_id
      AND c.student_id = '00000000-0000-0000-0000-000000000000'::uuid
      AND private.user_in_my_org(c.student_id)
  )
$$;

-- O bloco tem que ser do treino daquele check-in (resultado coerente).
CREATE OR REPLACE FUNCTION private.block_matches_checkin(p_checkin_id uuid, p_block_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checkins c
    JOIN public.training_blocks b ON b.training_id = c.training_id
    WHERE c.id = p_checkin_id AND b.id = p_block_id
  )
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'private.training_in_my_org(uuid)',
    'private.exercise_visible(uuid)',
    'private.checkin_is_mine(uuid)',
    'private.checkin_in_my_org(uuid)',
    'private.checkin_is_demo_in_my_org(uuid)',
    'private.block_matches_checkin(uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END;
$$;

-- ─── 6. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_block_results ENABLE ROW LEVEL SECURITY;

-- exercises: todos leem globais + da própria org; admin gerencia só os da org.
DROP POLICY IF EXISTS exercises_select ON public.exercises;
CREATE POLICY exercises_select ON public.exercises
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS exercises_admin_all ON public.exercises;
CREATE POLICY exercises_admin_all ON public.exercises
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()))
  WITH CHECK ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

-- training_blocks: quem vê o treino vê os blocos; admin da org edita.
DROP POLICY IF EXISTS training_blocks_select ON public.training_blocks;
CREATE POLICY training_blocks_select ON public.training_blocks
  FOR SELECT TO authenticated
  USING (private.training_in_my_org(training_id));

DROP POLICY IF EXISTS training_blocks_admin_all ON public.training_blocks;
CREATE POLICY training_blocks_admin_all ON public.training_blocks
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()) AND private.training_in_my_org(training_id))
  WITH CHECK (
    (SELECT private.is_admin())
    AND private.training_in_my_org(training_id)
    AND (exercise_id IS NULL OR private.exercise_visible(exercise_id))
  );

-- checkin_block_results: aluno no próprio check-in; admin da org lê/corrige;
-- admin grava só no Aluno Demo (/preview-aluno), como em checkins.
DROP POLICY IF EXISTS checkin_block_results_owner ON public.checkin_block_results;
CREATE POLICY checkin_block_results_owner ON public.checkin_block_results
  FOR ALL TO authenticated
  USING (private.checkin_is_mine(checkin_id))
  WITH CHECK (private.checkin_is_mine(checkin_id) AND private.block_matches_checkin(checkin_id, training_block_id));

DROP POLICY IF EXISTS checkin_block_results_admin_select ON public.checkin_block_results;
CREATE POLICY checkin_block_results_admin_select ON public.checkin_block_results
  FOR SELECT TO authenticated
  USING ((SELECT private.is_admin()) AND private.checkin_in_my_org(checkin_id));

DROP POLICY IF EXISTS checkin_block_results_admin_update ON public.checkin_block_results;
CREATE POLICY checkin_block_results_admin_update ON public.checkin_block_results
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()) AND private.checkin_in_my_org(checkin_id))
  WITH CHECK (
    (SELECT private.is_admin())
    AND private.checkin_in_my_org(checkin_id)
    AND private.block_matches_checkin(checkin_id, training_block_id)
  );

DROP POLICY IF EXISTS checkin_block_results_admin_delete ON public.checkin_block_results;
CREATE POLICY checkin_block_results_admin_delete ON public.checkin_block_results
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()) AND private.checkin_in_my_org(checkin_id));

DROP POLICY IF EXISTS "Admin grava resultados do Aluno Demo" ON public.checkin_block_results;
CREATE POLICY "Admin grava resultados do Aluno Demo" ON public.checkin_block_results
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()) AND private.checkin_is_demo_in_my_org(checkin_id))
  WITH CHECK (
    (SELECT private.is_admin())
    AND private.checkin_is_demo_in_my_org(checkin_id)
    AND private.block_matches_checkin(checkin_id, training_block_id)
  );

-- ─── 7. GRANTs (sem GRANT o cliente recebe 42501 mesmo com policy) ──────────

REVOKE ALL ON TABLE public.exercises FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.training_blocks FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.checkin_block_results FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.training_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkin_block_results TO authenticated;
GRANT SELECT ON TABLE public.exercises TO service_role;
GRANT SELECT ON TABLE public.training_blocks TO service_role;
GRANT SELECT ON TABLE public.checkin_block_results TO service_role;

-- ─── 8. RPC save_training_blocks ────────────────────────────────────────────
-- Salva a lista de blocos de um treino numa transação só. SECURITY INVOKER: as
-- policies acima valem (só admin da org do treino).
-- NÃO apaga e recria tudo: blocos com id existente são ATUALIZADOS (os
-- resultados dos alunos — checkin_block_results — continuam ligados a eles);
-- só os blocos retirados da lista são removidos. Um id de outro treino é
-- ignorado (vira bloco novo). Ordem = posição no array.
CREATE OR REPLACE FUNCTION public.save_training_blocks(p_training_id uuid, p_blocks jsonb)
RETURNS SETOF public.training_blocks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  pos integer;
  block_id uuid;
  kept uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_blocks IS NULL OR jsonb_typeof(p_blocks) <> 'array' THEN
    RAISE EXCEPTION 'p_blocks deve ser um array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_blocks) > 60 THEN
    RAISE EXCEPTION 'Máximo de 60 blocos por treino' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trainings t WHERE t.id = p_training_id) THEN
    RAISE EXCEPTION 'Treino não encontrado' USING ERRCODE = '42501';
  END IF;

  FOR item, pos IN
    SELECT value, ordinality::integer - 1 FROM jsonb_array_elements(p_blocks) WITH ORDINALITY
  LOOP
    block_id := NULL;

    IF item ? 'id' AND (item ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      UPDATE public.training_blocks b
      SET sort_order = pos,
          block_type = item ->> 'block_type',
          exercise_id = NULLIF(item ->> 'exercise_id', '')::uuid,
          distance_m = NULLIF(item ->> 'distance_m', '')::integer,
          reps = NULLIF(item ->> 'reps', '')::integer,
          load_kg = NULLIF(item ->> 'load_kg', '')::numeric,
          duration_seconds = NULLIF(item ->> 'duration_seconds', '')::integer,
          target_pace_seconds_per_km = NULLIF(item ->> 'target_pace_seconds_per_km', '')::integer,
          rounds = NULLIF(item ->> 'rounds', '')::integer,
          notes = NULLIF(item ->> 'notes', '')
      WHERE b.id = (item ->> 'id')::uuid AND b.training_id = p_training_id
      RETURNING b.id INTO block_id;
    END IF;

    IF block_id IS NULL THEN
      INSERT INTO public.training_blocks (
        training_id, sort_order, block_type, exercise_id, distance_m, reps, load_kg,
        duration_seconds, target_pace_seconds_per_km, rounds, notes
      ) VALUES (
        p_training_id, pos, item ->> 'block_type',
        NULLIF(item ->> 'exercise_id', '')::uuid,
        NULLIF(item ->> 'distance_m', '')::integer,
        NULLIF(item ->> 'reps', '')::integer,
        NULLIF(item ->> 'load_kg', '')::numeric,
        NULLIF(item ->> 'duration_seconds', '')::integer,
        NULLIF(item ->> 'target_pace_seconds_per_km', '')::integer,
        NULLIF(item ->> 'rounds', '')::integer,
        NULLIF(item ->> 'notes', '')
      )
      RETURNING id INTO block_id;
    END IF;

    kept := kept || block_id;
  END LOOP;

  DELETE FROM public.training_blocks b
  WHERE b.training_id = p_training_id AND NOT (b.id = ANY (kept));

  RETURN QUERY
    SELECT * FROM public.training_blocks b
    WHERE b.training_id = p_training_id
    ORDER BY b.sort_order;
END;
$$;

REVOKE ALL ON FUNCTION public.save_training_blocks(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_training_blocks(uuid, jsonb) TO authenticated;
