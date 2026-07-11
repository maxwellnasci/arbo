import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { TrainingType } from '../lib/types'

export type NewTrainingInput = {
  title: string
  type: TrainingType
  distance_m?: number
  target_pace_seconds_per_km?: number
  sets?: number
  description?: string
  tag_id?: string
}

async function ensureGroupPlan(
  groupId: string,
  cycleStart: string,
  createdBy: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('group_plans')
    .select('id')
    .eq('group_id', groupId)
    .eq('starts_at', cycleStart)
    .maybeSingle()

  if (existing) return existing.id

  const { data, error } = await supabase
    .from('group_plans')
    .insert({ group_id: groupId, starts_at: cycleStart, created_by: createdBy })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

export function useGroupPlanMutations(
  groupId: string,
  cycleStart: string,
  currentPlanId: string | null,
) {
  const { user } = useAuth()

  const addTraining = useCallback(
    async (weekNumber: number, dayOfWeek: number | null, trainingId: string) => {
      if (!user) throw new Error('Não autenticado')
      const planId = currentPlanId ?? await ensureGroupPlan(groupId, cycleStart, user.id)
      const { error } = await supabase
        .from('group_plan_trainings')
        .insert({ group_plan_id: planId, week_number: weekNumber, day_of_week: dayOfWeek, training_id: trainingId })
      if (error) throw new Error(error.message)
    },
    [groupId, cycleStart, currentPlanId, user],
  )

  const removeTraining = useCallback(async (groupPlanTrainingId: string) => {
    const { error } = await supabase
      .from('group_plan_trainings')
      .delete()
      .eq('id', groupPlanTrainingId)
    if (error) throw new Error(error.message)
  }, [])

  const createAndAddTraining = useCallback(
    async (weekNumber: number, dayOfWeek: number | null, input: NewTrainingInput) => {
      if (!user) throw new Error('Não autenticado')
      const { data: newTraining, error: tErr } = await supabase
        .from('trainings')
        .insert({ program: 'treinos_gerais', ...input, created_by: user.id })
        .select('id')
        .single()
      if (tErr) throw new Error(tErr.message)

      const planId = currentPlanId ?? await ensureGroupPlan(groupId, cycleStart, user.id)
      const { error: gptErr } = await supabase
        .from('group_plan_trainings')
        .insert({ group_plan_id: planId, week_number: weekNumber, day_of_week: dayOfWeek, training_id: newTraining.id })
      if (gptErr) throw new Error(gptErr.message)
    },
    [groupId, cycleStart, currentPlanId, user],
  )

  const releaseThrough = useCallback(
    async (weekNumber: 0 | 1 | 2 | 3 | 4) => {
      if (!currentPlanId) throw new Error('Plano não encontrado')
      const { error } = await supabase
        .from('group_plans')
        .update({ released_through_week: weekNumber })
        .eq('id', currentPlanId)
      if (error) throw new Error(error.message)
    },
    [currentPlanId],
  )

  const deleteGroup = useCallback(async (targetGroupId: string) => {
    const { error } = await supabase.from('groups').delete().eq('id', targetGroupId)
    if (error) throw new Error(error.message)
  }, [])

  return { addTraining, removeTraining, createAndAddTraining, releaseThrough, deleteGroup }
}
