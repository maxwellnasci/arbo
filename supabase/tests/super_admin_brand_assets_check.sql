-- Verificação da migration 20261010012143_super_admin_brand_assets (logo de
-- qualquer assessoria enviada pelo Painel Super Admin).
--
-- NADA é gravado: termina sempre em RAISE EXCEPTION ('LOGO_SUPER ...'),
-- abortando a transação. Cada item termina em "=ok" ou "=FALHOU(...)".
--   npx supabase db query --linked -f supabase/tests/super_admin_brand_assets_check.sql
DO $$
DECLARE
  arbo    uuid := '00000000-0000-4000-a000-000000000001';
  org_b   uuid := '00000000-0000-4000-a000-0000000000bb';
  sem_org uuid := '00000000-0000-4000-a000-0000000000cc';
  super_id uuid;
  admin_b  uuid := '00000000-0000-4000-a000-0000000000ad';
  n int;
  res text := '';
BEGIN
  SELECT id INTO super_id FROM auth.users WHERE raw_app_meta_data ->> 'is_super_admin' = 'true' LIMIT 1;
  res := res || format('super_admin_existe=%s ', CASE WHEN super_id IS NOT NULL THEN 'ok' ELSE 'FALHOU' END);

  INSERT INTO public.organizations (id, name, slug) VALUES (org_b, 'Box Teste', 'box-teste');

  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'brand_assets_super_admin_%';
  res := res || format('policies=%s ', CASE WHEN n = 4 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- ── Super admin ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', super_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo, 'is_super_admin', true))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('brand-assets', org_b || '/logo-1.webp', super_id);
    res := res || 'super_upload_outra_org=ok ';
  EXCEPTION WHEN OTHERS THEN
    res := res || format('super_upload_outra_org=FALHOU(%s) ', SQLERRM);
  END;

  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'brand-assets' AND name = org_b || '/logo-1.webp';
  res := res || format('super_le_arquivo=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('brand-assets', sem_org || '/logo.webp', super_id);
    res := res || 'super_upload_org_inexistente=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'super_upload_org_inexistente=ok(negado) ';
  END;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('brand-assets', 'logo-sem-pasta.webp', super_id);
    res := res || 'super_upload_fora_de_pasta=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'super_upload_fora_de_pasta=ok(negado) ';
  END;

  -- O Storage proíbe DELETE por SQL (trigger storage.protect_delete, que só
  -- dispara para linhas que passaram pelo RLS). Chegar no trigger = a policy
  -- de exclusão liberou; na API do Storage a remoção acontece de fato.
  BEGIN
    DELETE FROM storage.objects WHERE bucket_id = 'brand-assets' AND name = org_b || '/logo-1.webp';
    GET DIAGNOSTICS n = ROW_COUNT;
    res := res || format('super_remove_logo=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(rls ocultou: ' || n || ')' END);
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || format('super_remove_logo=%s ', CASE
      WHEN SQLERRM LIKE 'Direct deletion%' THEN 'ok(rls liberou)' ELSE 'FALHOU(' || SQLERRM || ')' END);
  END;

  UPDATE public.organizations SET logo_url = 'https://exemplo.com/logo.webp' WHERE id = org_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  res := res || format('super_grava_logo_url=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);

  -- ── Admin comum da Arbo (sem a claim) continua preso à própria pasta ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo))::text, true);

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('brand-assets', org_b || '/logo-hack.webp', admin_b);
    res := res || 'admin_upload_outra_org=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'admin_upload_outra_org=ok(negado) ';
  END;

  -- claim em user_metadata não vale
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated',
    'user_metadata', json_build_object('is_super_admin', true),
    'app_metadata', json_build_object('role', 'admin', 'org_id', arbo))::text, true);

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('brand-assets', org_b || '/logo-hack2.webp', admin_b);
    res := res || 'user_metadata_nao_vale=FALHOU(permitido) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'user_metadata_nao_vale=ok(negado) ';
  END;

  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'LOGO_SUPER %', res;
END;
$$;
