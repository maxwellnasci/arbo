-- Verificação da migration 20261007105440_hyrox_crossfit_modalities.
--
-- NADA é gravado: termina sempre em RAISE EXCEPTION ('MODALIDADES ...'),
-- abortando a transação. Cada item termina em "=ok" ou "=FALHOU(...)".
-- Cria uma 2ª organização de teste e simula professor/aluno de cada uma.
--   npx supabase db query --linked -f supabase/tests/modalities_check.sql
DO $$
DECLARE
  arbo    uuid := '00000000-0000-4000-a000-000000000001';
  org_b   uuid := '00000000-0000-4000-a000-0000000000bb';
  demo    uuid := '00000000-0000-0000-0000-000000000000';
  admin_a uuid;
  aluno_a uuid;
  admin_b uuid := gen_random_uuid();
  hyrox_t uuid;
  other_t uuid;
  ski     uuid;
  custom_ex uuid;
  b1 uuid; b2 uuid; b3 uuid;
  other_block uuid;
  ck uuid;
  demo_ck uuid;
  n int;
  txt text;
  res text := '';
BEGIN
  SELECT id INTO admin_a FROM public.profiles WHERE role = 'admin' AND organization_id = arbo LIMIT 1;
  -- Aluno de teste próprio (a Arbo virou vitrine em 2026-10-08 e não tem mais
  -- aluno real além do Demo). Criado na transação abortada; cai na Arbo como
  -- aluno pelos triggers de cadastro.
  aluno_a := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  VALUES (aluno_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'aluno-a-' || aluno_a || '@example.invalid', '{}', '{}', now(), now());

  -- ── Compatibilidade e seed ──
  SELECT count(*) INTO n FROM public.trainings WHERE modality <> 'corrida';
  res := res || format('treinos_existentes_corrida=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.exercises WHERE organization_id IS NULL;
  res := res || format('exercicios_globais=%s ', CASE WHEN n = 23 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT string_agg(name, ',' ORDER BY sort_order) INTO txt FROM public.exercises WHERE organization_id IS NULL AND modality = 'hyrox';
  res := res || format('estacoes_hyrox_em_ordem=%s | ', CASE
    WHEN txt = 'SkiErg,Sled Push,Sled Pull,Burpee Broad Jump,Rowing,Farmers Carry,Sandbag Lunges,Wall Balls' THEN 'ok'
    ELSE 'FALHOU(' || coalesce(txt, '') || ')' END);
  SELECT id INTO ski FROM public.exercises WHERE organization_id IS NULL AND name = 'SkiErg';

  -- ── Org B de teste (professor) ──
  INSERT INTO public.organizations (id, name, slug) VALUES (org_b, 'Box Teste', 'box-teste');
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  VALUES (admin_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'admin-b-' || admin_b || '@example.invalid', '{}', '{"role":"admin"}', now(), now());
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles SET organization_id = org_b WHERE id = admin_b;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ── Professor da Arbo monta um treino Hyrox ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO public.trainings (title, type, created_by, modality, time_cap_seconds)
  VALUES ('__Hyrox teste__', 'hyrox', admin_a, 'hyrox', 5400) RETURNING id INTO hyrox_t;
  INSERT INTO public.trainings (title, type, created_by, modality, wod_format)
  VALUES ('__WOD teste__', 'crossfit', admin_a, 'crossfit', 'amrap') RETURNING id INTO other_t;

  INSERT INTO public.exercises (name, modality, metric) VALUES ('__Exercicio Arbo__', 'crossfit', 'reps')
    RETURNING id INTO custom_ex;
  SELECT organization_id::text INTO txt FROM public.exercises WHERE id = custom_ex;
  res := res || format('exercicio_custom_na_org=%s ', CASE WHEN txt = arbo::text THEN 'ok' ELSE 'FALHOU' END);

  BEGIN
    INSERT INTO public.exercises (name, modality, metric, organization_id) VALUES ('__global hack__', 'crossfit', 'reps', NULL);
    res := res || 'admin_cria_global=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'admin_cria_global=ok(negado) ';
  END;

  SELECT count(*) INTO n FROM public.save_training_blocks(hyrox_t, jsonb_build_array(
    jsonb_build_object('block_type', 'run', 'distance_m', 1000),
    jsonb_build_object('block_type', 'station', 'exercise_id', ski, 'distance_m', 1000),
    jsonb_build_object('block_type', 'station', 'exercise_id', custom_ex, 'reps', 20, 'load_kg', 9)
  ));
  res := res || format('rpc_cria_3_blocos=%s ', CASE WHEN n = 3 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT id INTO b1 FROM public.training_blocks WHERE training_id = hyrox_t AND sort_order = 0;
  SELECT id INTO b2 FROM public.training_blocks WHERE training_id = hyrox_t AND sort_order = 1;
  SELECT id INTO b3 FROM public.training_blocks WHERE training_id = hyrox_t AND sort_order = 2;

  INSERT INTO public.training_blocks (training_id, sort_order, block_type) VALUES (other_t, 0, 'wod')
    RETURNING id INTO other_block;

  -- ── Aluno da Arbo faz check-in e registra resultados ──
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', aluno_a, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'aluno', 'org_id', arbo))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO n FROM public.training_blocks WHERE training_id = hyrox_t;
  res := res || format('| aluno_ve_blocos=%s ', CASE WHEN n = 3 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  INSERT INTO public.checkins (student_id, training_id, actual_duration_seconds)
  VALUES (aluno_a, hyrox_t, 5000) RETURNING id INTO ck;
  INSERT INTO public.checkin_block_results (checkin_id, training_block_id, actual_duration_seconds)
  VALUES (ck, b1, 240), (ck, b2, 270);
  INSERT INTO public.checkin_block_results (checkin_id, training_block_id, actual_reps, actual_load_kg)
  VALUES (ck, b3, 20, 9)
  ON CONFLICT (checkin_id, training_block_id) DO UPDATE SET actual_reps = EXCLUDED.actual_reps;
  SELECT count(*) INTO n FROM public.checkin_block_results WHERE checkin_id = ck;
  res := res || format('aluno_grava_resultados=%s ', CASE WHEN n = 3 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  BEGIN
    INSERT INTO public.checkin_block_results (checkin_id, training_block_id, actual_reps) VALUES (ck, other_block, 10);
    res := res || 'resultado_bloco_de_outro_treino=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'resultado_bloco_de_outro_treino=ok(negado) ';
  END;

  BEGIN
    PERFORM public.save_training_blocks(hyrox_t, '[]'::jsonb);
    SELECT count(*) INTO n FROM public.training_blocks WHERE training_id = hyrox_t;
    res := res || format('aluno_nao_edita_blocos=%s ', CASE WHEN n = 3 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'aluno_nao_edita_blocos=ok(negado) ';
  END;

  -- ── Professor da Arbo edita os blocos: ids preservados, resultados mantidos ──
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO n FROM public.checkin_block_results WHERE checkin_id = ck;
  res := res || format('| admin_le_resultados=%s ', CASE WHEN n = 3 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- reordena (estação primeiro), muda a distância da corrida e remove o 3º bloco
  PERFORM public.save_training_blocks(hyrox_t, jsonb_build_array(
    jsonb_build_object('id', b2, 'block_type', 'station', 'exercise_id', ski, 'distance_m', 1000),
    jsonb_build_object('id', b1, 'block_type', 'run', 'distance_m', 1500)
  ));
  SELECT count(*) INTO n FROM public.training_blocks WHERE training_id = hyrox_t;
  res := res || format('rpc_remove_retirado=%s ', CASE WHEN n = 2 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.training_blocks
  WHERE (id = b2 AND sort_order = 0) OR (id = b1 AND sort_order = 1 AND distance_m = 1500);
  res := res || format('rpc_atualiza_mantendo_id=%s ', CASE WHEN n = 2 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.checkin_block_results WHERE checkin_id = ck;
  res := res || format('resultados_preservados=%s ', CASE WHEN n = 2 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- /preview-aluno: check-in e resultado do Aluno Demo
  INSERT INTO public.checkins (student_id, training_id) VALUES (demo, hyrox_t) RETURNING id INTO demo_ck;
  BEGIN
    INSERT INTO public.checkin_block_results (checkin_id, training_block_id, actual_duration_seconds) VALUES (demo_ck, b1, 300);
    res := res || 'preview_demo_resultado=ok ';
  EXCEPTION WHEN OTHERS THEN
    res := res || format('preview_demo_resultado=FALHOU(%s) ', SQLERRM);
  END;

  -- ── Professor da org B ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', org_b))::text, true);

  SELECT count(*) INTO n FROM public.training_blocks WHERE training_id = hyrox_t;
  res := res || format('| B_nao_ve_blocos_arbo=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.checkin_block_results;
  res := res || format('B_nao_ve_resultados_arbo=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.exercises WHERE id = custom_ex;
  res := res || format('B_nao_ve_exercicio_arbo=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);
  SELECT count(*) INTO n FROM public.exercises;
  res := res || format('B_ve_globais=%s ', CASE WHEN n = 23 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  BEGIN
    PERFORM public.save_training_blocks(hyrox_t, '[]'::jsonb);
    res := res || 'B_edita_blocos_arbo=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'B_edita_blocos_arbo=ok(negado) ';
  END;
  BEGIN
    INSERT INTO public.checkin_block_results (checkin_id, training_block_id, actual_reps) VALUES (demo_ck, b2, 1);
    res := res || 'B_preview_demo_arbo=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'B_preview_demo_arbo=ok(negado) ';
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);

  -- ── Auditoria de policies (mesmos critérios da Etapa 3) ──
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public'
    AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%is_admin%'
    AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%current_org_id%'
    AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%in_my_org%'
    AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%resolve_org_id%';
  res := res || format('| policies_admin_sem_org=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND qual = 'true';
  res := res || format('policies_using_true=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM pg_tables
  WHERE schemaname = 'public' AND tablename IN ('exercises', 'training_blocks', 'checkin_block_results') AND rowsecurity;
  res := res || format('rls_ativo_3_tabelas=%s', CASE WHEN n = 3 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  RAISE EXCEPTION 'MODALIDADES %', res;
END;
$$;
