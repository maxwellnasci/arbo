-- Verificação das migrations 20261007100921 (blindagem de role) e
-- 20261007100924 (isolamento por organização).
--
-- NADA é gravado: o bloco sempre termina em RAISE EXCEPTION, abortando a
-- transação inteira; o resultado vem na mensagem ('ISOLAMENTO ...'). Cada item
-- termina em "=ok" ou "=FALHOU(...)". Cria uma 2ª organização de teste com
-- professor, aluno, turma, treino, check-in e mensagem próprios e simula cada
-- papel via request.jwt.claims + SET LOCAL ROLE authenticated.
--
-- Uso:
--   - antes do db push: BEGIN; + migrations + este arquivo + ROLLBACK;
--   - depois do db push: só este arquivo
--   npx supabase db query --linked -f supabase/tests/rls_tenant_isolation_check.sql
DO $$
DECLARE
  arbo   uuid := '00000000-0000-4000-a000-000000000001';
  org_b  uuid := '00000000-0000-4000-a000-0000000000bb';
  demo   uuid := '00000000-0000-0000-0000-000000000000';
  admin_a uuid;
  aluno_a uuid;
  admin_b uuid := gen_random_uuid();
  aluno_b uuid := gen_random_uuid();
  hacker  uuid := gen_random_uuid();
  served  uuid := gen_random_uuid();
  group_b uuid;
  training_b uuid;
  n_profiles_arbo int;
  n_trainings_arbo int;
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

  -- ── Blindagem de role (migration 20261007100921) ──
  -- Cadastro tentando virar admin via user_metadata → vira aluno.
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  VALUES (hacker, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'hacker-' || hacker || '@example.invalid', '{"role":"admin"}', '{}', now(), now());
  SELECT raw_app_meta_data->>'role' INTO txt FROM auth.users WHERE id = hacker;
  res := res || format('signup_meta_admin_vira_aluno=%s ', CASE WHEN txt = 'aluno' THEN 'ok' ELSE 'FALHOU(' || coalesce(txt,'null') || ')' END);
  SELECT role INTO txt FROM public.profiles WHERE id = hacker;
  res := res || format('perfil_hacker_aluno=%s ', CASE WHEN txt = 'aluno' THEN 'ok' ELSE 'FALHOU(' || coalesce(txt,'null') || ')' END);

  -- Role definida pelo servidor (app_metadata) é respeitada.
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  VALUES (served, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'served-' || served || '@example.invalid', '{}', '{"role":"admin"}', now(), now());
  SELECT role INTO txt FROM public.profiles WHERE id = served;
  res := res || format('role_do_servidor_respeitada=%s | ', CASE WHEN txt = 'admin' THEN 'ok' ELSE 'FALHOU(' || coalesce(txt,'null') || ')' END);

  -- contas de teste acima também caem na Arbo → contar depois delas
  SELECT count(*) INTO n_profiles_arbo FROM public.profiles WHERE organization_id = arbo;
  SELECT count(*) INTO n_trainings_arbo FROM public.trainings WHERE organization_id = arbo;

  -- ── Organização B de teste ──
  INSERT INTO public.organizations (id, name, slug) VALUES (org_b, 'Box Teste', 'box-teste');

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  VALUES (admin_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'admin-b-' || admin_b || '@example.invalid', '{}', '{"role":"admin"}', now(), now()),
         (aluno_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'aluno-b-' || aluno_b || '@example.invalid', '{}', '{}', now(), now());

  -- Caminho do invite-user: service_role move os perfis para a org B.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles SET organization_id = org_b WHERE id IN (admin_b, aluno_b);
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT count(*) INTO n FROM auth.users WHERE id IN (admin_b, aluno_b) AND raw_app_meta_data->>'org_id' = org_b::text;
  res := res || format('service_role_move_org_e_sincroniza_claim=%s | ', CASE WHEN n = 2 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  INSERT INTO public.groups (name, goal, frequency, organization_id) VALUES ('Turma B', '5k', '3x', org_b) RETURNING id INTO group_b;
  INSERT INTO public.trainings (title, type, created_by, organization_id) VALUES ('Treino B', 'corrida', admin_b, org_b) RETURNING id INTO training_b;
  INSERT INTO public.checkins (student_id, actual_distance_m) VALUES (aluno_b, 5000);
  INSERT INTO public.messages (student_id, sender_id, content) VALUES (aluno_b, admin_b, 'oi B');

  -- ── Professor da Arbo ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO n FROM public.profiles;
  res := res || format('A_ve_perfis_da_arbo=%s ', CASE WHEN n = n_profiles_arbo THEN 'ok' ELSE 'FALHOU(' || n || '/' || n_profiles_arbo || ')' END);
  SELECT count(*) INTO n FROM public.trainings;
  res := res || format('A_ve_treinos_da_arbo=%s ', CASE WHEN n = n_trainings_arbo THEN 'ok' ELSE 'FALHOU(' || n || '/' || n_trainings_arbo || ')' END);
  SELECT count(*) INTO n FROM public.profiles WHERE id IN (admin_b, aluno_b);
  res := res || format('A_nao_ve_perfis_B=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.groups WHERE id = group_b;
  res := res || format('A_nao_ve_turma_B=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);
  SELECT count(*) INTO n FROM public.trainings WHERE id = training_b;
  res := res || format('A_nao_ve_treino_B=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);
  SELECT count(*) INTO n FROM public.checkins WHERE student_id = aluno_b;
  res := res || format('A_nao_ve_checkin_B=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);
  SELECT count(*) INTO n FROM public.messages WHERE student_id = aluno_b;
  res := res || format('A_nao_ve_mensagem_B=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);
  UPDATE public.trainings SET title = 'hack' WHERE id = training_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || format('A_nao_edita_treino_B=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);
  BEGIN
    PERFORM public.get_user_email(aluno_b);
    res := res || 'A_email_de_B=FALHOU(liberado) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'A_email_de_B=ok(negado) ';
  END;
  BEGIN
    PERFORM public.get_user_email(aluno_a);
    res := res || 'A_email_da_arbo=ok ';
  EXCEPTION WHEN OTHERS THEN
    res := res || format('A_email_da_arbo=FALHOU(%s) ', SQLERRM);
  END;
  -- /preview-aluno: admin da Arbo grava checkin do Aluno Demo
  BEGIN
    INSERT INTO public.checkins (student_id, actual_distance_m) VALUES (demo, 1000);
    res := res || 'A_preview_demo_checkin=ok ';
  EXCEPTION WHEN OTHERS THEN
    res := res || format('A_preview_demo_checkin=FALHOU(%s) ', SQLERRM);
  END;
  SELECT count(*) INTO n FROM public.checkins WHERE student_id = demo;
  res := res || format('A_le_checkins_demo=%s ', CASE WHEN n >= 1 THEN 'ok' ELSE 'FALHOU' END);
  BEGIN
    UPDATE public.profiles SET group_id = group_b WHERE id = aluno_a;
    res := res || 'A_poe_aluno_em_turma_B=FALHOU(permitido) | ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'A_poe_aluno_em_turma_B=ok(bloqueado) | ';
  END;

  -- ── Professor da org B ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', org_b))::text, true);

  SELECT count(*) INTO n FROM public.profiles;
  res := res || format('B_ve_so_perfis_B=%s ', CASE WHEN n = 2 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.trainings;
  res := res || format('B_ve_so_treino_B=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.checkins WHERE student_id <> aluno_b;
  res := res || format('B_nao_ve_checkins_arbo=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.messages WHERE student_id <> aluno_b;
  res := res || format('B_nao_ve_mensagens_arbo=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.messages WHERE student_id = aluno_b;
  res := res || format('B_ve_propria_mensagem=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.organizations;
  res := res || format('B_ve_so_propria_org=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  BEGIN
    INSERT INTO public.checkins (student_id, actual_distance_m) VALUES (demo, 1000);
    res := res || 'B_preview_demo=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'B_preview_demo=ok(negado) ';
  END;
  BEGIN
    PERFORM public.get_user_email(admin_a);
    res := res || 'B_email_de_A=FALHOU(liberado) | ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'B_email_de_A=ok(negado) | ';
  END;

  -- ── Aluno da Arbo ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', aluno_a, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'aluno', 'org_id', arbo))::text, true);
  SELECT count(*) INTO n FROM public.trainings;
  res := res || format('alunoA_ve_treinos_arbo=%s ', CASE WHEN n = n_trainings_arbo THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.groups WHERE id = group_b;
  res := res || format('alunoA_nao_ve_turma_B=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);
  SELECT count(*) INTO n FROM public.profiles;
  res := res || format('alunoA_ve_so_proprio_perfil=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- ── Aluno da org B ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', aluno_b, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'aluno', 'org_id', org_b))::text, true);
  SELECT count(*) INTO n FROM public.trainings;
  res := res || format('alunoB_ve_so_treino_B=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.checkins;
  res := res || format('alunoB_ve_proprio_checkin=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- ── Token sem claim org_id: falha fechada ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin'))::text, true);
  SELECT count(*) INTO n FROM public.trainings;
  res := res || format('sem_claim_falha_fechada=%s | ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);

  -- ── Auditoria das policies ──
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public'
    AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%is_admin%'
    AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%current_org_id%'
    AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%in_my_org%'
    AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%resolve_org_id%';
  res := res || format('policies_admin_sem_org=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND qual = 'true';
  res := res || format('policies_using_true=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND roles::text LIKE '%public%';
  res := res || format('policies_to_public=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public';
  res := res || format('total_policies=%s', n);

  RAISE EXCEPTION 'ISOLAMENTO %', res;
END;
$$;
