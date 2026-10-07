-- Verificação da migration 20261007102510_brand_assets_storage (bucket da logo)
-- e da edição da marca em organizations.
--
-- NADA é gravado: termina sempre em RAISE EXCEPTION ('MARCA ...'), abortando a
-- transação. Cada item termina em "=ok" ou "=FALHOU(...)".
--   npx supabase db query --linked -f supabase/tests/brand_assets_check.sql
DO $$
DECLARE
  arbo   uuid := '00000000-0000-4000-a000-000000000001';
  org_b  uuid := '00000000-0000-4000-a000-0000000000bb';
  admin_a uuid;
  aluno_a uuid;
  b record;
  n int;
  res text := '';
BEGIN
  SELECT id INTO admin_a FROM public.profiles WHERE role = 'admin' AND organization_id = arbo LIMIT 1;
  SELECT id INTO aluno_a FROM public.profiles WHERE role = 'aluno' AND organization_id = arbo LIMIT 1;
  INSERT INTO public.organizations (id, name, slug) VALUES (org_b, 'Box Teste', 'box-teste');

  SELECT * INTO b FROM storage.buckets WHERE id = 'brand-assets';
  res := res || format('bucket=%s ', CASE
    WHEN b.public AND b.file_size_limit = 2097152 AND b.allowed_mime_types = ARRAY['image/png','image/webp'] THEN 'ok'
    ELSE 'FALHOU' END);

  -- ── Admin da Arbo ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('brand-assets', arbo || '/logo-teste.webp', admin_a);
    res := res || 'admin_upload_propria_pasta=ok ';
  EXCEPTION WHEN OTHERS THEN
    res := res || format('admin_upload_propria_pasta=FALHOU(%s) ', SQLERRM);
  END;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('brand-assets', org_b || '/logo-hack.webp', admin_a);
    res := res || 'admin_upload_outra_org=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'admin_upload_outra_org=ok(negado) ';
  END;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('brand-assets', 'logo-sem-pasta.webp', admin_a);
    res := res || 'admin_upload_fora_de_pasta=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'admin_upload_fora_de_pasta=ok(negado) ';
  END;

  UPDATE public.organizations SET brand_name = 'Arbo Teste', primary_color = '#1D4ED8' WHERE id = arbo;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || format('admin_edita_marca=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  UPDATE public.organizations SET brand_name = 'hack' WHERE id = org_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || format('admin_nao_edita_outra_org=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);

  BEGIN
    UPDATE public.organizations SET primary_color = 'red' WHERE id = arbo;
    res := res || 'cor_invalida=FALHOU(aceita) ';
  EXCEPTION WHEN check_violation THEN
    res := res || 'cor_invalida=ok(recusada) ';
  END;

  BEGIN
    UPDATE public.organizations SET logo_url = 'http://inseguro.example/logo.png' WHERE id = arbo;
    res := res || 'logo_http=FALHOU(aceita) ';
  EXCEPTION WHEN check_violation THEN
    res := res || 'logo_http=ok(recusada) ';
  END;

  -- ── Aluno da Arbo ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', aluno_a, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'aluno', 'org_id', arbo))::text, true);

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('brand-assets', arbo || '/logo-aluno.webp', aluno_a);
    res := res || 'aluno_upload=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'aluno_upload=ok(negado) ';
  END;

  UPDATE public.organizations SET brand_name = 'hack aluno' WHERE id = arbo;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || format('aluno_nao_edita_marca=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);

  SELECT count(*) INTO n FROM public.organizations;
  res := res || format('aluno_le_propria_org=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- ── Sem login (anon) não lista o bucket ──
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'brand-assets';
    res := res || format('anon_nao_lista_bucket=%s', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'anon_nao_lista_bucket=ok(sem permissão)';
  END;

  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'MARCA %', res;
END;
$$;
