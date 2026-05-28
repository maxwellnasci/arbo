import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile } from '../lib/types'

export function useAdminAlunos() {
  const { user } = useAuth()
  const [alunos, setAlunos] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function fetchAlunos() {
      // profiles não tem coluna role — exclui o próprio admin como workaround MVP
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user!.id)
        .order('full_name', { ascending: true, nullsFirst: false })

      if (cancelled) return
      if (fetchError) setError(fetchError.message)
      else setAlunos(data ?? [])
      setIsLoading(false)
    }

    fetchAlunos()
    return () => { cancelled = true }
  }, [user])

  return { alunos, isLoading, error }
}
