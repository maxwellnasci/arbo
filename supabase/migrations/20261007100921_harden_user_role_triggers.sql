-- Blindagem da role no cadastro de usuários.
--
-- Problema: public.set_user_role() (BEFORE INSERT em auth.users) copiava
-- raw_user_meta_data.role → raw_app_meta_data.role, e public.set_profile_role()
-- (BEFORE INSERT em profiles) copiava a mesma role de user_metadata para
-- profiles.role. user_metadata é definido por quem se cadastra — com o
-- cadastro público ligado (estava até 2026-10-07), qualquer pessoa com a chave
-- pública podia criar a própria conta já como admin. O cadastro público foi
-- desligado no Dashboard; esta migration fecha o mesmo buraco no banco
-- (defesa em profundidade).
--
-- Regra nova: role NUNCA vem de user_metadata.
--   - app_metadata.role só é mantida se já vier definida pelo servidor (Admin
--     API) com valor válido ('aluno' | 'admin'); qualquer outra coisa vira 'aluno'.
--   - profiles.role é lida de app_metadata (fonte de verdade), nunca de
--     user_metadata.
--   - Convite de professor: a Edge Function invite-user promove a conta depois
--     de criada (auth.admin.updateUserById → app_metadata + UPDATE em profiles
--     com service_role).

CREATE OR REPLACE FUNCTION public.set_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb);

  IF (NEW.raw_app_meta_data ->> 'role') IS NULL
     OR (NEW.raw_app_meta_data ->> 'role') NOT IN ('aluno', 'admin') THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data || jsonb_build_object('role', 'aluno');
  END IF;

  IF (NEW.raw_app_meta_data ->> 'org_id') IS NULL THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data
                             || jsonb_build_object('org_id', private.default_org_id());
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  app_role text;
BEGIN
  SELECT u.raw_app_meta_data ->> 'role' INTO app_role
  FROM auth.users u
  WHERE u.id = NEW.id;

  NEW.role := CASE WHEN app_role IN ('aluno', 'admin') THEN app_role ELSE 'aluno' END;
  RETURN NEW;
END;
$$;

-- trg_prevent_self_privilege_escalation passa a liberar chamadas sem usuário
-- final (service_role das Edge Functions, migrations): é o caminho que o
-- invite-user usa para promover um professor convidado. Para quem chega pela
-- API como 'authenticated', a regra continua igual: só admin muda role/group_id.
CREATE OR REPLACE FUNCTION private.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NOT private.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Não autorizado a alterar role';
    END IF;
    IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      RAISE EXCEPTION 'Não autorizado a alterar group_id';
    END IF;
  END IF;

  -- Multi-tenant: a turma tem que ser da mesma organização do aluno.
  IF NEW.group_id IS NOT NULL
     AND NEW.group_id IS DISTINCT FROM OLD.group_id
     AND NOT EXISTS (
       SELECT 1 FROM public.groups g
       WHERE g.id = NEW.group_id AND g.organization_id = NEW.organization_id
     ) THEN
    RAISE EXCEPTION 'Turma de outra organização' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
