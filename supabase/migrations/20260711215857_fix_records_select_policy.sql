-- Bloqueador 3 (alto): records_select estava com USING (true) — qualquer
-- aluno autenticado conseguia ler os recordes pessoais (records) de
-- QUALQUER outro aluno via query direta ao Supabase, não só os próprios.

DROP POLICY IF EXISTS "records_select" ON public.records;

CREATE POLICY "records_select" ON public.records
  FOR SELECT TO authenticated
  USING ((student_id = (SELECT auth.uid())) OR (SELECT private.is_admin()));
