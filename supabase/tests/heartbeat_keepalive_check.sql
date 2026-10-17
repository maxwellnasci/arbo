-- Verificação da migration 20261016000000 (heartbeat do keep-alive).
-- NADA é gravado: termina sempre em RAISE EXCEPTION (HEARTBEAT ...).
--   npx supabase db query --linked -f supabase/tests/heartbeat_keepalive_check.sql
DO $$
DECLARE
  r1 jsonb;
  r2 jsonb;
  writes bigint;
  reads bigint;
  res text := '';
BEGIN
  -- Estrutura e permissões
  res := res || format('rls=%s ', (SELECT CASE WHEN relrowsecurity THEN 'ok' ELSE 'FALHOU' END
    FROM pg_class WHERE oid = 'public.app_heartbeat'::regclass));
  res := res || format('sem_grant_cliente=%s ', CASE WHEN NOT has_table_privilege('anon', 'public.app_heartbeat', 'SELECT,INSERT,UPDATE,DELETE')
    AND NOT has_table_privilege('authenticated', 'public.app_heartbeat', 'SELECT,INSERT,UPDATE,DELETE') THEN 'ok' ELSE 'FALHOU' END);
  res := res || format('definer=%s ', (SELECT CASE WHEN prosecdef AND proconfig @> ARRAY['search_path=""'] THEN 'ok' ELSE 'FALHOU(' || coalesce(array_to_string(proconfig, ','), '-') || ')' END
    FROM pg_proc WHERE oid = 'public.keepalive()'::regprocedure));
  res := res || format('anon_exec=%s ', CASE WHEN has_function_privilege('anon', 'public.keepalive()', 'EXECUTE') THEN 'ok' ELSE 'FALHOU' END);

  -- Chamada como anon (igual ao GitHub Actions)
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  EXECUTE 'SET LOCAL ROLE anon';
  r1 := public.keepalive();
  r2 := public.keepalive();
  BEGIN
    PERFORM 1 FROM public.app_heartbeat;
    res := res || 'anon_select_tabela=FALHOU(liberado) ';
  EXCEPTION WHEN insufficient_privilege THEN
    res := res || 'anon_select_tabela=negado(ok) ';
  END;
  EXECUTE 'RESET ROLE';

  res := res || format('status=%s ', CASE WHEN r1->>'status' = 'ok' AND (r1->>'read_ok')::boolean THEN 'ok' ELSE 'FALHOU(' || r1::text || ')' END);
  res := res || format('incrementa=%s ', CASE WHEN (r2->>'beat_count')::bigint = (r1->>'beat_count')::bigint + 1 THEN 'ok' ELSE 'FALHOU' END);
  res := res || format('sem_contagem_treinos=%s ', CASE WHEN NOT (r1 ? 'trainings_checked') THEN 'ok' ELSE 'FALHOU' END);

  -- Prova de atividade real nas estatísticas (contadores desta transação)
  SELECT coalesce(n_tup_ins + n_tup_upd, 0) INTO writes FROM pg_stat_xact_user_tables WHERE relid = 'public.app_heartbeat'::regclass;
  SELECT coalesce(seq_scan, 0) + coalesce(idx_scan, 0) INTO reads FROM pg_stat_xact_user_tables WHERE relid = 'public.trainings'::regclass;
  res := res || format('escrita_heartbeat=%s(%s) ', CASE WHEN writes >= 2 THEN 'ok' ELSE 'FALHOU' END, writes);
  res := res || format('leitura_trainings=%s(%s) beat_count=%s', CASE WHEN reads >= 2 THEN 'ok' ELSE 'FALHOU' END, reads, r2->>'beat_count');

  RAISE EXCEPTION 'HEARTBEAT %', res;
END;
$$;
