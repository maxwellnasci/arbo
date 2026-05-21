// src/hooks/useWeeklyPlan.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, Training, WeeklyPlan, WeeklyPlanTraining, Checkin } from '../lib/types'

export type DayTraining = {
  weeklyPlanTrainingId: string
  dayOfWeek: number
  training: Training
  checkin: Checkin | null
}

export type UseWeeklyPlanResult = {
  profile: Profile | null
  plan: WeeklyPlan | null
  trainings: DayTraining[]
  checkins: Checkin[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

type RawPlanTraining = WeeklyPlanTraining & { trainings: Training }

function getMonday(): string {
  const d = new Date()
  const day = d.getDay() // 0=Dom, 1=Seg, ..., 6=Sáb
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(userId: string, attempt = 0): Promise<{
  profile: Profile | null
  plan: WeeklyPlan | null
  rawTrainings: RawPlanTraining[]
  checkins: Checkin[]
}> {
  try {
    const weekStart = getMonday()

    const [profileRes, planRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase
        .from('weekly_plans')
        .select('*')
        .eq('student_id', userId)
        .eq('week_start', weekStart)
        .maybeSingle(),
    ])

    if (profileRes.error) throw profileRes.error
    if (planRes.error) throw planRes.error

    if (!planRes.data) {
      return { profile: profileRes.data, plan: null, rawTrainings: [], checkins: [] }
    }

    const planId = planRes.data.id

    const [trainingsRes, checkinsRes] = await Promise.all([
      supabase
        .from('weekly_plan_trainings')
        .select('*, trainings(*)')
        .eq('plan_id', planId)
        .order('day_of_week'),
      supabase
        .from('checkins')
        .select('*')
        .eq('student_id', userId)
        .eq('plan_id', planId),
    ])

    if (trainingsRes.error) throw trainingsRes.error
    if (checkinsRes.error) throw checkinsRes.error

    return {
      profile: profileRes.data,
      plan: planRes.data,
      rawTrainings: (trainingsRes.data ?? []) as RawPlanTraining[],
      checkins: checkinsRes.data ?? [],
    }
  } catch (err) {
    if (attempt < 2) {
      await sleep(1000 * Math.pow(2, attempt)) // 1s, 2s
      return fetchWithRetry(userId, attempt + 1)
    }
    throw err
  }
}

export function useWeeklyPlan(userId: string | undefined): UseWeeklyPlanResult {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [trainings, setTrainings] = useState<DayTraining[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetchWithRetry(userId)
      .then(({ profile, plan, rawTrainings, checkins }) => {
        if (cancelled) return
        setProfile(profile)
        setPlan(plan)
        setCheckins(checkins)
        setTrainings(
          rawTrainings.map(wpt => ({
            weeklyPlanTrainingId: wpt.id,
            dayOfWeek: wpt.day_of_week,
            training: wpt.trainings,
            checkin: checkins.find(c => c.training_id === wpt.training_id) ?? null,
          }))
        )
      })
      .catch(err => {
        if (cancelled) return
        setError((err as Error)?.message ?? 'Erro ao carregar dados.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [userId, tick])

  return { profile, plan, trainings, checkins, isLoading, error, refresh }
}
