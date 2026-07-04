import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type StravaActivitySummary = {
  id: number
  name: string
  distanceKm: number
  paceSecondsPerKm: number | null
  date: string
}

async function callFunction(path: string, options: RequestInit = {}) {
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
  const [activities, setActivities] = useState<StravaActivitySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await callFunction('strava-connection', { method: 'GET' })
      setIsConnected(Boolean(data.isConnected))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao verificar conexão com o Strava.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      await checkStatus()
      if (cancelled) return
    }
    load()
    return () => { cancelled = true }
  }, [checkStatus])

  const syncActivities = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true)
    setError(null)
    try {
      const data = await callFunction('strava-sync', { method: 'POST' })
      setActivities(data.activities ?? [])
      return true
    } catch (e: unknown) {
      console.error('Erro ao sincronizar atividades do Strava:', e)
      setError(e instanceof Error ? e.message : 'Erro ao sincronizar atividades.')
      return false
    } finally {
      setIsSyncing(false)
    }
  }, [])

  const disconnect = useCallback(async (): Promise<boolean> => {
    setError(null)
    try {
      await callFunction('strava-connection', { method: 'DELETE' })
      setIsConnected(false)
      setActivities([])
      return true
    } catch (e: unknown) {
      console.error('Erro ao desconectar do Strava:', e)
      setError(e instanceof Error ? e.message : 'Erro ao desconectar do Strava.')
      return false
    }
  }, [])

  return { isConnected, activities, isLoading, isSyncing, error, syncActivities, disconnect, refresh: checkStatus }
}
