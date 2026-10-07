-- Etapa 2 do white-label: fundação multi-tenant (SaaS compartilhado).
--
-- Cria `organizations` (assessoria/box = tenant, com os dados de marca), liga as
-- tabelas que pertencem a um tenant via `organization_id` e coloca TUDO o que
-- existe hoje na organização padrão "Arbo Run" (slug `arbo`).
--
-- Compatibilidade: nenhuma policy de RLS existente muda nesta etapa — o app
-- continua funcionando exatamente como hoje para a Arbo. O isolamento de LEITURA
-- entre organizações (reescrever as policies com organization_id) é a Etapa 3.
-- O que já entra aqui é o isolamento de ESCRITA do organization_id: um usuário
-- autenticado não consegue gravar linha em outra organização nem mover uma
-- linha de organização (trg_enforce_organization_id).
--
-- Tabelas com organization_id: profiles, groups, trainings, training_programs,
-- tags, training_types, invites. As demais (checkins, messages, schedules, ...)
-- herdam a organização pelo aluno/turma e não precisam da coluna.

-- ─── 1. Tabela organizations ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  -- usado no link de acesso /a/:slug/login
  slug               text NOT NULL UNIQUE
                     CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'),
  brand_name         text CHECK (char_length(brand_name) <= 80),
  logo_url           text CHECK (logo_url ~ '^https://'),
  primary_color      text NOT NULL DEFAULT '#E8521A'
                     CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color    text CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  -- nome/tom com que a IA (strava-analyze) assina e fala com o aluno
  coach_display_name text CHECK (char_length(coach_display_name) <= 80),
  ai_tone            text CHECK (char_length(ai_tone) <= 500),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizations IS 'Tenant (assessoria/box) do Arbo white-label. Toda linha de profiles/groups/trainings/training_programs/tags/training_types/invites pertence a uma organização.';

DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Organização padrão: UUID fixo para poder ser referenciado com segurança em
-- defaults e funções (o slug pode ser renomeado no futuro, o id não).
INSERT INTO public.organizations (id, name, slug, brand_name, primary_color)
VALUES ('00000000-0000-4000-a000-000000000001', 'Arbo Run', 'arbo', 'Arbo Run', '#E8521A')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Helpers de organização (schema private) ─────────────────────────────

CREATE OR REPLACE FUNCTION private.default_org_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT '00000000-0000-4000-a000-000000000001'::uuid
$$;

-- Organização do usuário segundo o JWT (app_metadata.org_id — só o servidor
-- escreve app_metadata). Barato e sem tocar em tabela: é a função para usar nas
-- policies de RLS da Etapa 3, sempre como (SELECT private.current_org_id()).
-- Retorna NULL se a claim não existir ou não for um UUID válido.
CREATE OR REPLACE FUNCTION private.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (auth.jwt() -> 'app_metadata' ->> 'org_id')
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  END
$$;

REVOKE ALL ON FUNCTION private.default_org_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.default_org_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_org_id() TO authenticated, service_role;

-- ─── 3. organization_id nas tabelas do tenant ───────────────────────────────
-- ADD COLUMN com DEFAULT constante preenche as linhas existentes sem UPDATE
-- (não dispara triggers de updated_at nem os de proteção). Depois o default
-- passa a ser resolve_org_id(), então o frontend não precisa enviar o campo.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
  DEFAULT '00000000-0000-4000-a000-000000000001'
  REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
  DEFAULT '00000000-0000-4000-a000-000000000001'
  REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
  DEFAULT '00000000-0000-4000-a000-000000000001'
  REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.training_programs
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
  DEFAULT '00000000-0000-4000-a000-000000000001'
  REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
  DEFAULT '00000000-0000-4000-a000-000000000001'
  REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.training_types
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
  DEFAULT '00000000-0000-4000-a000-000000000001'
  REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
  DEFAULT '00000000-0000-4000-a000-000000000001'
  REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- Organização efetiva para gravação: JWT → perfil do usuário → organização
-- padrão. O fallback pelo perfil cobre tokens emitidos antes desta migration
-- (sem a claim até o próximo refresh); o fallback padrão cobre inserts sem
-- usuário (trigger de cadastro, Edge Functions com service_role).
-- ATENÇÃO (próximas etapas): com mais de uma organização, Edge Functions que
-- inserem com service_role (ex.: invite-user → invites) devem informar
-- organization_id explicitamente, senão a linha cai na organização padrão.
CREATE OR REPLACE FUNCTION private.resolve_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    private.current_org_id(),
    (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()),
    private.default_org_id()
  )
$$;

REVOKE ALL ON FUNCTION private.resolve_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.resolve_org_id() TO authenticated, service_role;

ALTER TABLE public.profiles          ALTER COLUMN organization_id SET DEFAULT private.resolve_org_id();
ALTER TABLE public.groups            ALTER COLUMN organization_id SET DEFAULT private.resolve_org_id();
ALTER TABLE public.trainings         ALTER COLUMN organization_id SET DEFAULT private.resolve_org_id();
ALTER TABLE public.training_programs ALTER COLUMN organization_id SET DEFAULT private.resolve_org_id();
ALTER TABLE public.tags              ALTER COLUMN organization_id SET DEFAULT private.resolve_org_id();
ALTER TABLE public.training_types    ALTER COLUMN organization_id SET DEFAULT private.resolve_org_id();
ALTER TABLE public.invites           ALTER COLUMN organization_id SET DEFAULT private.resolve_org_id();

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id          ON public.profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_groups_organization_id            ON public.groups (organization_id);
CREATE INDEX IF NOT EXISTS idx_trainings_organization_id         ON public.trainings (organization_id);
CREATE INDEX IF NOT EXISTS idx_training_programs_organization_id ON public.training_programs (organization_id);
CREATE INDEX IF NOT EXISTS idx_tags_organization_id              ON public.tags (organization_id);
CREATE INDEX IF NOT EXISTS idx_training_types_organization_id    ON public.training_types (organization_id);
CREATE INDEX IF NOT EXISTS idx_invites_organization_id           ON public.invites (organization_id);

