-- Bloqueador 1 (crítico): profiles_update permite id = auth.uid(), então
-- qualquer aluno autenticado pode fazer PATCH em profiles setando role='admin'
-- ou group_id para qualquer turma, direto pelo client REST — não há checagem
-- de coluna na policy nem trigger que impeça isso hoje.
--
-- Trigger BEFORE UPDATE bloqueia alteração de role/group_id por quem não é
-- admin, usando a mesma fonte de verdade das policies (app_metadata via
-- private.is_admin()) em vez de reler profiles.role (que é justamente a
-- coluna que estamos protegendo).

CREATE OR REPLACE FUNCTION private.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Não autorizado a alterar role';
    END IF;
    IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      RAISE EXCEPTION 'Não autorizado a alterar group_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_self_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.prevent_self_privilege_escalation();

-- Migra as 3 policies legadas que liam profiles.role diretamente (subquery)
-- para private.is_admin() (lê app_metadata via JWT) — mesma fonte de verdade
-- já usada em profiles_select/profiles_update/profiles_delete e no restante
-- do schema.

DROP POLICY IF EXISTS "Admin full access training_types" ON public.training_types;
CREATE POLICY "Admin full access training_types" ON public.training_types
  TO authenticated
  USING (private.is_admin());

DROP POLICY IF EXISTS "Admin lê schedules" ON public.schedules;
CREATE POLICY "Admin lê schedules" ON public.schedules
  FOR SELECT TO authenticated
  USING (private.is_admin());

DROP POLICY IF EXISTS "Admins têm acesso total às mensagens" ON public.messages;
CREATE POLICY "Admins têm acesso total às mensagens" ON public.messages
  USING (private.is_admin());
