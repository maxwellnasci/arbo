import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type StravaActivityRaw = {
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  total_elevation_gain?: number
  suffer_score?: number
  moving_time?: number
  elapsed_time?: number
}

// Busca sob demanda o raw (jsonb) da atividade Strava vinculada a um checkin —
// só chamado quando o modal de detalhe do check-in abre e strava_activity_id
// está preenchido, nunca no carregamento da lista inteira de checkins.
export function useStravaActivityRaw(stravaActivityId: number | null) {
  const [raw, setRaw] = useState<StravaActivityRaw | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!stravaActivityId) { setRaw(null); return }
      setIsLoading(true)
      const { data, error } = await supabase
        .from('strava_activities')
        .select('raw')
        .eq('strava_id', stravaActivityId)
        .maybeSingle()

      if (cancelled) return
      setIsLoading(false)

      if (error) {
        console.error('Erro ao buscar dado bruto da atividade Strava:', error.message)
        return
      }
      setRaw((data?.raw as StravaActivityRaw | null) ?? null)
    }
    load()
    return () => { cancelled = true }
  }, [stravaActivityId])

  return { raw, isLoading }
}
