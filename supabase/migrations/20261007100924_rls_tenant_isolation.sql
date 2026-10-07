-- Etapa 3 do white-label: isolamento de LEITURA (e escrita) por organização.
--
-- Antes: toda policy de admin era só `private.is_admin()` → um professor de
-- qualquer assessoria via/editava alunos, turmas, treinos e mensagens de todas.
-- E várias leituras eram `USING (true)` para qualquer usuário logado
-- (trainings, tags, training_types, training_programs, comments, reactions) ou
-- `is_active = true` (groups) → vazavam entre assessorias.
--
-- Depois: admin só alcança linhas da PRÓPRIA organização
-- (private.current_org_id(), claim app_metadata.org_id do JWT); leituras
-- abertas passam a ser "da minha organização". Regras do próprio aluno
-- (student_id = auth.uid()) não mudam — já eram restritas ao dono.
--
-- Para a Arbo (única organização hoje) o comportamento é idêntico: todo mundo
-- está na mesma organização. Nomes das policies foram mantidos.
--
-- Sem claim org_id no JWT, current_org_id() é NULL e as comparações dão falso:
-- falha FECHADA (nada é liberado). Todos os usuários receberam a claim na
-- migration 20261007095224; tokens são renovados a cada 1h.
--
-- Tabelas sem organization_id herdam a organização:
--   aluno (student_id/user_id/author_id) → profiles.organization_id
--   group_plans → groups; group_plan_trainings → group_plans → groups
--   weekly_plan_trainings → weekly_plans → profiles

-- ─── 1. Helpers ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER para ler profiles/groups sem depender das policies dessas
-- tabelas (evita recursão de RLS). Sempre comparando com current_org_id().

CREATE OR REPLACE FUNCTION private.user_in_my_org(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.organization_id = private.current_org_id()
  )
$$;

CREATE OR REPLACE FUNCTION private.group_in_my_org(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = p_group_id
      AND g.organization_id = private.current_org_id()
  )
$$;

CREATE OR REPLACE FUNCTION private.group_plan_in_my_org(p_group_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_plans gp
    JOIN public.groups g ON g.id = gp.group_id
    WHERE gp.id = p_group_plan_id
      AND g.organization_id = private.current_org_id()
  )
$$;

CREATE OR REPLACE FUNCTION private.weekly_plan_in_my_org(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.weekly_plans wp
    JOIN public.profiles p ON p.id = wp.student_id
    WHERE wp.id = p_plan_id
      AND p.organization_id = private.current_org_id()
  )
$$;

REVOKE ALL ON FUNCTION private.user_in_my_org(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.group_in_my_org(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.group_plan_in_my_org(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.weekly_plan_in_my_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.user_in_my_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.group_in_my_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.group_plan_in_my_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.weekly_plan_in_my_org(uuid) TO authenticated, service_role;

-- ─── 2. Tabelas com organization_id ─────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()))
  );

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()))
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()))
  );

DROP POLICY IF EXISTS profiles_delete ON public.profiles;
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

-- groups
DROP POLICY IF EXISTS admin_all_groups ON public.groups;
CREATE POLICY admin_all_groups ON public.groups
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()))
  WITH CHECK ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS aluno_select_groups ON public.groups;
CREATE POLICY aluno_select_groups ON public.groups
  FOR SELECT TO authenticated
  USING (is_active = true AND organization_id = (SELECT private.current_org_id()));

-- trainings
DROP POLICY IF EXISTS trainings_select ON public.trainings;
CREATE POLICY trainings_select ON public.trainings
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS trainings_insert ON public.trainings;
CREATE POLICY trainings_insert ON public.trainings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS trainings_update ON public.trainings;
CREATE POLICY trainings_update ON public.trainings
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()))
  WITH CHECK ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS trainings_delete ON public.trainings;
CREATE POLICY trainings_delete ON public.trainings
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

-- training_programs
DROP POLICY IF EXISTS "Admins gerenciam programas" ON public.training_programs;
CREATE POLICY "Admins gerenciam programas" ON public.training_programs
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()))
  WITH CHECK ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS "Todos autenticados leem programas" ON public.training_programs;
CREATE POLICY "Todos autenticados leem programas" ON public.training_programs
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_org_id()));

-- tags (antes TO public)
DROP POLICY IF EXISTS "Admin pode tudo" ON public.tags;
CREATE POLICY "Admin pode tudo" ON public.tags
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()))
  WITH CHECK ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS "Aluno pode ler" ON public.tags;
CREATE POLICY "Aluno pode ler" ON public.tags
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_org_id()));

-- training_types
DROP POLICY IF EXISTS "Admin full access training_types" ON public.training_types;
CREATE POLICY "Admin full access training_types" ON public.training_types
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()))
  WITH CHECK ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS "Alunos select training_types" ON public.training_types;
