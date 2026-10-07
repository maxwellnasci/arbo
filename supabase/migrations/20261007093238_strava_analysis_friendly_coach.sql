-- "Professor Digital Amigo" (Pilar 3, Etapa 1): novo formato da análise
-- automática do Strava gerada pela Edge Function strava-analyze.
--
-- message    → mensagem em tom de conversa de treinador (2 a 4 frases)
-- highlight  → ponto alto do treino
-- next_step  → orientação para o próximo descanso/treino
-- summary    → (já existia) resumo técnico curto
--
-- Colunas novas são nullable: análises antigas (v1) só têm summary/analysis/tip.
-- analysis/tip (NOT NULL) continuam sendo preenchidas pela v2 com
-- message/next_step, para o frontend anterior seguir funcionando na transição.
--
-- prompt_version permite evoluir o prompt sem misturar análises de gerações
-- diferentes: a função regenera a análise quando a versão gravada é menor que a
-- atual. Linhas existentes recebem 1 (DEFAULT aplicado no ADD COLUMN).
--
-- Sem mudança de RLS: a policy de SELECT de strava_analysis e os GRANTs de
-- tabela (authenticated SELECT, service_role SELECT/INSERT/UPDATE) já cobrem as
-- colunas novas.

ALTER TABLE public.strava_analysis
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS highlight text,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS prompt_version smallint NOT NULL DEFAULT 1;

ALTER TABLE public.strava_analysis
  DROP CONSTRAINT IF EXISTS strava_analysis_prompt_version_check;
ALTER TABLE public.strava_analysis
  ADD CONSTRAINT strava_analysis_prompt_version_check CHECK (prompt_version >= 1);

COMMENT ON COLUMN public.strava_analysis.message IS 'Mensagem do treinador (prompt v2+), tom de conversa.';
COMMENT ON COLUMN public.strava_analysis.highlight IS 'Ponto alto do treino (prompt v2+).';
COMMENT ON COLUMN public.strava_analysis.next_step IS 'Orientação para o próximo descanso/treino (prompt v2+).';
COMMENT ON COLUMN public.strava_analysis.prompt_version IS 'Versão do prompt que gerou a análise; 1 = formato summary/analysis/tip original.';

-- strava-analyze v2 lê a atividade e o contexto do aluno no banco (em vez de
-- confiar no body da requisição) usando service_role. service_role ignora RLS,
-- mas NÃO ignora GRANT — e em produção ele só tinha
-- REFERENCES/TRIGGER/TRUNCATE/MAINTAIN nessas tabelas (mesma classe do Caso 13
-- em docs/PORTFOLIO_DEBUG_CASES.md). Só SELECT, nada de escrita.
GRANT SELECT ON TABLE public.profiles TO service_role;
GRANT SELECT ON TABLE public.anamnesis TO service_role;
GRANT SELECT ON TABLE public.checkins TO service_role;
GRANT SELECT ON TABLE public.trainings TO service_role;

-- Em produção strava_activities já tinha GRANT ALL para service_role, aplicado
-- fora de migration (o repositório só registrava INSERT, UPDATE em
-- 20260712233847). Registra aqui o SELECT de que a função depende — no-op em
-- produção, mas garante o privilégio em qualquer banco recriado a partir das
-- migrations.
GRANT SELECT ON TABLE public.strava_activities TO service_role;
