-- Rastreia se o aluno já abriu/leu o feedback do professor no check-in
-- (opção B da análise de 2026-07-13) — permite o badge "não lido" sumir
-- depois da primeira visualização. checkins_update já permite
-- student_id = auth.uid() escrever a própria linha, então o próprio aluno
-- grava isso sem precisar de service_role nem policy nova.
ALTER TABLE checkins ADD COLUMN professor_feedback_seen_at timestamptz;
