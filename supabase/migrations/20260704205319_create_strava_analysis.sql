CREATE TABLE IF NOT EXISTS strava_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id bigint NOT NULL,
  activity_name text NOT NULL,
  distance_m integer NOT NULL,
  moving_time_seconds integer NOT NULL,
  average_speed float NOT NULL,
  summary text NOT NULL,
  analysis text NOT NULL,
  tip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, activity_id)
);

-- Suporta "última análise do aluno" (admin) sem varrer a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_strava_analysis_student_id ON strava_analysis (student_id, created_at DESC);

ALTER TABLE strava_analysis ENABLE ROW LEVEL SECURITY;

-- Policy única combinando dono + admin via private.is_admin() — mesmo padrão
-- usado em profiles/anamnesis/weekly_plans (nunca reimplementar a checagem de
-- role com subquery em profiles: private.is_admin() já existe e evita RLS
-- recursiva ao ler a própria tabela profiles).
CREATE POLICY "strava_analysis_select" ON strava_analysis
FOR SELECT TO authenticated
USING (
  student_id = (SELECT auth.uid())
  OR (SELECT private.is_admin())
);

-- GRANT de tabela é uma camada separada da policy de RLS — sem esta linha,
-- tanto aluno quanto admin receberiam "permission denied" (42501) mesmo com a
-- policy acima correta. Mesma classe de bug do incidente strava_connections/
-- service_role documentado no ARBO_FASE3.md (item 6, 2026-07-04).
GRANT SELECT ON strava_analysis TO authenticated;

-- Toda escrita (INSERT/UPSERT) acontece via Edge Function com service_role;
-- authenticated nunca escreve direto nesta tabela.
GRANT SELECT, INSERT, UPDATE ON strava_analysis TO service_role;
