import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type StravaActivitySummary = {
  id: number
  name: string
  distanceKm: number
  paceSecondsPerKm: number | null
  durationSeconds: number
  date: string
}

// Exportado para reuso em useAdminStravaActivities.ts — mesma forma de chamada
// autenticada contra as Edge Functions do Strava, só muda o path/body.
export async function callStravaFunction(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Erro ao comunicar com o Strava.')
  }

  return res.json()
}

export function useStravaConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [athleteId, setAthleteId] = useState<number | null>(null)
  const [connectedAt, setConnectedAt] = useState<string | null>(null)
  const [activities, setActivities] = useState<StravaActivitySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = useCallback(async (): Promise<boolean> => {
    setError(null)
    try {
      const data = await callStravaFunction('strava-sync', { method: 'POST' })
      setActivities(data.activities ?? [])
      return true
    } catch (e: unknown) {
      console.error('Erro ao sincronizar atividades do Strava:', e)
      setError(e instanceof Error ? e.message : 'Erro ao sincronizar atividades.')
      return false
    }
  }, [])

  const checkStatus = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await callStravaFunction('strava-connection', { method: 'GET' })
      const connected = Boolean(data.isConnected)
      setIsConnected(connected)
      setAthleteId(typeof data.athleteId === 'number' ? data.athleteId : null)
      setConnectedAt(typeof data.connectedAt === 'string' ? data.connectedAt : null)
      return connected
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao verificar conexão com o Strava.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const connected = await checkStatus()
      if (cancelled || !connected) return
      setIsLoadingActivities(true)
      await fetchActivities()
      if (!cancelled) setIsLoadingActivities(false)
    }
    load()
    return () => { cancelled = true }
  }, [checkStatus, fetchActivities])

  const syncActivities = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true)
    const ok = await fetchActivities()
    setIsSyncing(false)
    return ok
  }, [fetchActivities])

  const disconnect = useCallback(async (): Promise<boolean> => {
    setError(null)
    try {
      await callStravaFunction('strava-connection', { method: 'DELETE' })
      setIsConnected(false)
      setAthleteId(null)
      setConnectedAt(null)
      setActivities([])
      return true
    } catch (e: unknown) {
      console.error('Erro ao desconectar do Strava:', e)
      setError(e instanceof Error ? e.message : 'Erro ao desconectar do Strava.')
      return false
    }
  }, [])

  return {
    isConnected,
    athleteId,
    connectedAt,
    activities,
    isLoading,
    isLoadingActivities,
    isSyncing,
    error,
    syncActivities,
    disconnect,
    refresh: checkStatus,
  }
}
