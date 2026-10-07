import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Exercise, TrainingBlockWithExercise } from '../lib/modalities'

const BLOCK_COLUMNS =
  'id, training_id, sort_order, block_type, exercise_id, distance_m, reps, load_kg, duration_seconds, target_pace_seconds_per_km, rounds, notes, created_at, exercises(id, name, metric, modality)'

// Blocos de um treino (Hyrox/CrossFit). `enabled = false` (treino de corrida)
// não faz requisição nenhuma — os 48 treinos de corrida seguem sem custo extra.
// RLS: só blocos de treinos da organização do usuário.
export function useTrainingBlocks(trainingId: string | null | undefined, enabled: boolean) {
  const [blocks, setBlocks] = useState<TrainingBlockWithExercise[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!trainingId || !enabled) {
        setBlocks([])
        return
      }
      setIsLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('training_blocks')
        .select(BLOCK_COLUMNS)
        .eq('training_id', trainingId)
        .order('sort_order')
      if (cancelled) return
      setIsLoading(false)
      if (fetchError) {
        setError(fetchError.message)
        return
      }
      setBlocks((data ?? []) as TrainingBlockWithExercise[])
    }
    load()
    return () => { cancelled = true }
  }, [trainingId, enabled])

  return { blocks, isLoading, error }
}

// Exercícios disponíveis: globais (organization_id NULL) + da assessoria.
export function useExercises(enabled: boolean) {
  const [exercises, setExercises] = useState<Exercise[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!enabled) return
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, modality, metric, default_distance_m, default_reps, sort_order, organization_id, created_at')
        .order('sort_order')
        .order('name')
      if (cancelled) return
      if (error) {
        console.error('Erro ao carregar exercícios:', error.message)
        return
      }
      setExercises(data ?? [])
    }
    load()
    return () => { cancelled = true }
  }, [enabled])

  return exercises
}
