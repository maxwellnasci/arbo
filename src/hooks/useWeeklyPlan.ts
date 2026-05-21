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

type RawPlanTraining = WeeklyPlanTraining & { trainings: Training[] }

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

async function fetchWithRetry(userId: string, signal: { cancelled: boolean }, attempt = 0): Promise<{
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
      rawTrainings: (trainingsRes.data ?? []) as unknown as RawPlanTraining[],
      checkins: checkinsRes.data ?? [],
    }
  } catch (err) {
    if (attempt < 2 && !signal.cancelled) {
      await sleep(1000 * Math.pow(2, attempt)) // 1s, 2s
      if (signal.cancelled) throw err
      return fetchWithRetry(userId, signal, attempt + 1)
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

    const sig = { cancelled: false }
    setIsLoading(true)
    setError(null)

    fetchWithRetry(userId, sig)
      .then(({ profile, plan, rawTrainings, checkins }) => {
        if (sig.cancelled) return
        setProfile(profile)
        setPlan(plan)
        setCheckins(checkins)
        setTrainings(
          rawTrainings
            .map(wpt => {
              const training = wpt.trainings[0]
              if (!training) return null
              return {
                weeklyPlanTrainingId: wpt.id,
                dayOfWeek: wpt.day_of_week,
                training,
                checkin: checkins.find(c => c.training_id === wpt.training_id) ?? null,
              }
            })
            .filter((x): x is DayTraining => x !== null)
        )
      })
      .catch(err => {
        if (sig.cancelled) return
        setError((err as Error)?.message ?? 'Erro ao carregar dados.')
      })
      .finally(() => {
        if (!sig.cancelled) setIsLoading(false)
      })

    return () => { sig.cancelled = true }
  }, [userId, tick])

  return { profile, plan, trainings, checkins, isLoading, error, refresh }
}
