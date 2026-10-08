-- Limpeza da organização Arbo Run para virar vitrine (2026-10-08).
-- Mantém só: maxwellngg@gmail.com (admin + super admin) e o Aluno Demo
-- (00000000-0000-0000-0000-000000000000). Remove todas as outras contas.
--
-- Ordem (tudo numa transação):
--   1. transfere para o Max a autoria de linhas com FK NO ACTION para profiles
--      (trainings, tags, training_types, group_plans, weekly_plans) — sem isso
--      a exclusão falharia e os treinos da biblioteca se perderiam;
--   2. limpa checkins.approved_by e apaga comments/reactions das contas removidas;
--   3. apaga as contas em auth.users → CASCADE em profiles e nos dados do
--      aluno (checkins, mensagens, anamnese, Strava, agendamentos...);
--   4. confere o resultado e, se algo não bater, aborta tudo.
-- DRY_RUN = true termina em RAISE EXCEPTION (nada é gravado).
--
-- REGISTRO (não é migration — operação de dados única): aplicado em
-- produção em 2026-10-08 pelo Max (versão com dry_run = false), depois de
-- ensaio com o resultado abaixo. Removeu 4 admins antigos e 3 alunos;
-- transferiu 54 treinos e 3 planos de turma para o Max.
--   ENSAIO_LIMPEZA_OK contas_removidas=7 treinos_transferidos=54
--   planos_turma_transferidos=3 auth_users_apagados=7 | contas_finais=2
--   treinos=56 programas=5 turmas=3
-- Não rodar de novo sem rever: hoje só existem as 2 contas mantidas.
DO $$
DECLARE
  dry_run boolean := true;
  demo uuid := '00000000-0000-0000-0000-000000000000';
  max_id uuid;
  gone uuid[];
  trainings_before int;
  programs_before int;
  groups_before int;
  n int;
  res text := '';
BEGIN
  SELECT id INTO max_id FROM auth.users WHERE lower(email) = 'maxwellngg@gmail.com';
  IF max_id IS NULL THEN RAISE EXCEPTION 'Conta do Max não encontrada — abortando'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = demo) THEN RAISE EXCEPTION 'Aluno Demo não encontrado — abortando'; END IF;

  SELECT array_agg(id) INTO gone FROM auth.users WHERE id NOT IN (max_id, demo);
  SELECT count(*) INTO trainings_before FROM public.trainings;
  SELECT count(*) INTO programs_before FROM public.training_programs;
  SELECT count(*) INTO groups_before FROM public.groups;
  res := res || format('contas_removidas=%s ', coalesce(array_length(gone, 1), 0));

  -- 1. Autoria → Max (sem mexer em updated_at: os treinos não foram editados)
  ALTER TABLE public.trainings DISABLE TRIGGER update_trainings_updated_at;
  ALTER TABLE public.group_plans DISABLE TRIGGER trg_group_plans_updated_at;
  ALTER TABLE public.tags DISABLE TRIGGER update_tags_updated_at;

  UPDATE public.trainings SET created_by = max_id WHERE created_by = ANY (gone);
  GET DIAGNOSTICS n = ROW_COUNT; res := res || format('treinos_transferidos=%s ', n);
  UPDATE public.tags SET created_by = max_id WHERE created_by = ANY (gone);
  UPDATE public.training_types SET created_by = max_id WHERE created_by = ANY (gone);
  UPDATE public.group_plans SET created_by = max_id WHERE created_by = ANY (gone);
  GET DIAGNOSTICS n = ROW_COUNT; res := res || format('planos_turma_transferidos=%s ', n);
  UPDATE public.weekly_plans SET created_by = max_id WHERE created_by = ANY (gone) AND NOT (student_id = ANY (gone));

  ALTER TABLE public.trainings ENABLE TRIGGER update_trainings_updated_at;
  ALTER TABLE public.group_plans ENABLE TRIGGER trg_group_plans_updated_at;
  ALTER TABLE public.tags ENABLE TRIGGER update_tags_updated_at;

  -- 2. Referências restantes (NO ACTION)
  UPDATE public.checkins SET approved_by = NULL WHERE approved_by = ANY (gone);
  DELETE FROM public.comments WHERE author_id = ANY (gone);
  DELETE FROM public.reactions WHERE user_id = ANY (gone);

  -- 3. Contas (CASCADE: profiles → dados operacionais do aluno)
  DELETE FROM auth.users WHERE id = ANY (gone);
  GET DIAGNOSTICS n = ROW_COUNT; res := res || format('auth_users_apagados=%s ', n);

  -- 4. Conferência — qualquer divergência aborta a transação inteira
  SELECT count(*) INTO n FROM auth.users;
  IF n <> 2 THEN RAISE EXCEPTION 'Esperava 2 contas, ficaram %', n; END IF;
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 2 THEN RAISE EXCEPTION 'Esperava 2 perfis, ficaram %', n; END IF;
  SELECT count(*) INTO n FROM public.profiles WHERE role = 'admin';
  IF n <> 1 THEN RAISE EXCEPTION 'Esperava 1 admin, ficaram %', n; END IF;
  SELECT count(*) INTO n FROM public.trainings;
  IF n <> trainings_before THEN RAISE EXCEPTION 'Treinos mudaram: % → %', trainings_before, n; END IF;
  SELECT count(*) INTO n FROM public.training_programs;
  IF n <> programs_before THEN RAISE EXCEPTION 'Programas mudaram: % → %', programs_before, n; END IF;
  SELECT count(*) INTO n FROM public.groups;
  IF n <> groups_before THEN RAISE EXCEPTION 'Turmas mudaram: % → %', groups_before, n; END IF;
  SELECT count(*) INTO n FROM public.trainings WHERE created_by <> max_id;
  IF n <> 0 THEN RAISE EXCEPTION '% treinos com autor que não é o Max', n; END IF;

  res := res || format('| contas_finais=2 treinos=%s programas=%s turmas=%s', trainings_before, programs_before, groups_before);

  IF dry_run THEN
    RAISE EXCEPTION 'ENSAIO_LIMPEZA_OK %', res;
  END IF;
  RAISE NOTICE 'LIMPEZA_APLICADA %', res;
END;
$$;
