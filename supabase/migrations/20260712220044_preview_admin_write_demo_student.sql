-- Fix: modo preview do admin ("Testar como Aluno") não conseguia agendar
-- nem fazer check-in para o Aluno Demo.
--
-- Causa raiz: /preview-aluno mantém a sessão real do admin, mas grava
-- student_id = '00000000-0000-0000-0000-000000000000' (UUID fixo do Aluno
-- Demo). A única policy de escrita em schedules ("Aluno CRUD próprio
-- schedule") exige student_id = auth.uid() — como auth.uid() é o UUID real
-- do admin, o INSERT era rejeitado com 42501 (new row violates row-level
-- security policy). checkins_insert tem o mesmo problema: única policy de
-- INSERT em checkins também exige student_id = auth.uid(), sem bypass para
-- admin (diferente de checkins_update/checkins_delete, que já têm
-- `OR private.is_admin()`).
--
-- Escopo deliberadamente restrito ao UUID fixo do Aluno Demo — NÃO libera
-- admin para escrever em nome de qualquer aluno real, o que reabriria uma
-- superfície de escalada inconsistente com o hardening de
-- 20260711215103_prevent_privilege_escalation.sql. Múltiplas policies
-- permissivas para o mesmo comando se combinam via OR, então isso coexiste
-- sem conflito com "Aluno CRUD próprio schedule" e "checkins_insert".

CREATE POLICY "Admin escreve schedules do Aluno Demo" ON public.schedules
  FOR ALL TO authenticated
  USING (
    private.is_admin()
    AND student_id = '00000000-0000-0000-0000-000000000000'
  )
  WITH CHECK (
    private.is_admin()
    AND student_id = '00000000-0000-0000-0000-000000000000'
  );

CREATE POLICY "Admin insere checkin do Aluno Demo" ON public.checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_admin()
    AND student_id = '00000000-0000-0000-0000-000000000000'
  );
