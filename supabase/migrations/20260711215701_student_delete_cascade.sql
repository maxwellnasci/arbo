-- Bloqueador 2 (crítico): as 5 constraints abaixo eram NO ACTION (padrão
-- implícito, sem cláusula ON DELETE), então delete-user (que remove o aluno
-- via auth.admin.deleteUser -> CASCADE em profiles_id_fkey -> DELETE em
-- profiles) falhava com 500 sempre que o aluno tinha checkin, record,
-- weekly_plan ou atividade Strava — o histórico ficava "preso" ao aluno,
-- impedindo a exclusão completa exigida por direito ao esquecimento (LGPD).
--
-- Decisão: CASCADE para dado operacional do aluno — ao excluir o aluno,
-- o histórico dele é removido de fato junto.
--
-- Segundo nível avaliado (checkins_plan_id_fkey -> weekly_plans e
-- records_checkin_id_fkey -> checkins, ambas NO ACTION): não precisam de
-- ajuste. checkins/records/weekly_plans de um mesmo aluno são todos
-- removidos na mesma operação de cascade (deleção de profiles), então o
-- checkin que referencia o weekly_plan do próprio aluno — e o record que
-- referencia o checkin do próprio aluno — já estão sendo removidos junto,
-- sem violar a FK. schedules_checkin_id_fkey (SET NULL) e
-- weekly_plan_trainings_plan_id_fkey (CASCADE) já estavam corretas.

ALTER TABLE public.checkins
  DROP CONSTRAINT checkins_student_id_fkey,
  ADD CONSTRAINT checkins_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.records
  DROP CONSTRAINT records_student_id_fkey,
  ADD CONSTRAINT records_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.weekly_plans
  DROP CONSTRAINT weekly_plans_student_id_fkey,
  ADD CONSTRAINT weekly_plans_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.strava_activities
  DROP CONSTRAINT strava_activities_user_id_fkey,
  ADD CONSTRAINT strava_activities_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.strava_connections
  DROP CONSTRAINT strava_connections_user_id_fkey,
  ADD CONSTRAINT strava_connections_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
