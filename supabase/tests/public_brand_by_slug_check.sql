-- Verificação da migration 20261007104049_public_brand_by_slug.
-- Aborta sempre (RAISE EXCEPTION 'SLUG ...'): nada é gravado.
--   npx supabase db query --linked -f supabase/tests/public_brand_by_slug_check.sql
DO $$
DECLARE
  r record;
  n int;
  res text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  EXECUTE 'SET LOCAL ROLE anon';

  SELECT * INTO r FROM public.get_brand_by_slug(' ARBO ');
  res := res || format('anon_le_marca_arbo=%s(%s,%s) ',
    CASE WHEN r.slug = 'arbo' THEN 'ok' ELSE 'FALHOU' END, r.brand_name, r.primary_color);

  SELECT count(*) INTO n FROM public.get_brand_by_slug('nao-existe');
  res := res || format('slug_inexistente=%s ', CASE WHEN n = 0 THEN 'ok' ELSE 'FALHOU' END);

  BEGIN
    SELECT count(*) INTO n FROM public.organizations;
    res := res || format('anon_nao_le_tabela=%s', CASE WHEN n = 0 THEN 'ok(0 linhas)' ELSE 'FALHOU(' || n || ')' END);
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'anon_nao_le_tabela=ok(sem permissão)';
  END;

  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'SLUG %', res;
END;
$$;
