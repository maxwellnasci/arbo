-- Verificação da migration 20261008094907_super_admin_organizations.
-- NADA é gravado: termina sempre em RAISE EXCEPTION ('SUPERADMIN ...').
--   npx supabase db query --linked -f supabase/tests/super_admin_check.sql
DO $$
DECLARE
  arbo     uuid := '00000000-0000-4000-a000-000000000001';
  max_id   uuid;
  admin_id uuid;
  aluno_id uuid;
  n int;
  res text := '';
BEGIN
  SELECT count(*) INTO n FROM auth.users WHERE raw_app_meta_data ->> 'is_super_admin' = 'true';
  res := res || format('so_1_super_admin=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  SELECT id INTO max_id FROM auth.users WHERE raw_app_meta_data ->> 'is_super_admin' = 'true' LIMIT 1;
  SELECT p.id INTO admin_id FROM public.profiles p
    WHERE p.role = 'admin' AND p.organization_id = arbo AND p.id <> max_id LIMIT 1;
  SELECT id INTO aluno_id FROM public.profiles WHERE role = 'aluno' AND organization_id = arbo LIMIT 1;

  INSERT INTO public.organizations (id, name, slug)
  VALUES ('00000000-0000-4000-a000-0000000000cc', 'Box Teste', 'box-teste-super');

  -- ── Super admin (Max) ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', max_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo, 'is_super_admin', true))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.organizations;
  res := res || format('super_lista_todas=%s ', CASE WHEN n >= 2 THEN 'ok(' || n || ')' ELSE 'FALHOU(' || n || ')' END);
  BEGIN
    INSERT INTO public.organizations (name, slug) VALUES ('Nova pelo super', 'nova-pelo-super');
    res := res || 'super_insere=ok ';
  EXCEPTION WHEN OTHERS THEN
    res := res || format('super_insere=FALHOU(%s) ', SQLERRM);
  END;

  -- ── Admin comum ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo))::text, true);
  SELECT count(*) INTO n FROM public.organizations;
  res := res || format('admin_ve_so_a_propria=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  BEGIN
    INSERT INTO public.organizations (name, slug) VALUES ('Hack', 'hack-admin');
    res := res || 'admin_insere=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'admin_insere=ok(negado) ';
  END;

  -- claim falsa em user_metadata não vale
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo),
    'user_metadata', json_build_object('is_super_admin', true))::text, true);
  SELECT count(*) INTO n FROM public.organizations;
  res := res || format('user_metadata_nao_vale=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- ── Aluno ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', aluno_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'aluno', 'org_id', arbo))::text, true);
  BEGIN
    INSERT INTO public.organizations (name, slug) VALUES ('Hack', 'hack-aluno');
    res := res || 'aluno_insere=FALHOU(permitido)';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'aluno_insere=ok(negado)';
  END;

  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'SUPERADMIN %', res;
END;
$$;
