import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Group, GroupPlan, Tag, Training, GroupPlanTraining } from '../lib/types'

export type GroupDayTraining = {
  id: string
  weekNumber: number
  dayOfWeek: number
  training: Training & { tags: Tag | null }
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

type DBGroupPlanTraining = Omit<GroupPlanTraining, 'group_plan_id'> & {
  plan_id: string
  trainings: (Training & { tags: Tag | null }) | null
}

type DBGroupPlan = GroupPlan & {
  group_plan_trainings: DBGroupPlanTraining[]
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
        .select(`
          id, name, is_active, starts_at, frequency, goal, plan_type, created_at, updated_at,
          group_plans(
            id, starts_at, group_id, notes, released_through_week, created_at, created_by, updated_at,
            group_plan_trainings(
              id, week_number, day_of_week, sort_order, plan_id:group_plan_id, training_id,
              trainings(
                id, type, title, duration_minutes, distance_m, description, target_pace_seconds_per_km, sets, tag_id, created_at, created_by, updated_at,
                tags(id, name, color, created_at, created_by, updated_at)
              )
            )
          )
        `)
        .eq('id', groupId)
        .single()

      if (cancelled) return
      if (groupErr) { setError(groupErr.message); setIsLoading(false); return }

      // Extract raw group (excluding relations for state)
      const { group_plans, ...rawGroup } = groupData
      setGroup(rawGroup as Group)

      const startsAt = rawGroup.starts_at ?? toDateString(new Date())
      const { cycleStart: cs, weekNumber: wn } = getCurrentCycle(startsAt)
      setCycleStart(cs)
      setDefaultWeekNumber(wn)

      // Find the plan for current cycle
      const planData = (group_plans as DBGroupPlan[] | null)?.find(p => p.starts_at === cs)
      
      if (!planData) { 
        setPlan(null)
        setTrainings([])
        setIsLoading(false)
        return 
      }

      const { group_plan_trainings, ...rawPlan } = planData
      setPlan(rawPlan as GroupPlan)

      const gptData = group_plan_trainings || []
      setTrainings(
        (gptData as DBGroupPlanTraining[])
          .filter(r => r.trainings)
          .sort((a, b) => a.week_number === b.week_number ? a.day_of_week - b.day_of_week : a.week_number - b.week_number)
          .map(r => ({
            id: r.id,
            weekNumber: r.week_number,
            dayOfWeek: r.day_of_week,
            training: r.trainings!,
          }))
      )
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [groupId, tick])

  return { group, plan, trainings, cycleStart, defaultWeekNumber, isLoading, error, refresh }
}
