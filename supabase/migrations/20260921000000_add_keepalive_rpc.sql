-- Keepalive RPC: healthcheck leve para o cron externo (ex: GitHub Actions).
-- Força execução real de query no banco via SELECT now(), evitando falsos
-- positivos de keep-alive que retornariam 200 sem tocar o Postgres.
-- Exposta para a role anon via PostgREST (POST /rest/v1/rpc/keepalive).
CREATE OR REPLACE FUNCTION public.keepalive()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object('status', 'ok', 'timestamp', pg_catalog.now());
$$;

GRANT EXECUTE ON FUNCTION public.keepalive() TO anon, authenticated, service_role;
