import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { callStravaFunction, type StravaActivitySummary, type StravaActivityAnalysis } from './useStravaConnection'

// strava-sync retorna texto puro (não JSON) para respostas de erro — usado
// para distinguir "aluno nunca conectou o Strava" de outras falhas (rede, 500).
const NOT_CONNECTED_MESSAGE = 'Nenhuma conexão com o Strava encontrada.'

async function fetchLatestStravaAnalysis(studentId: string): Promise<StravaActivityAnalysis | null> {
  const { data, error } = await supabase
    .from('strava_analysis')
    .select('summary, analysis, tip')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Erro ao buscar análise Strava do aluno:', error.message)
    return null
  }
  return data ?? null
}

export function useAdminStravaActivities(studentId: string | undefined) {
  const [activities, setActivities] = useState<StravaActivitySummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)
  const [latestAnalysis, setLatestAnalysis] = useState<StravaActivityAnalysis | null>(null)

  const sync = useCallback(async (): Promise<boolean> => {
    if (!studentId) return false
    setIsLoading(true)
    setError(null)
    setNotConnected(false)
    try {
      const data = await callStravaFunction('strava-sync', {
        method: 'POST',
        body: JSON.stringify({ studentId }),
      })
      setActivities(data.activities ?? [])
      return true
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao buscar atividades do Strava.'
      if (message === NOT_CONNECTED_MESSAGE) {
        setNotConnected(true)
      } else {
        console.error('Erro ao buscar atividades Strava do aluno:', message)
        setError(message)
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!studentId) return
      await sync()
      if (cancelled) return
    }
    load()
    return () => { cancelled = true }
  }, [studentId, sync])

  // Leitura direta da tabela (RLS: admin vê todas) — independente do sync,
  // mostra a última análise já persistida assim que a página do aluno abre.
  useEffect(() => {
    let cancelled = false
    async function loadAnalysis() {
      if (!studentId) return
      const analysis = await fetchLatestStravaAnalysis(studentId)
      if (!cancelled) setLatestAnalysis(analysis)
    }
    loadAnalysis()
    return () => { cancelled = true }
  }, [studentId])

  return { activities, isLoading, error, notConnected, latestAnalysis, sync }
}
