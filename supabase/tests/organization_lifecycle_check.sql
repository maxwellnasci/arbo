-- Verificação da migration 20261010003849_organization_lifecycle_and_accent.
-- NADA é gravado: termina sempre em RAISE EXCEPTION ('CICLO ...'). Cada item
-- termina em "=ok" ou "=FALHOU(...)".
--   npx supabase db query --linked -f supabase/tests/organization_lifecycle_check.sql
DO $$
DECLARE
  arbo    uuid := '00000000-0000-4000-a000-000000000001';
  org_b   uuid := '00000000-0000-4000-a000-0000000000dd';
  demo    uuid := '00000000-0000-0000-0000-000000000000';
  max_id  uuid;
  admin_b uuid := gen_random_uuid();
  aluno_b uuid := gen_random_uuid();
  group_b uuid;
  training_b uuid;
  block_b uuid;
  checkin_b uuid;
  arbo_trainings int;
  arbo_profiles int;
  n int;
  r record;
  j jsonb;
  res text := '';
BEGIN
  SELECT id INTO max_id FROM auth.users WHERE raw_app_meta_data ->> 'is_super_admin' = 'true' LIMIT 1;
  SELECT count(*) INTO arbo_trainings FROM public.trainings WHERE organization_id = arbo;
  SELECT count(*) INTO arbo_profiles FROM public.profiles WHERE organization_id = arbo;

  -- ── Cor de destaque ──
  BEGIN
    UPDATE public.organizations SET accent_color = 'azul' WHERE id = arbo;
    res := res || 'accent_invalida=FALHOU(aceita) ';
  EXCEPTION WHEN check_violation THEN
    res := res || 'accent_invalida=ok(recusada) ';
  END;

  -- ── Org B completa, com dados de uso ──
  INSERT INTO public.organizations (id, name, slug, primary_color) VALUES (org_b, 'Box Teste', 'box-teste-ciclo', '#1D4ED8');
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  VALUES (admin_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'admin-b-' || admin_b || '@example.invalid', '{}', '{"role":"admin"}', now(), now()),
         (aluno_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'aluno-b-' || aluno_b || '@example.invalid', '{}', '{}', now(), now());
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles SET organization_id = org_b WHERE id IN (admin_b, aluno_b);
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO public.groups (name, goal, frequency, organization_id) VALUES ('Turma B', '5k', '3x', org_b) RETURNING id INTO group_b;
  UPDATE public.profiles SET group_id = group_b WHERE id = aluno_b;
  INSERT INTO public.trainings (title, type, created_by, organization_id, modality) VALUES ('Hyrox B', 'hyrox', admin_b, org_b, 'hyrox') RETURNING id INTO training_b;
  INSERT INTO public.training_blocks (training_id, sort_order, block_type, distance_m) VALUES (training_b, 0, 'run', 1000) RETURNING id INTO block_b;
  INSERT INTO public.checkins (student_id, training_id) VALUES (aluno_b, training_b) RETURNING id INTO checkin_b;
  INSERT INTO public.checkin_block_results (checkin_id, training_block_id, actual_duration_seconds) VALUES (checkin_b, block_b, 300);
  INSERT INTO public.records (student_id, checkin_id, distance_category, time_seconds, achieved_at) VALUES (aluno_b, checkin_b, '5km', 1500, now());
  INSERT INTO public.messages (student_id, sender_id, admin_id, content) VALUES (aluno_b, admin_b, admin_b, 'oi');
  INSERT INTO public.tags (name, created_by, organization_id) VALUES ('Tag B', admin_b, org_b);
  INSERT INTO public.training_programs (name, slug, created_by, organization_id) VALUES ('Biblio B', 'biblio-b', admin_b, org_b);
  INSERT INTO public.invites (email, role, status, organization_id) VALUES ('x@example.invalid', 'aluno', 'sent', org_b);

  -- ── Admin da org B: só campos de marca ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', org_b))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.organizations SET brand_name = 'Box Azul', accent_color = '#F59E0B', secondary_color = '#111827' WHERE id = org_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || format('admin_edita_marca=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  BEGIN
    UPDATE public.organizations SET slug = 'hack' WHERE id = org_b;
    res := res || 'admin_troca_slug=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'admin_troca_slug=ok(negado) ';
  END;
  BEGIN
    UPDATE public.organizations SET is_active = false WHERE id = org_b;
    res := res || 'admin_muda_status=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'admin_muda_status=ok(negado) ';
  END;
  UPDATE public.organizations SET brand_name = 'hack' WHERE id = arbo;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || format('admin_nao_edita_arbo=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);
  BEGIN
    DELETE FROM public.organizations WHERE id = org_b;
    GET DIAGNOSTICS n = ROW_COUNT;
    res := res || format('admin_nao_exclui=%s | ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'admin_nao_exclui=ok(negado) | ';
  END;

  -- ── Super admin ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', max_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo, 'is_super_admin', true))::text, true);
  UPDATE public.organizations SET name = 'Box Teste 2', ai_tone = 'animado' WHERE id = org_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || format('super_edita_outra_org=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  BEGIN
    UPDATE public.organizations SET slug = 'arbo-nova' WHERE id = arbo;
    res := res || 'slug_arbo=FALHOU(alterado) ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'slug_arbo=ok(protegido) ';
  END;
  BEGIN
    DELETE FROM public.organizations WHERE id = arbo;
    res := res || 'excluir_arbo=FALHOU(excluida) ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'excluir_arbo=ok(protegida) ';
  END;

  -- Pausa
  UPDATE public.organizations SET is_active = false WHERE id = org_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || format('super_pausa=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU' END);

  -- ── Admin B com a org pausada: falha fechada ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', org_b))::text, true);
  SELECT count(*) INTO n FROM public.trainings;
  res := res || format('| pausada_sem_treinos=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.profiles WHERE id = aluno_b;
  res := res || format('pausada_sem_alunos=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);
  SELECT is_active::text INTO r FROM public.organizations WHERE id = org_b;
  res := res || format('pausada_le_propria_org=%s ', CASE WHEN r.is_active = 'false' THEN 'ok' ELSE 'FALHOU' END);
  BEGIN
    INSERT INTO public.trainings (title, type, created_by) VALUES ('x', 'corrida', admin_b);
    res := res || 'pausada_cria_treino=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'pausada_cria_treino=ok(negado) ';
  END;
  BEGIN
    UPDATE public.organizations SET is_active = true WHERE id = org_b;
    res := res || 'pausada_se_reativa=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'pausada_se_reativa=ok(negado) ';
  END;

  -- Aluno Demo (Arbo) não é afetado pela pausa de outra org
  PERFORM set_config('request.jwt.claims', json_build_object('sub', demo, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'aluno', 'org_id', arbo))::text, true);
  SELECT count(*) INTO n FROM public.trainings;
  res := res || format('arbo_intacta_na_pausa=%s ', CASE WHEN n = arbo_trainings THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- Reativa
  PERFORM set_config('request.jwt.claims', json_build_object('sub', max_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo, 'is_super_admin', true))::text, true);
  UPDATE public.organizations SET is_active = true WHERE id = org_b;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', org_b))::text, true);
  SELECT count(*) INTO n FROM public.trainings;
  res := res || format('reativada_ve_treino=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- ── RPC pública ──
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT * INTO r FROM public.get_brand_by_slug('box-teste-ciclo');
  res := res || format('| rpc_publica_accent=%s ', CASE WHEN r.accent_color = '#F59E0B' AND r.is_active THEN 'ok' ELSE 'FALHOU' END);

  -- ── Exclusão: só service_role ──
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', max_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo, 'is_super_admin', true))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.delete_organization_cascade(org_b);
    res := res || 'cascade_por_authenticated=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'cascade_por_authenticated=ok(negado) ';
  END;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  EXECUTE 'SET LOCAL ROLE service_role';
  BEGIN
    PERFORM public.delete_organization_cascade(arbo);
    res := res || 'cascade_arbo=FALHOU(excluida) ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'cascade_arbo=ok(protegida) ';
  END;
  j := public.delete_organization_cascade(org_b);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
  res := res || format('cascade_retorno=%s ', CASE WHEN (j ->> 'users_deleted')::int = 2 AND (j ->> 'trainings_deleted')::int = 1 THEN 'ok' ELSE 'FALHOU(' || j::text || ')' END);

  SELECT (SELECT count(*) FROM public.organizations WHERE id = org_b)
       + (SELECT count(*) FROM auth.users WHERE id IN (admin_b, aluno_b))
       + (SELECT count(*) FROM public.profiles WHERE organization_id = org_b)
       + (SELECT count(*) FROM public.groups WHERE id = group_b)
       + (SELECT count(*) FROM public.trainings WHERE id = training_b)
       + (SELECT count(*) FROM public.training_blocks WHERE id = block_b)
       + (SELECT count(*) FROM public.checkins WHERE id = checkin_b)
       + (SELECT count(*) FROM public.records WHERE student_id = aluno_b)
       + (SELECT count(*) FROM public.messages WHERE student_id = aluno_b)
       + (SELECT count(*) FROM public.tags WHERE organization_id = org_b)
       + (SELECT count(*) FROM public.training_programs WHERE organization_id = org_b)
       + (SELECT count(*) FROM public.invites WHERE organization_id = org_b)
    INTO n;
  res := res || format('nada_da_org_b_sobra=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.trainings WHERE organization_id = arbo;
  res := res || format('arbo_treinos_intactos=%s ', CASE WHEN n = arbo_trainings THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT count(*) INTO n FROM public.profiles WHERE organization_id = arbo;
  res := res || format('arbo_perfis_intactos=%s | ', CASE WHEN n = arbo_profiles THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- ── Auditoria de policies ──
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public'
    AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%is_admin%'
    AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%current_org_id%'
    AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%in_my_org%'
    AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%resolve_org_id%';
  res := res || format('policies_admin_sem_org=%s', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  RAISE EXCEPTION 'CICLO %', res;
END;
$$;
