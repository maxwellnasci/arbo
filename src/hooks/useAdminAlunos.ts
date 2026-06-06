import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

export function useAdminAlunos() {
  const [alunos, setAlunos] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAlunos() {
      // Decisão MVP: Limitar a 200 resultados para performance. Paginação deve ser implementada no futuro.
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, level, role, group_id, updated_at')
        .eq('role', 'aluno')
        .order('full_name', { ascending: true, nullsFirst: false })
        .limit(200)

      if (cancelled) return
      if (fetchError) setError(fetchError.message)
      else setAlunos((data as unknown as Profile[]) ?? [])
      setIsLoading(false)
    }

    fetchAlunos()
    return () => { cancelled = true }
  }, [])

  return { alunos, isLoading, error }
}
