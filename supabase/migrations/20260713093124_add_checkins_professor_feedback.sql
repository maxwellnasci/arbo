-- Feedback real do professor por check-in (campo simples, sem histórico —
-- decisão registrada na análise de 2026-07-13). checkins_update já permite
-- private.is_admin() escrever qualquer linha, então nenhuma policy nova é
-- necessária, só as colunas.
ALTER TABLE checkins
  ADD COLUMN professor_feedback text,
  ADD COLUMN professor_feedback_at timestamptz;
