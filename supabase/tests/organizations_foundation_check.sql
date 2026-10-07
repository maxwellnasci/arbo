-- Verificação da migration 20261007095224_organizations_multitenant_foundation.
--
-- NADA é gravado: o bloco sempre termina em RAISE EXCEPTION, o que aborta a
-- transação inteira. O resultado vem na própria mensagem de erro ('ENSAIO_OK ...').
--
-- Uso:
--   - antes do db push: BEGIN; + migration + este arquivo + ROLLBACK; num arquivo só
--   - depois do db push: só este arquivo
--   npx supabase db query --linked -f supabase/tests/organizations_foundation_check.sql
--
-- Resultado em 2026-10-07 (ensaio pré-push em produção):
--   orgs=1; *_fora_arbo=0 nas 7 tabelas; users_com_claim=9/9; insert_default=t;
--   admin_ve_orgs=1; cross_insert=bloqueado; move_org=bloqueado; update_normal=1;
--   token_sem_claim=t; novo_perfil_org=t; novo_user_claim=t; sync_claim=t
DO $$
DECLARE
  arbo uuid := '00000000-0000-4000-a000-000000000001';
  other uuid := '00000000-0000-4000-a000-0000000000ff';
  admin_id uuid;
  res text := '';
  n int;
  got uuid;
  t text;
  new_user uuid := gen_random_uuid();
BEGIN
  SELECT count(*) INTO n FROM public.organizations;
  res := res || format('orgs=%s; ', n);

  FOREACH t IN ARRAY ARRAY['profiles','groups','trainings','training_programs','tags','training_types','invites'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE organization_id <> %L', t, arbo) INTO n;
    res := res || format('%s_fora_arbo=%s ', t, n);
  END LOOP;

  SELECT count(*) INTO n FROM auth.users WHERE raw_app_meta_data->>'org_id' = arbo::text;
  res := res || format('; users_com_claim=%s/%s; ', n, (SELECT count(*) FROM auth.users));

  -- org extra só para testar escrita entre organizações
  INSERT INTO public.organizations (id, name, slug) VALUES (other, 'Probe', 'probe-org');

  SELECT id INTO admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

  -- 1) Admin com token novo (claim org_id): insert sem organization_id
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', admin_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.training_types (name, created_by) VALUES ('__probe_tipo__', admin_id)
    RETURNING organization_id INTO got;
  res := res || format('insert_default=%s; ', got = arbo);

  SELECT count(*) INTO n FROM public.organizations;
  res := res || format('admin_ve_orgs=%s; ', n);

  BEGIN
    INSERT INTO public.tags (name, color, created_by, organization_id) VALUES ('__probe__', 'orange', admin_id, other);
    res := res || 'cross_insert=PERMITIDO(ERRO); ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || format('cross_insert=bloqueado(%s); ', SQLERRM);
  END;

  -- training_types não tem GRANT UPDATE para authenticated; os testes de
  -- UPDATE usam trainings para não confundir falta de GRANT com o trigger.
  INSERT INTO public.trainings (title, type, created_by) VALUES ('__probe_treino__', 'corrida', admin_id);

  BEGIN
    UPDATE public.trainings SET organization_id = other WHERE title = '__probe_treino__';
    res := res || 'move_org=PERMITIDO(ERRO); ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || format('move_org=bloqueado(%s); ', SQLERRM);
  END;

  -- update comum (sem mexer em organization_id) continua funcionando
  UPDATE public.trainings SET title = '__probe_treino2__' WHERE title = '__probe_treino__';
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || format('update_normal=%s; ', n);

  -- 2) Token antigo (sem claim org_id) → resolve pelo perfil
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', admin_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin'))::text, true);
  INSERT INTO public.tags (name, color, created_by) VALUES ('__probe_tag__', 'orange', admin_id)
    RETURNING organization_id INTO got;
  res := res || format('token_sem_claim=%s; ', got = arbo);

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);

  -- 3) Cadastro novo (caminho do convite): set_user_role + handle_new_user
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  VALUES (new_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-' || new_user || '@example.invalid', '{"full_name":"Probe"}', '{}', now(), now());
  SELECT organization_id INTO got FROM public.profiles WHERE id = new_user;
  res := res || format('novo_perfil_org=%s; ', got = arbo);
  SELECT (raw_app_meta_data->>'org_id')::uuid INTO got FROM auth.users WHERE id = new_user;
  res := res || format('novo_user_claim=%s; ', got = arbo);

  -- 4) Mudança de org pelo servidor sincroniza a claim
  UPDATE public.profiles SET organization_id = other WHERE id = new_user;
  SELECT (raw_app_meta_data->>'org_id')::uuid INTO got FROM auth.users WHERE id = new_user;
  res := res || format('sync_claim=%s', got = other);

  RAISE EXCEPTION 'ENSAIO_OK %', res;
END;
$$;
