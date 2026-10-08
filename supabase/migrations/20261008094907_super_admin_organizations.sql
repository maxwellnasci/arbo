-- Painel Super Admin: dono da plataforma (Max) lista e cadastra assessorias.
--
-- `is_super_admin` é uma claim em app_metadata (só o servidor escreve). Ela dá
-- APENAS dois poderes: ver todas as linhas de `organizations` e inserir novas.
-- Não muda nenhuma outra policy — o super admin continua sendo, para todo o
-- resto, um admin comum da própria organização (Arbo).
-- O fluxo completo de onboarding (assessoria + convite do professor) roda na
-- Edge Function `create-organization` com service_role; as policies abaixo
-- servem para a tela listar as assessorias.

-- ─── 1. Helper ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_super_admin', '') = 'true'
$$;

REVOKE ALL ON FUNCTION private.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_super_admin() TO authenticated, service_role;

-- ─── 2. Claim na conta do dono da plataforma ────────────────────────────────
-- Vale a partir do próximo token (login de novo ou refresh automático em ≤ 1 h).

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"is_super_admin": true}'::jsonb
WHERE lower(email) = 'maxwellngg@gmail.com';

-- ─── 3. Policies de organizations ───────────────────────────────────────────
-- Somam-se (OR) às policies existentes (membro lê a própria, admin edita a própria).

DROP POLICY IF EXISTS organizations_super_admin_select ON public.organizations;
CREATE POLICY organizations_super_admin_select ON public.organizations
  FOR SELECT TO authenticated
  USING ((SELECT private.is_super_admin()));

DROP POLICY IF EXISTS organizations_super_admin_insert ON public.organizations;
CREATE POLICY organizations_super_admin_insert ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_super_admin()));

-- INSERT para authenticated só serve ao super admin (a policy acima barra o
-- resto). Sem GRANT o Postgres recusaria antes de olhar a policy (42501).
GRANT INSERT ON TABLE public.organizations TO authenticated;
