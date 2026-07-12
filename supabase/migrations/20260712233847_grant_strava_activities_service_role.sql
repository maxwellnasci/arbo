-- Fix: strava-sync (service_role) tentava upsert em strava_activities e
-- recebia 403 desde a criação da tabela (Task 68, 2026-07-04) — GRANT
-- nunca incluiu INSERT/UPDATE para service_role, diferente de
-- strava_connections e strava_analysis (escritas pela mesma feature, com
-- GRANT correto). O erro era engolido silenciosamente em
-- strava-sync/index.ts (só console.error, resposta ao cliente continuava
-- 200 com os dados vindos ao vivo da API do Strava), então nunca gerou
-- sintoma visível — strava_activities ficou com 0 linhas persistidas para
-- qualquer usuário, sempre, até isso quebrar a feature de "importar do
-- Strava" no check-in (2026-07-12), que foi a primeira coisa a de fato
-- reler a tabela em vez de confiar só na resposta ao vivo da function.

GRANT INSERT, UPDATE ON strava_activities TO service_role;
