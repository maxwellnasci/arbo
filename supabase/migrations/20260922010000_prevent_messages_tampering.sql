-- Hardening da tabela messages: a policy aluno_update_messages amarra só
-- student_id (USING/WITH CHECK), então um aluno autenticado ainda poderia fazer
-- PATCH via REST direto alterando content, sender_id, admin_id, deleted_by_admin
-- e demais colunas sensíveis das próprias mensagens — não há checagem de coluna
-- na policy. Este trigger BEFORE UPDATE bloqueia qualquer mutação dessas colunas
-- por quem não é admin, espelhando trg_prevent_self_privilege_escalation de
-- profiles (20260711215103_prevent_privilege_escalation.sql).
--
-- Colunas liberadas ao aluno: deleted_by_student (soft-delete próprio) e
-- read_at (marcação de leitura). Todo o resto levanta exceção.

CREATE OR REPLACE FUNCTION private.prevent_messages_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Não autorizado a alterar id';
    END IF;
    IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
      RAISE EXCEPTION 'Não autorizado a alterar student_id';
    END IF;
    IF NEW.sender_id IS DISTINCT FROM OLD.sender_id THEN
      RAISE EXCEPTION 'Não autorizado a alterar sender_id';
    END IF;
    IF NEW.admin_id IS DISTINCT FROM OLD.admin_id THEN
      RAISE EXCEPTION 'Não autorizado a alterar admin_id';
    END IF;
    IF NEW.content IS DISTINCT FROM OLD.content THEN
      RAISE EXCEPTION 'Não autorizado a alterar content';
    END IF;
    IF NEW.deleted_by_admin IS DISTINCT FROM OLD.deleted_by_admin THEN
      RAISE EXCEPTION 'Não autorizado a alterar deleted_by_admin';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Não autorizado a alterar created_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_messages_tampering ON public.messages;
CREATE TRIGGER trg_prevent_messages_tampering
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.prevent_messages_tampering();
