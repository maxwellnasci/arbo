-- Fix RLS da tabela messages: remove políticas legadas/duplicadas (semântica OR
-- permissiva) e unifica em 6 políticas canônicas e estritas (Aluno ↔ Admin).
-- Padrão: (SELECT ...) em volta de private.is_admin() e auth.uid() para que o
-- Postgres avalie uma única vez por statement (InitPlan) em vez de por linha.
-- Chat Aluno↔Admin com exclusão lógica respeitada (deleted_by_admin/student).

-- 1) Drop seguro das políticas legadas e duplicadas ---------------------------
DROP POLICY IF EXISTS "Admin pode atualizar mensagens" ON "public"."messages";
DROP POLICY IF EXISTS "Admin pode enviar mensagens" ON "public"."messages";
DROP POLICY IF EXISTS "Admin pode ver todas as mensagens" ON "public"."messages";
DROP POLICY IF EXISTS "Admins têm acesso total às mensagens" ON "public"."messages";
DROP POLICY IF EXISTS "Aluno pode atualizar suas mensagens" ON "public"."messages";
DROP POLICY IF EXISTS "Aluno pode enviar mensagens" ON "public"."messages";
DROP POLICY IF EXISTS "Aluno pode ver suas mensagens" ON "public"."messages";
DROP POLICY IF EXISTS "Alunos podem atualizar as próprias mensagens (exclusão lógic" ON "public"."messages";
DROP POLICY IF EXISTS "Alunos podem enviar mensagens" ON "public"."messages";
DROP POLICY IF EXISTS "Alunos podem visualizar as próprias mensagens" ON "public"."messages";

-- 2) Garantir RLS ativo -------------------------------------------------------
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- 3) Políticas canônicas ------------------------------------------------------
-- Políticas para Administrador
CREATE POLICY "admin_select_messages" ON "public"."messages"
  FOR SELECT TO "authenticated"
  USING ((SELECT "private"."is_admin"()) AND "deleted_by_admin" = false);

CREATE POLICY "admin_insert_messages" ON "public"."messages"
  FOR INSERT TO "authenticated"
  WITH CHECK ((SELECT "private"."is_admin"()) AND "sender_id" = (SELECT "auth"."uid"()));

CREATE POLICY "admin_update_messages" ON "public"."messages"
  FOR UPDATE TO "authenticated"
  USING ((SELECT "private"."is_admin"()))
  WITH CHECK ((SELECT "private"."is_admin"()));

-- Políticas para Aluno
CREATE POLICY "aluno_select_messages" ON "public"."messages"
  FOR SELECT TO "authenticated"
  USING ("student_id" = (SELECT "auth"."uid"()) AND "deleted_by_student" = false);

CREATE POLICY "aluno_insert_messages" ON "public"."messages"
  FOR INSERT TO "authenticated"
  WITH CHECK ("student_id" = (SELECT "auth"."uid"()) AND "sender_id" = (SELECT "auth"."uid"()));

CREATE POLICY "aluno_update_messages" ON "public"."messages"
  FOR UPDATE TO "authenticated"
  USING ("student_id" = (SELECT "auth"."uid"()))
  WITH CHECK ("student_id" = (SELECT "auth"."uid"()));
