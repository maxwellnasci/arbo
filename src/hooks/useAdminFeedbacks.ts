import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Checkin, Profile } from '../lib/types'

export type FeedbackItem = Checkin & {
  profiles: Profile
  hasPR: boolean
}

export function useAdminFeedbacks() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchFeedbacks() {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const sinceIso = since.toISOString()

      const [{ data: checkins, error: checkinError }, { data: records }] = await Promise.all([
        supabase
          .from('checkins')
          .select('id, training_id, actual_distance_m, actual_duration_seconds, actual_pace_seconds_per_km, perceived_effort, approved, approved_by, completed_at, created_at, notes, plan_id, strava_activity_id, student_id, profiles!checkins_student_id_fkey(id, full_name, avatar_url, birth_date, group_id, has_set_password, level, role, strava_athlete_id, created_at, updated_at)')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('records')
          .select('student_id, created_at')
          .gte('created_at', sinceIso),
      ])

      if (cancelled) return

      if (checkinError) {
        setError(checkinError.message)
        setIsLoading(false)
        return
      }

      // PR no mesmo dia = record com mesmo student_id e mesma data (UTC)
      const prDays = new Set(
        (records ?? []).map(r => `${r.student_id}:${r.created_at?.slice(0, 10)}`)
      )

      setFeedbacks(
        (checkins ?? []).map(c => ({
          ...c,
          profiles: (c as unknown as { profiles: Profile }).profiles,
          hasPR: prDays.has(`${c.student_id}:${c.created_at?.slice(0, 10)}`),
        }))
      )
      setIsLoading(false)
    }

    fetchFeedbacks()
    return () => { cancelled = true }
  }, [])

  return { feedbacks, isLoading, error }
}
