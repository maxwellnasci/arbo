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

    supabase
      .from('anamnesis')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setHasAnamnesis(!!data)
        setAnamnesisChecked(true)
      })
  }, [user, isAdmin])

  if (!user) return null

  // Admin não precisa verificar anamnese
  if (isAdmin) return <Navigate to="/admin" replace />

  if (!anamnesisChecked) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#111111',
        color: '#E8521A',
        fontFamily: 'sans-serif',
        fontSize: '1rem',
      }}>
        Carregando...
      </div>
    )
  }

  return <Navigate to={hasAnamnesis ? '/aluno' : '/onboarding'} replace />
}
