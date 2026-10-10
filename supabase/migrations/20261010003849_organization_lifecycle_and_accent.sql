-- Gestão completa de clientes (Painel Super Admin) + cor de destaque.
--
--   1. organizations.is_active (pausar/reativar) e accent_color.
--   2. Super admin pode editar e excluir qualquer organização.
--   3. Proteções: a Arbo (org padrão, vitrine) não pode ser excluída nem ter o
--      slug trocado; admin de assessoria só edita os campos de MARCA da
--      própria org — name/slug/is_active são do super admin (sem isso um
--      cliente pausado conseguiria se reativar sozinho).
--   4. Pausa com efeito real no banco: current_org_id() devolve NULL para org
--      pausada → todas as policies por organização fecham (falha fechada). O
--      super admin é exceção. O usuário da org pausada ainda lê a própria
--      linha de organizations (organizations_select_own usa resolve_org_id,
--      que cai no perfil) — é o que a tela "Assessoria pausada" usa.
--   5. get_brand_by_slug devolve accent_color e is_active.
--   6. delete_organization_cascade(): exclusão transacional de uma org com
--      todos os dados e contas — só service_role (Edge Function
--      delete-organization, que exige is_super_admin).

-- ─── 1. Colunas ─────────────────────────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accent_color text;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_accent_color_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_accent_color_check CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$');

-- ─── 2. Policies do super admin ─────────────────────────────────────────────

DROP POLICY IF EXISTS organizations_super_admin_update ON public.organizations;
CREATE POLICY organizations_super_admin_update ON public.organizations
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_super_admin()))
  WITH CHECK ((SELECT private.is_super_admin()));

DROP POLICY IF EXISTS organizations_super_admin_delete ON public.organizations;
CREATE POLICY organizations_super_admin_delete ON public.organizations
  FOR DELETE TO authenticated
  USING ((SELECT private.is_super_admin()));

-- UPDATE já era concedido; DELETE só passa pela policy acima (super admin).
GRANT UPDATE, DELETE ON TABLE public.organizations TO authenticated;

-- ─── 3. Proteções ───────────────────────────────────────────────────────────

-- Arbo (vitrine): nunca excluída.
CREATE OR REPLACE FUNCTION private.protect_arbo_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.id = private.default_org_id() OR OLD.slug = 'arbo' THEN
    RAISE EXCEPTION 'A organização padrão Arbo Run não pode ser excluída' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_arbo_default ON public.organizations;
CREATE TRIGGER trg_protect_arbo_default
  BEFORE DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION private.protect_arbo_default();

-- Campos sensíveis: slug da Arbo nunca muda (link /a/arbo); name/slug/
-- is_active só pelo super admin (ou servidor sem JWT de usuário).
CREATE OR REPLACE FUNCTION private.protect_organization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.id = private.default_org_id() AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'O slug da organização padrão (arbo) não pode ser alterado' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Não é permitido alterar o id da organização' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(auth.jwt() ->> 'role', '') = 'authenticated' AND NOT private.is_super_admin() THEN
    IF NEW.name IS DISTINCT FROM OLD.name
       OR NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Só o dono da plataforma altera nome, slug ou status da assessoria' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_organization_fields ON public.organizations;
CREATE TRIGGER trg_protect_organization_fields
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION private.protect_organization_fields();

-- ─── 4. Pausa com efeito no banco ───────────────────────────────────────────
-- Antes: só lia a claim. Agora a claim só vale se a org estiver ativa (ou se
-- quem chama for super admin). SECURITY DEFINER lê organizations sem passar
-- pelas policies (que chamam esta função — evita recursão).

CREATE OR REPLACE FUNCTION private.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH claim AS (
    SELECT CASE
      WHEN (auth.jwt() -> 'app_metadata' ->> 'org_id')
           ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    END AS org_id
  )
  SELECT c.org_id
  FROM claim c
  WHERE c.org_id IS NOT NULL
    AND (
      private.is_super_admin()
      OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = c.org_id AND o.is_active)
    )
$$;

-- ─── 5. Marca pública por slug (login /a/:slug) ─────────────────────────────
-- Tipo de retorno muda → DROP + CREATE.

DROP FUNCTION IF EXISTS public.get_brand_by_slug(text);
CREATE FUNCTION public.get_brand_by_slug(p_slug text)
RETURNS TABLE (
  slug text,
  name text,
  brand_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.slug, o.name, o.brand_name, o.logo_url, o.primary_color, o.secondary_color, o.accent_color, o.is_active
  FROM public.organizations o
  WHERE o.slug = lower(trim(p_slug))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_brand_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_brand_by_slug(text) TO anon, authenticated, service_role;

-- ─── 6. Exclusão transacional de uma organização ────────────────────────────
-- Ordem pensada nas FKs reais (NO ACTION/RESTRICT bloqueariam):
--   check-ins/recordes dos alunos → planos semanais → turmas (CASCADE em
--   planos de turma/agendamentos) → treinos (CASCADE em blocos) → bibliotecas,
--   tags, tipos, convites → referências soltas (comentários, reações,
--   approved_by) → contas em auth.users (CASCADE no resto do aluno) → org
--   (CASCADE em exercises). Qualquer erro aborta tudo.

CREATE OR REPLACE FUNCTION public.delete_organization_cascade(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  org record;
  members uuid[];
  n_users int;
  n_trainings int;
  n_groups int;
BEGIN
  SELECT id, name, slug INTO org FROM public.organizations WHERE id = p_org_id;
  IF org.id IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF org.id = private.default_org_id() OR org.slug = 'arbo' THEN
    RAISE EXCEPTION 'A organização padrão Arbo Run não pode ser excluída' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO members
  FROM public.profiles p WHERE p.organization_id = p_org_id;

  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = ANY (members) AND u.raw_app_meta_data ->> 'is_super_admin' = 'true'
  ) THEN
    RAISE EXCEPTION 'A organização tem um super admin — exclusão bloqueada' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.records WHERE student_id = ANY (members);
  DELETE FROM public.checkins WHERE student_id = ANY (members);
  DELETE FROM public.weekly_plans WHERE student_id = ANY (members) OR created_by = ANY (members);

  DELETE FROM public.groups WHERE organization_id = p_org_id;
  GET DIAGNOSTICS n_groups = ROW_COUNT;
  DELETE FROM public.trainings WHERE organization_id = p_org_id;
  GET DIAGNOSTICS n_trainings = ROW_COUNT;
  DELETE FROM public.training_programs WHERE organization_id = p_org_id;
  DELETE FROM public.tags WHERE organization_id = p_org_id;
  DELETE FROM public.training_types WHERE organization_id = p_org_id;
  DELETE FROM public.invites WHERE organization_id = p_org_id;

  DELETE FROM public.comments WHERE author_id = ANY (members);
  DELETE FROM public.reactions WHERE user_id = ANY (members);
  UPDATE public.checkins SET approved_by = NULL WHERE approved_by = ANY (members);
  UPDATE public.training_types SET created_by = NULL WHERE created_by = ANY (members);

  DELETE FROM auth.users WHERE id = ANY (members);
  GET DIAGNOSTICS n_users = ROW_COUNT;

  DELETE FROM public.organizations WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'organization_id', org.id,
    'slug', org.slug,
    'users_deleted', n_users,
    'trainings_deleted', n_trainings,
    'groups_deleted', n_groups
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_organization_cascade(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_organization_cascade(uuid) TO service_role;