CREATE POLICY "Alunos select training_types" ON public.training_types
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_org_id()));

-- invites (antes TO public)
DROP POLICY IF EXISTS "Admins podem ver convites" ON public.invites;
CREATE POLICY "Admins podem ver convites" ON public.invites
  FOR SELECT TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS "Admins podem inserir convites" ON public.invites;
CREATE POLICY "Admins podem inserir convites" ON public.invites
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS "Admins podem atualizar convites" ON public.invites;
CREATE POLICY "Admins podem atualizar convites" ON public.invites
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()))
  WITH CHECK ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

DROP POLICY IF EXISTS "Admins podem deletar convites" ON public.invites;
CREATE POLICY "Admins podem deletar convites" ON public.invites
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()) AND organization_id = (SELECT private.current_org_id()));

-- ─── 3. Dados do aluno (organização herdada de profiles) ────────────────────

-- anamnesis
DROP POLICY IF EXISTS anamnesis_select ON public.anamnesis;
CREATE POLICY anamnesis_select ON public.anamnesis
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND private.user_in_my_org(user_id))
  );

DROP POLICY IF EXISTS anamnesis_delete ON public.anamnesis;
CREATE POLICY anamnesis_delete ON public.anamnesis
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()) AND private.user_in_my_org(user_id));

-- checkins
DROP POLICY IF EXISTS checkins_select ON public.checkins;
CREATE POLICY checkins_select ON public.checkins
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND private.user_in_my_org(student_id))
  );

DROP POLICY IF EXISTS checkins_update ON public.checkins;
CREATE POLICY checkins_update ON public.checkins
  FOR UPDATE TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND private.user_in_my_org(student_id))
  )
  WITH CHECK (
    student_id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND private.user_in_my_org(student_id))
  );

DROP POLICY IF EXISTS checkins_delete ON public.checkins;
CREATE POLICY checkins_delete ON public.checkins
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()) AND private.user_in_my_org(student_id));

-- /preview-aluno: só admin da organização do Aluno Demo (Arbo).
DROP POLICY IF EXISTS "Admin insere checkin do Aluno Demo" ON public.checkins;
CREATE POLICY "Admin insere checkin do Aluno Demo" ON public.checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_admin())
    AND student_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND private.user_in_my_org(student_id)
  );

-- records
DROP POLICY IF EXISTS records_select ON public.records;
CREATE POLICY records_select ON public.records
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND private.user_in_my_org(student_id))
  );

DROP POLICY IF EXISTS records_update ON public.records;
CREATE POLICY records_update ON public.records
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()) AND private.user_in_my_org(student_id))
  WITH CHECK ((SELECT private.is_admin()) AND private.user_in_my_org(student_id));

DROP POLICY IF EXISTS records_delete ON public.records;
CREATE POLICY records_delete ON public.records
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()) AND private.user_in_my_org(student_id));

-- schedules
DROP POLICY IF EXISTS "Admin lê schedules" ON public.schedules;
CREATE POLICY "Admin lê schedules" ON public.schedules
  FOR SELECT TO authenticated
  USING ((SELECT private.is_admin()) AND private.user_in_my_org(student_id));

DROP POLICY IF EXISTS "Admin escreve schedules do Aluno Demo" ON public.schedules;
CREATE POLICY "Admin escreve schedules do Aluno Demo" ON public.schedules
  FOR ALL TO authenticated
  USING (
    (SELECT private.is_admin())
    AND student_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND private.user_in_my_org(student_id)
  )
  WITH CHECK (
    (SELECT private.is_admin())
    AND student_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND private.user_in_my_org(student_id)
  );

-- strava_activities
DROP POLICY IF EXISTS strava_activities_select ON public.strava_activities;
CREATE POLICY strava_activities_select ON public.strava_activities
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND private.user_in_my_org(user_id))
  );

DROP POLICY IF EXISTS strava_activities_delete ON public.strava_activities;
CREATE POLICY strava_activities_delete ON public.strava_activities
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()) AND private.user_in_my_org(user_id));

-- strava_analysis
DROP POLICY IF EXISTS strava_analysis_select ON public.strava_analysis;
CREATE POLICY strava_analysis_select ON public.strava_analysis
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND private.user_in_my_org(student_id))
  );

-- weekly_plans
DROP POLICY IF EXISTS weekly_plans_select ON public.weekly_plans;
CREATE POLICY weekly_plans_select ON public.weekly_plans
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND private.user_in_my_org(student_id))
  );

DROP POLICY IF EXISTS weekly_plans_insert ON public.weekly_plans;
CREATE POLICY weekly_plans_insert ON public.weekly_plans
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()) AND private.user_in_my_org(student_id));

