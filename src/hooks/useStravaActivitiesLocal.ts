import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type StravaActivityLocal = {
  strava_id: number
  name: string
  distance_m: number
  duration_seconds: number
  pace_seconds_per_km: number | null
  start_date: string
}

// Leitura direta de strava_activities (já sincronizadas via strava-sync) para
// oferecer "importar do Strava" no check-in — não reaproveita useStravaConnection
// porque esse hook dispara strava-sync/strava-analyze no mount, o que bateria
// na API do Strava e no DeepSeek só para abrir um bottom-sheet de check-in, e
// resolveria o usuário pelo JWT da sessão em vez do userId explícito (quebraria
// no modo /preview-aluno). RLS de strava_activities já permite o próprio aluno
// ler as suas via SELECT direto.
export function useStravaActivitiesLocal(userId: string) {
  const [activities, setActivities] = useState<StravaActivityLocal[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('strava_activities')
        .select('strava_id, name, distance_m, duration_seconds, pace_seconds_per_km, start_date')
        .eq('user_id', userId)
        .eq('type', 'Run')
        .order('start_date', { ascending: false })
        .limit(10)

      if (cancelled) return
      setIsLoading(false)

      if (error) {
        console.error('Erro ao buscar atividades do Strava:', error.message)
        return
      }
      setActivities((data ?? []).filter((a): a is StravaActivityLocal => a.strava_id != null))
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  return { activities, isLoading }
}
