// src/hooks/useWeeklyPlan.ts
import { useReducer, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, Training, WeeklyPlan, Checkin } from '../lib/types'

export type DayTraining = {
  weeklyPlanTrainingId: string
  dayOfWeek: number | null   // null = flexível sem agendamento ainda
  training: Training
  checkin: Checkin | null
  scheduleId?: string        // preenchido apenas no modo flexível
}

export type LastWeekSummary = {
  checkinCount: number
  totalDistanceM: number
  avgPaceSecondsPerKm: number | null
}

export type UseWeeklyPlanResult = {
  profile: Profile | null
  plan: WeeklyPlan | null
  groupMode: string | null
  trainings: DayTraining[]
  checkins: Checkin[]
  isLocked: boolean
  lockedWeekNumber: number
  lastWeekSummary: LastWeekSummary | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

type RawPlanTraining = {
  id: string
  training_id: string
  day_of_week: number | null
  trainings: Training
}

type ScheduleRow = {
  id: string
  group_plan_training_id: string
  scheduled_day_of_week: number
}

type State = {
  profile: Profile | null
  plan: WeeklyPlan | null
  groupMode: string | null
  trainings: DayTraining[]
  checkins: Checkin[]
  isLocked: boolean
  lockedWeekNumber: number
  lastWeekSummary: LastWeekSummary | null
  isLoading: boolean
  error: string | null
  tick: number
}

type Action =
  | { type: 'REFRESH' }
  | { type: 'SUCCESS'; profile: Profile | null; plan: WeeklyPlan | null; groupMode: string | null; trainings: DayTraining[]; checkins: Checkin[]; isLocked: boolean; lockedWeekNumber: number; lastWeekSummary: LastWeekSummary | null }
  | { type: 'ERROR'; message: string }
  | { type: 'DONE' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'REFRESH':
      return { ...state, tick: state.tick + 1 }
    case 'SUCCESS':
      return {
        ...state,
        profile: action.profile,
        plan: action.plan,
        groupMode: action.groupMode,
        trainings: action.trainings,
        checkins: action.checkins,
        isLocked: action.isLocked,
        lockedWeekNumber: action.lockedWeekNumber,
        lastWeekSummary: action.lastWeekSummary,
        error: null,
      }
    case 'ERROR':
      return { ...state, error: action.message }
    case 'DONE':
      return { ...state, isLoading: false }
    default:
      return state
  }
}

function getMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getGroupPlanWeekNumber(cycleStartStr: string, weekStartStr: string): number {
  const cycleStart = new Date(cycleStartStr)
  const weekStart = new Date(weekStartStr)
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return Math.floor((weekStart.getTime() - cycleStart.getTime()) / msPerWeek) + 1
}

function subtractOneWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function computeLastWeekSummary(checkins: { actual_distance_m: number | null; actual_duration_seconds: number | null }[]): LastWeekSummary {
  const checkinCount = checkins.length
  const totalDistanceM = checkins.reduce((sum, c) => sum + (c.actual_distance_m ?? 0), 0)
  const withPace = checkins.filter(c => (c.actual_distance_m ?? 0) > 0 && (c.actual_duration_seconds ?? 0) > 0)
  const avgPaceSecondsPerKm = withPace.length > 0
    ? Math.round(withPace.reduce((sum, c) => sum + (c.actual_duration_seconds! / (c.actual_distance_m! / 1000)), 0) / withPace.length)
    : null
  return { checkinCount, totalDistanceM, avgPaceSecondsPerKm }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type FetchResult = {
  profile: Profile | null
  plan: WeeklyPlan | null
  groupMode: string | null
  rawTrainings: RawPlanTraining[]
  schedByGptId: Map<string, ScheduleRow>
  checkins: Checkin[]
  isLocked: boolean
  lockedWeekNumber: number
  lastWeekSummary: LastWeekSummary | null
}

async function fetchWithRetry(userId: string, signal: { cancelled: boolean }, attempt = 0): Promise<FetchResult> {
  try {
    const weekStart = getMonday()

    const [profileRes, planRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url, birth_date, group_id, has_set_password, level, role, strava_athlete_id, created_at, updated_at').eq('id', userId).single(),
      supabase
        .from('weekly_plans')
        .select('id, student_id, week_start, notes, created_at, created_by')
        .eq('student_id', userId)
        .eq('week_start', weekStart)
        .maybeSingle(),
    ])

    if (profileRes.error) throw profileRes.error
    if (planRes.error) throw planRes.error

    const emptyResult: FetchResult = {
      profile: profileRes.data,
      plan: null,
      groupMode: null,
      rawTrainings: [],
      schedByGptId: new Map(),
      checkins: [],
      isLocked: false,
      lockedWeekNumber: 0,
      lastWeekSummary: null,
    }

    if (!planRes.data) {
      const groupId = profileRes.data?.group_id
      if (!groupId) return emptyResult

      const [groupPlanRes, groupRes] = await Promise.all([
        supabase
          .from('group_plans')
          .select('id, starts_at, released_through_week')
          .eq('group_id', groupId)
          .lte('starts_at', weekStart)
          .order('starts_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('groups').select('mode').eq('id', groupId).single(),
      ])

      const groupPlan = groupPlanRes.data
      const groupMode: string = groupRes.data?.mode ?? 'fixo'

      if (!groupPlan) return emptyResult

      const cycleEnd = new Date(groupPlan.starts_at)
      cycleEnd.setDate(cycleEnd.getDate() + 28)
      if (new Date(weekStart) >= cycleEnd) return emptyResult

      const weekNumber = getGroupPlanWeekNumber(groupPlan.starts_at, weekStart)

      if (weekNumber > (groupPlan.released_through_week ?? 0)) {
        let lastWeekSummary: LastWeekSummary | null = null
        if (weekNumber > 1) {
          const previousMonday = subtractOneWeek(weekStart)
          const { data: prevCheckins } = await supabase
            .from('checkins')
            .select('actual_distance_m, actual_duration_seconds')
            .eq('student_id', userId)
            .gte('created_at', previousMonday)
            .lt('created_at', addOneDay(weekStart))
          lastWeekSummary = computeLastWeekSummary(prevCheckins ?? [])
        }
        return { ...emptyResult, isLocked: true, lockedWeekNumber: weekNumber, lastWeekSummary, groupMode }
      }

      const { data: gptData, error: gptError } = await supabase
        .from('group_plan_trainings')
        .select('id, group_plan_id, week_number, day_of_week, training_id, trainings(id, title, duration_minutes, distance_m, type, description, sets, target_pace_seconds_per_km, video_url, tags(id, name, color, created_at, created_by, updated_at))')
        .eq('group_plan_id', groupPlan.id)
        .eq('week_number', weekNumber)
        .order('day_of_week')

      if (gptError) throw gptError

      const rawTrainings = (gptData ?? []) as unknown as RawPlanTraining[]

      // Para modo flexível, busca agendamentos do aluno para este ciclo
      let schedByGptId: Map<string, ScheduleRow> = new Map()
      if (groupMode === 'flexivel' && rawTrainings.length > 0) {
        const gptIds = rawTrainings.map(r => r.id)
        const { data: schedData } = await supabase
          .from('schedules')
          .select('id, group_plan_training_id, scheduled_day_of_week')
          .eq('student_id', userId)
          .in('group_plan_training_id', gptIds)
        schedByGptId = new Map((schedData ?? []).map(s => [s.group_plan_training_id, s]))
      }

      return {
        profile: profileRes.data,
        plan: null,
        groupMode,
        rawTrainings,
        schedByGptId,
        checkins: [],
        isLocked: false,
        lockedWeekNumber: 0,
        lastWeekSummary: null,
      }
    }

    const planId = planRes.data.id

    const [trainingsRes, checkinsRes] = await Promise.all([
      supabase
        .from('weekly_plan_trainings')
        .select('id, plan_id, training_id, day_of_week, sort_order, trainings(id, title, duration_minutes, distance_m, type, description, sets, target_pace_seconds_per_km, video_url, tags(id, name, color, created_at, created_by, updated_at))')
        .eq('plan_id', planId)
        .order('day_of_week'),
      supabase
        .from('checkins')
        .select('id, training_id, actual_distance_m, actual_duration_seconds, actual_pace_seconds_per_km, perceived_effort, approved, approved_by, completed_at, created_at, notes, plan_id, strava_activity_id, student_id')
        .eq('student_id', userId)
        .eq('plan_id', planId),
    ])

    if (trainingsRes.error) throw trainingsRes.error
    if (checkinsRes.error) throw checkinsRes.error

    return {
      profile: profileRes.data,
      plan: planRes.data,
      groupMode: null,
      rawTrainings: (trainingsRes.data ?? []) as unknown as RawPlanTraining[],
      schedByGptId: new Map(),
      checkins: checkinsRes.data ?? [],
      isLocked: false,
      lockedWeekNumber: 0,
      lastWeekSummary: null,
    }
  } catch (err: unknown) {
    if (attempt < 2 && !signal.cancelled) {
      await sleep(1000 * Math.pow(2, attempt))
      if (signal.cancelled) throw err
      return fetchWithRetry(userId, signal, attempt + 1)
    }
    throw err
  }
}

const initialState: State = {
  profile: null,
  plan: null,
  groupMode: null,
  trainings: [],
  checkins: [],
  isLocked: false,
  lockedWeekNumber: 0,
  lastWeekSummary: null,
  isLoading: false,
  error: null,
  tick: 0,
}

export function useWeeklyPlan(userId: string | undefined): UseWeeklyPlanResult {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    isLoading: !!userId,
  })

  const refresh = useCallback(() => dispatch({ type: 'REFRESH' }), [])

  useEffect(() => {
    if (!userId) return

    const sig = { cancelled: false }

    fetchWithRetry(userId, sig)
      .then(({ profile, plan, groupMode, rawTrainings, schedByGptId, checkins, isLocked, lockedWeekNumber, lastWeekSummary }) => {
        if (sig.cancelled) return
        dispatch({
          type: 'SUCCESS',
          profile,
          plan,
          groupMode,
          trainings: rawTrainings
            .flatMap(wpt => {
              const training = wpt.trainings
              if (!training) return []
              const sched = schedByGptId.get(wpt.id)
              const dt: DayTraining = {
                weeklyPlanTrainingId: wpt.id,
                // Modo fixo: usa day_of_week do plano. Modo flexível: usa dia agendado pelo aluno (ou null)
                dayOfWeek: sched?.scheduled_day_of_week ?? wpt.day_of_week ?? null,
                training,
                checkin: checkins.find(c => c.training_id === wpt.training_id) ?? null,
                scheduleId: sched?.id,
              }
              return [dt]
            }),
          checkins,
          isLocked,
          lockedWeekNumber,
          lastWeekSummary,
        })
      })
      .catch(err => {
        if (sig.cancelled) return
        dispatch({ type: 'ERROR', message: err instanceof Error ? err.message : 'Erro ao carregar dados.' })
      })
      .finally(() => {
        if (!sig.cancelled) dispatch({ type: 'DONE' })
      })

    return () => { sig.cancelled = true }
  }, [userId, state.tick])

  const { profile, plan, groupMode, trainings, checkins, isLocked, lockedWeekNumber, lastWeekSummary, isLoading, error } = state
  return { profile, plan, groupMode, trainings, checkins, isLocked, lockedWeekNumber, lastWeekSummary, isLoading, error, refresh }
}
