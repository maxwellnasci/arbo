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
          supabase.from('profiles').select('*').eq('id', alunoId).single(),
          supabase.from('groups').select('*').eq('is_active', true).order('name')
        ])

        if (cancelled) return
        if (profErr) throw profErr

        setProfile(profData)
        setAllGroups(groupsData ?? [])

        // 2. Group for profile (if any)
        if (profData?.group_id) {
          const { data: groupData } = await supabase.from('groups').select('*').eq('id', profData.group_id).single()
          if (!cancelled) setGroup(groupData)
        } else {
          setGroup(null)
        }

        // 3. Other Data
        const [
          { data: chkData },
          { data: recData },
          { data: anaData }
        ] = await Promise.all([
          supabase.from('checkins').select('*, trainings(*)').eq('student_id', alunoId).order('created_at', { ascending: false }),
          supabase.from('records').select('*').eq('student_id', alunoId).order('distance_category'),
          supabase.from('anamnesis').select('*').eq('user_id', alunoId).maybeSingle()
        ])

        if (cancelled) return

        setCheckins((chkData as unknown as CheckinWithTraining[]) ?? [])
        setRecords(recData ?? [])
        setAnamnesis(anaData)

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
      const { data: newGroup } = await supabase.from('groups').select('*').eq('id', groupId).single()
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
    changeGroup
  }
}
