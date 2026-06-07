import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function DashboardRedirect() {
  const { user, isAdmin } = useAuth()
  const [anamnesisChecked, setAnamnesisChecked] = useState(false)
  const [hasAnamnesis, setHasAnamnesis] = useState(false)

  useEffect(() => {
    if (!user || isAdmin) return

    let cancelled = false

    async function load() {
      try {
        const { data } = await supabase
          .from('anamnesis')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle()
        if (cancelled) return
        setHasAnamnesis(!!data)
      } catch {
        // query falhou — tratar como sem anamnese
      } finally {
        if (!cancelled) setAnamnesisChecked(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, isAdmin])

  if (!user) return null

  // Admin não precisa verificar anamnese
  if (isAdmin) return <Navigate to="/admin" replace />

  if (!anamnesisChecked) {
    return (
      <main style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--orange)',
        fontFamily: 'sans-serif',
        fontSize: '1rem',
      }}>
        Carregando...
      </main>
    )
  }

  return <Navigate to={hasAnamnesis ? '/aluno' : '/onboarding'} replace />
}
