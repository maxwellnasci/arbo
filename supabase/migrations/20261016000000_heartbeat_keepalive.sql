-- Heartbeat do keep-alive: a RPC keepalive() antiga só fazia SELECT now(),
-- que roda em memória e não gera escrita em disco/WAL nem movimenta
-- pg_stat_user_tables. Agora cada chamada faz um UPSERT numa tabela de uma
-- linha só (escrita real) e uma leitura numa tabela de negócio.
-- Chamada diariamente pelo .github/workflows/keep-alive.yml (POST /rest/v1/rpc/keepalive).

CREATE TABLE IF NOT EXISTS public.app_heartbeat (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_beat timestamptz NOT NULL DEFAULT now(),
  beat_count bigint NOT NULL DEFAULT 1
);

-- RLS sem policies + sem GRANT: nenhum cliente lê ou escreve direto.
-- A única porta é a RPC abaixo (SECURITY DEFINER).
ALTER TABLE public.app_heartbeat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_heartbeat FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.keepalive()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count bigint;
  v_trainings int;
BEGIN
  -- 1. Força escrita real no disco (WAL + n_tup_upd em pg_stat_user_tables)
  INSERT INTO public.app_heartbeat (id, last_beat, beat_count)
  VALUES (1, pg_catalog.now(), 1)
  ON CONFLICT (id) DO UPDATE
    SET last_beat = pg_catalog.now(),
        beat_count = public.app_heartbeat.beat_count + 1
  RETURNING beat_count INTO v_count;

  -- 2. Força leitura real em tabela de usuário (seq_scan/idx_scan).
  -- A contagem não é devolvida: a RPC é pública (anon) e, como SECURITY
  -- DEFINER ignora RLS, revelaria o total de treinos de todas as assessorias.
  SELECT count(*) INTO v_trainings FROM public.trainings;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'ok',
    'beat_count', v_count,
    'read_ok', v_trainings IS NOT NULL,
    'timestamp', pg_catalog.now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.keepalive() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keepalive() TO anon, authenticated, service_role;
