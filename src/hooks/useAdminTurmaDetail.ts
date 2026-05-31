import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Group, GroupPlan, Training } from '../lib/types'

export type GroupDayTraining = {
  id: string
  weekNumber: number
  dayOfWeek: number
  training: Training
}

export type UseAdminTurmaDetailResult = {
  group: Group | null
  plan: GroupPlan | null
  trainings: GroupDayTraining[]
  cycleStart: string          // YYYY-MM-DD, início do bloco de 4 semanas atual
  defaultWeekNumber: number   // 1–4, semana atual dentro do ciclo
  isLoading: boolean
  error: string | null
  refresh: () => void
}

type RawGPT = {
  id: string
  week_number: number
  day_of_week: number
  trainings: Training
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCurrentCycle(startsAt: string): { cycleStart: string; weekNumber: number } {
  const origin = new Date(startsAt)
  const today = new Date()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksElapsed = Math.max(0, Math.floor((today.getTime() - origin.getTime()) / msPerWeek))
  const cycleIndex = Math.floor(weeksElapsed / 4)
  const cycleStartDate = new Date(origin.getTime() + cycleIndex * 4 * msPerWeek)
  return {
    cycleStart: toDateString(cycleStartDate),
    weekNumber: (weeksElapsed % 4) + 1,
  }
}

export function useAdminTurmaDetail(groupId: string): UseAdminTurmaDetailResult {
  const [group, setGroup] = useState<Group | null>(null)
  const [plan, setPlan] = useState<GroupPlan | null>(null)
  const [trainings, setTrainings] = useState<GroupDayTraining[]>([])
  const [cycleStart, setCycleStart] = useState('')
  const [defaultWeekNumber, setDefaultWeekNumber] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      const { data: groupData, error: groupErr } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (cancelled) return
      if (groupErr) { setError(groupErr.message); setIsLoading(false); return }

      setGroup(groupData)

      const startsAt = groupData.starts_at ?? toDateString(new Date())
      const { cycleStart: cs, weekNumber: wn } = getCurrentCycle(startsAt)
      setCycleStart(cs)
      setDefaultWeekNumber(wn)

      const { data: planData, error: planErr } = await supabase
        .from('group_plans')
        .select('*')
        .eq('group_id', groupId)
        .eq('starts_at', cs)
        .maybeSingle()

      if (cancelled) return
      if (planErr) { setError(planErr.message); setIsLoading(false); return }

      setPlan(planData)

      if (!planData) { setTrainings([]); setIsLoading(false); return }

      const { data: gptData, error: gptErr } = await supabase
        .from('group_plan_trainings')
        .select('*, trainings(*)')
        .eq('group_plan_id', planData.id)
        .order('week_number')
        .order('day_of_week')

      if (cancelled) return
      if (gptErr) { setError(gptErr.message); setIsLoading(false); return }

      setTrainings(
        ((gptData ?? []) as unknown as RawGPT[])
          .filter(r => r.trainings)
          .map(r => ({
            id: r.id,
            weekNumber: r.week_number,
            dayOfWeek: r.day_of_week,
            training: r.trainings,
          }))
      )
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [groupId, tick])

  return { group, plan, trainings, cycleStart, defaultWeekNumber, isLoading, error, refresh }
}
