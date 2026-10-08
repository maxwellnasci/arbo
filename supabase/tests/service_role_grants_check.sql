-- Verificação da migration 20261008095114 (GRANTs do service_role no onboarding).
-- NADA é gravado: termina sempre em RAISE EXCEPTION (GRANTS ...).
--   npx supabase db query --linked -f supabase/tests/service_role_grants_check.sql
DO $$
DECLARE
  target uuid;
  n int;
  res text := '';
BEGIN
  SELECT id INTO target FROM public.profiles WHERE role = 'aluno' LIMIT 1;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  EXECUTE 'SET LOCAL ROLE service_role';
  BEGIN
    UPDATE public.profiles SET role = 'aluno' WHERE id = target;
    GET DIAGNOSTICS n = ROW_COUNT;
    res := res || format('service_role_update_profiles=%s ', CASE WHEN n = 1 THEN 'ok' ELSE 'FALHOU(' || n || ')' END);
  EXCEPTION WHEN OTHERS THEN
    res := res || format('service_role_update_profiles=FALHOU(%s) ', SQLERRM);
  END;
  BEGIN
    INSERT INTO public.invites (email, role, status, organization_id)
    VALUES ('probe@example.invalid', 'aluno', 'sent', '00000000-0000-4000-a000-000000000001');
    res := res || 'service_role_insert_invites=ok';
  EXCEPTION WHEN OTHERS THEN
    res := res || format('service_role_insert_invites=FALHOU(%s)', SQLERRM);
  END;
  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'GRANTS %', res;
END;
$$;