DROP POLICY IF EXISTS weekly_plans_update ON public.weekly_plans;
CREATE POLICY weekly_plans_update ON public.weekly_plans
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()) AND private.user_in_my_org(student_id))
  WITH CHECK ((SELECT private.is_admin()) AND private.user_in_my_org(student_id));

DROP POLICY IF EXISTS weekly_plans_delete ON public.weekly_plans;
CREATE POLICY weekly_plans_delete ON public.weekly_plans
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()) AND private.user_in_my_org(student_id));

-- weekly_plan_trainings (organização via weekly_plans → profiles)
DROP POLICY IF EXISTS weekly_plan_trainings_select ON public.weekly_plan_trainings;
CREATE POLICY weekly_plan_trainings_select ON public.weekly_plan_trainings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_plans wp
      WHERE wp.id = weekly_plan_trainings.plan_id
        AND wp.student_id = (SELECT auth.uid())
    )
    OR ((SELECT private.is_admin()) AND private.weekly_plan_in_my_org(plan_id))
  );

DROP POLICY IF EXISTS weekly_plan_trainings_insert ON public.weekly_plan_trainings;
CREATE POLICY weekly_plan_trainings_insert ON public.weekly_plan_trainings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()) AND private.weekly_plan_in_my_org(plan_id));

DROP POLICY IF EXISTS weekly_plan_trainings_update ON public.weekly_plan_trainings;
CREATE POLICY weekly_plan_trainings_update ON public.weekly_plan_trainings
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()) AND private.weekly_plan_in_my_org(plan_id))
  WITH CHECK ((SELECT private.is_admin()) AND private.weekly_plan_in_my_org(plan_id));

DROP POLICY IF EXISTS weekly_plan_trainings_delete ON public.weekly_plan_trainings;
CREATE POLICY weekly_plan_trainings_delete ON public.weekly_plan_trainings
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()) AND private.weekly_plan_in_my_org(plan_id));

-- messages (chat aluno ↔ professor) — regras do aluno inalteradas
DROP POLICY IF EXISTS admin_select_messages ON public.messages;
CREATE POLICY admin_select_messages ON public.messages
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_admin())
    AND deleted_by_admin = false
    AND private.user_in_my_org(student_id)
  );

DROP POLICY IF EXISTS admin_insert_messages ON public.messages;
CREATE POLICY admin_insert_messages ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_admin())
    AND sender_id = (SELECT auth.uid())
    AND private.user_in_my_org(student_id)
  );

DROP POLICY IF EXISTS admin_update_messages ON public.messages;
CREATE POLICY admin_update_messages ON public.messages
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()) AND private.user_in_my_org(student_id))
  WITH CHECK ((SELECT private.is_admin()) AND private.user_in_my_org(student_id));

-- comments / reactions (sem uso no frontend hoje; leitura era USING true)
DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments
  FOR SELECT TO authenticated
  USING (private.user_in_my_org(author_id));

DROP POLICY IF EXISTS comments_delete ON public.comments;
CREATE POLICY comments_delete ON public.comments
  FOR DELETE TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR ((SELECT private.is_admin()) AND private.user_in_my_org(author_id))
  );

DROP POLICY IF EXISTS reactions_select ON public.reactions;
CREATE POLICY reactions_select ON public.reactions
  FOR SELECT TO authenticated
  USING (private.user_in_my_org(user_id));

-- ─── 4. Turmas: planos de grupo (organização via groups) ────────────────────
-- Políticas de leitura do aluno (aluno_select_group_plans/_trainings) não
-- mudam: já são restritas à turma do próprio aluno.

DROP POLICY IF EXISTS admin_all_group_plans ON public.group_plans;
CREATE POLICY admin_all_group_plans ON public.group_plans
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()) AND private.group_in_my_org(group_id))
  WITH CHECK ((SELECT private.is_admin()) AND private.group_in_my_org(group_id));

DROP POLICY IF EXISTS admin_all_group_plan_trainings ON public.group_plan_trainings;
CREATE POLICY admin_all_group_plan_trainings ON public.group_plan_trainings
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()) AND private.group_plan_in_my_org(group_plan_id))
  WITH CHECK ((SELECT private.is_admin()) AND private.group_plan_in_my_org(group_plan_id));

-- ─── 5. RPC get_user_email ──────────────────────────────────────────────────
-- Antes: checava profiles.role = 'admin' (qualquer admin, qualquer usuário).
-- Agora: admin pelo JWT (app_metadata) e só para usuários da própria org.
CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_email text;
BEGIN
  IF NOT private.is_admin() OR NOT private.user_in_my_org(user_id) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  SELECT u.email INTO user_email FROM auth.users u WHERE u.id = user_id;
  RETURN user_email;
END;
$$;