-- Unicidade passa a valer por organização (dois boxes podem ter um tipo
-- "Hyrox" ou uma biblioteca "base"). Com uma só organização o comportamento é
-- idêntico — o frontend só trata o erro 23505, que continua sendo o mesmo.
ALTER TABLE public.training_types DROP CONSTRAINT IF EXISTS training_types_name_unique;
ALTER TABLE public.training_types DROP CONSTRAINT IF EXISTS training_types_org_name_key;
ALTER TABLE public.training_types
  ADD CONSTRAINT training_types_org_name_key UNIQUE (organization_id, name);

ALTER TABLE public.training_programs DROP CONSTRAINT IF EXISTS training_programs_slug_key;
ALTER TABLE public.training_programs DROP CONSTRAINT IF EXISTS training_programs_org_slug_key;
ALTER TABLE public.training_programs
  ADD CONSTRAINT training_programs_org_slug_key UNIQUE (organization_id, slug);

-- ─── 4. Isolamento de escrita do organization_id ────────────────────────────
-- Para quem chega pela API como `authenticated`: no INSERT a linha tem que ser
-- da própria organização; no UPDATE o organization_id não pode mudar (nem por
-- admin — mover dado entre tenants é operação de servidor). service_role,
-- triggers de cadastro e migrations (sem JWT de usuário) passam direto.

CREATE OR REPLACE FUNCTION private.enforce_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.organization_id IS DISTINCT FROM private.resolve_org_id() THEN
      RAISE EXCEPTION 'Não autorizado a gravar em outra organização'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Não autorizado a alterar organization_id'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'groups', 'trainings', 'training_programs', 'tags', 'training_types', 'invites']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_organization_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_organization_id
         BEFORE INSERT OR UPDATE OF organization_id ON public.%I
         FOR EACH ROW EXECUTE FUNCTION private.enforce_organization_id()',
      t
    );
  END LOOP;
END;
$$;

-- ─── 5. Claim app_metadata.org_id no JWT ────────────────────────────────────

-- 5a. Usuários existentes (9 em produção) → organização padrão.
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('org_id', p.organization_id)
FROM public.profiles p
WHERE p.id = auth.users.id
  AND (auth.users.raw_app_meta_data ->> 'org_id') IS DISTINCT FROM p.organization_id::text;

-- 5b. Usuários novos: set_user_role (BEFORE INSERT em auth.users) já é o ponto
-- onde o servidor escreve app_metadata no cadastro — passa a gravar org_id
-- também. O org_id NUNCA vem de user_metadata (editável pelo usuário): é sempre
-- a organização padrão aqui; convites por organização vão definir app_metadata
-- pelo servidor (auth.admin.updateUserById) nas próximas etapas.
-- Comportamento de role inalterado nesta migration.
CREATE OR REPLACE FUNCTION public.set_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    NEW.raw_app_meta_data :=
      COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('role', NEW.raw_user_meta_data->>'role');
  END IF;

  IF (NEW.raw_app_meta_data ->> 'org_id') IS NULL THEN
    NEW.raw_app_meta_data :=
      COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('org_id', private.default_org_id());
  END IF;

  RETURN NEW;
END;
$$;

-- 5c. Se a organização de um perfil mudar (operação de servidor), a claim
-- acompanha. Vale a partir do próximo refresh do token do usuário.
CREATE OR REPLACE FUNCTION private.sync_org_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('org_id', NEW.organization_id)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_org_claim ON public.profiles;
CREATE TRIGGER trg_sync_org_claim
  AFTER UPDATE OF organization_id ON public.profiles
  FOR EACH ROW
  WHEN (NEW.organization_id IS DISTINCT FROM OLD.organization_id)
  EXECUTE FUNCTION private.sync_org_claim();

-- ─── 6. RLS e GRANTs de organizations ───────────────────────────────────────
-- Leitura: membros veem a própria organização. Edição da marca: admins da
-- própria organização. Criar/excluir organização: só servidor (service_role).
-- A leitura pública da marca por slug (tela de login /a/:slug) virá como RPC
-- dedicada expondo só campos de marca, não por policy para anon.

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
CREATE POLICY organizations_select_own ON public.organizations
  FOR SELECT TO authenticated
  USING (id = (SELECT private.resolve_org_id()));

DROP POLICY IF EXISTS organizations_update_admin ON public.organizations;
CREATE POLICY organizations_update_admin ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = (SELECT private.resolve_org_id()) AND (SELECT private.is_admin()))
  WITH CHECK (id = (SELECT private.resolve_org_id()) AND (SELECT private.is_admin()));

REVOKE ALL ON TABLE public.organizations FROM anon, authenticated, service_role;
GRANT SELECT, UPDATE ON TABLE public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizations TO service_role;
