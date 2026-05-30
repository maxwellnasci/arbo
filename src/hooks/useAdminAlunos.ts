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
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'aluno')
        .order('full_name', { ascending: true, nullsFirst: false })

      if (cancelled) return
      if (fetchError) setError(fetchError.message)
      else setAlunos(data ?? [])
      setIsLoading(false)
    }

    fetchAlunos()
    return () => { cancelled = true }
  }, [])

  return { alunos, isLoading, error }
}
