import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { TrainingProgram } from '../lib/types'

export interface UseTrainingProgramsReturn {
  programs: TrainingProgram[]
  isLoading: boolean
  error: string | null
  createProgram: (name: string, description: string, color: string) => Promise<TrainingProgram | null>
  updateProgramName: (id: string, name: string) => Promise<{ error: string | null }>
  deleteProgram: (id: string) => Promise<{ error: string | null }>
  refetch: () => void
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function useTrainingPrograms(): UseTrainingProgramsReturn {
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchFlag, setRefetchFlag] = useState(0)

  const refetch = useCallback(() => {
    setRefetchFlag(prev => prev + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('training_programs')
          .select('*')
          .order('created_at', { ascending: true })

        if (cancelled) return
        if (fetchError) throw fetchError
        setPrograms(data ?? [])
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar bibliotecas')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [refetchFlag])

  const createProgram = useCallback(async (name: string, description: string, color: string): Promise<TrainingProgram | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Sessão expirada. Recarregue a página.')
      return null
    }

    const slug = slugify(name)
    const { data, error: insertError } = await supabase
      .from('training_programs')
      .insert({ name, slug, description: description || null, color, created_by: user.id })
      .select()
      .single()

    if (insertError || !data) {
      if (insertError?.code === '23505') setError('Já existe uma biblioteca com esse nome')
      else setError(insertError?.message ?? 'Erro ao criar biblioteca')
      return null
    }

    setPrograms(prev => [...prev, data])
    return data
  }, [])

  const updateProgramName = useCallback(async (id: string, name: string): Promise<{ error: string | null }> => {
    const { data, error: updateError } = await supabase
      .from('training_programs')
      .update({ name })
      .eq('id', id)
      .select()
      .single()
    if (updateError || !data) return { error: updateError?.message ?? 'Erro ao renomear' }
    setPrograms(prev => prev.map(p => p.id === id ? data : p))
    return { error: null }
  }, [])

  const deleteProgram = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error: deleteError } = await supabase.from('training_programs').delete().eq('id', id)
    if (deleteError) return { error: deleteError.message }
    setPrograms(prev => prev.filter(p => p.id !== id))
    return { error: null }
  }, [])

  return { programs, isLoading, error, createProgram, updateProgramName, deleteProgram, refetch }
}
