import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, Group, Checkin, Training, PersonalRecord, Anamnesis } from '../lib/types'

export type CheckinWithTraining = Checkin & { trainings: Training | null }

export function useAdminAlunoDetail(alunoId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [checkins, setCheckins] = useState<CheckinWithTraining[]>([])
  const [records, setRecords] = useState<PersonalRecord[]>([])
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null)
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [email, setEmail] = useState<string | null>(null)
  
  const [metrics, setMetrics] = useState({
    totalCheckins: 0,
    totalRecords: 0,
    bestPace: null as number | null,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!alunoId) return
      setIsLoading(true)
      setError(null)

      try {
        // 1. Profile & All Groups
        const [{ data: profData, error: profErr }, { data: groupsData }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url, birth_date, group_id, has_set_password, level, role, strava_athlete_id, created_at, updated_at').eq('id', alunoId).single(),
          supabase.from('groups').select('id, name, is_active, frequency, goal, plan_type, starts_at, created_at, updated_at, mode').eq('is_active', true).order('name')
        ])

        if (cancelled) return
        if (profErr) throw profErr

        setProfile(profData)
        setAllGroups(groupsData ?? [])

        // 2. Group for profile (if any)
        if (profData?.group_id) {
          const groupData = groupsData?.find(g => g.id === profData.group_id) || null
          if (!cancelled) setGroup(groupData)
        } else {
          setGroup(null)
        }

        const [
          { data: chkData },
          { data: recData },
          { data: anaData }
        ] = await Promise.all([
          supabase.from('checkins').select('id, created_at, actual_pace_seconds_per_km, student_id, training_id, perceived_effort, actual_distance_m, actual_duration_seconds, approved, approved_by, completed_at, notes, plan_id, strava_activity_id, trainings(id, type, title, duration_minutes, distance_m, description, sets, target_pace_seconds_per_km, tags(id, name, color, created_at, created_by, updated_at))').eq('student_id', alunoId).order('created_at', { ascending: false }).limit(100),
          supabase.from('records').select('id, distance_category, time_seconds, achieved_at, checkin_id, created_at, strava_activity_id, student_id').eq('student_id', alunoId).order('distance_category').limit(50),
          supabase.from('anamnesis').select('id, user_id, updated_at, created_at, experience_years, height_cm, max_heart_rate, objectives, physical_limitations, weekly_frequency, weight_kg').eq('user_id', alunoId).maybeSingle(),
        ])

        // RPC chamado separadamente pois get_user_email não está em database.types.ts
        // (função criada manualmente, não via supabase gen types)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: emailData } = await (supabase as any).rpc('get_user_email', { user_id: alunoId })

        if (cancelled) return

        setCheckins((chkData as unknown as CheckinWithTraining[]) ?? [])
        setRecords((recData as PersonalRecord[]) ?? [])
        setAnamnesis(anaData as Anamnesis)
        setEmail(typeof emailData === 'string' ? emailData : null)

        let bestPace: number | null = null
        chkData?.forEach(c => {
          if (c.actual_pace_seconds_per_km) {
            if (bestPace === null || c.actual_pace_seconds_per_km < bestPace) {
              bestPace = c.actual_pace_seconds_per_km
            }
          }
        })

        setMetrics({
          totalCheckins: chkData?.length ?? 0,
          totalRecords: recData?.length ?? 0,
          bestPace,
        })

      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar os dados do aluno')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [alunoId])

  const changeGroup = async (groupId: string | null) => {
    if (!alunoId) return
    const { error: updErr } = await supabase.from('profiles').update({ group_id: groupId }).eq('id', alunoId)
    if (updErr) throw updErr
    
    // Refresh group data
    setProfile(p => p ? { ...p, group_id: groupId } : null)
    if (groupId) {
      const newGroup = allGroups.find(g => g.id === groupId) ?? null
      setGroup(newGroup)
    } else {
      setGroup(null)
    }
  }

  return {
    profile,
    group,
    checkins,
    records,
    anamnesis,
    allGroups,
    metrics,
    isLoading,
    error,
    changeGroup,
    email
  }
}
