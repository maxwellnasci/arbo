-- Feature: Domingo como dia agendável (aluno modo flexível) e atribuível
-- (admin modo fixo).
--
-- Convenção já existente no código (não nova): dayDate()/weekRange() em
-- AdminTurmaDetail.tsx calculam a data de um dia como
-- cycleStart + (dayOfWeek - 1), e o fim da semana como cycleStart + 6 —
-- ou seja, o esquema 1=Segunda..6=Sábado já trata a semana como 7 dias
-- terminando no dia 7. Domingo = 7 (não 0) é a extensão que já estava
-- implícita nessa matemática, e evita colidir com o sentinela `?? 0`
-- usado em vários lugares do código para "day_of_week não atribuído"
-- (ex.: useAdminTurmaDetail.ts, FlexibleTrainingCard.tsx) — se Domingo
-- fosse 0, um treino agendado para domingo seria indistinguível de um
-- treino sem dia nenhum nesses pontos.

ALTER TABLE public.schedules
  DROP CONSTRAINT schedules_scheduled_day_of_week_check,
  ADD CONSTRAINT schedules_scheduled_day_of_week_check
    CHECK (scheduled_day_of_week >= 1 AND scheduled_day_of_week <= 7);

ALTER TABLE public.group_plan_trainings
  DROP CONSTRAINT group_plan_trainings_day_of_week_check,
  ADD CONSTRAINT group_plan_trainings_day_of_week_check
    CHECK (day_of_week >= 1 AND day_of_week <= 7);
