import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Role = 'admin' | 'aluno' | null

type AuthContextValue = {
  session: Session | null
  user: User | null
  role: Role
  isAdmin: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, newSession) => setSession(newSession)
    )

    return () => subscription.unsubscribe()
  }, [])

  // Sessão anterior à migration multi-tenant (2026-10-07): o JWT não tem
  // app_metadata.org_id e as policies por organização não liberam nada
  // (falha fechada). Renova o token uma vez — o app_metadata atual do servidor
  // já tem org_id, e o onAuthStateChange acima entrega a sessão nova.
  const refreshedForOrgRef = useRef(false)
  useEffect(() => {
    async function refreshIfMissingOrg() {
      if (!session || refreshedForOrgRef.current) return
      if (typeof session.user.app_metadata?.org_id === 'string') return
      refreshedForOrgRef.current = true
      const { error } = await supabase.auth.refreshSession()
      if (error) console.error('Erro ao renovar sessão sem org_id:', error.message)
    }
    refreshIfMissingOrg()
  }, [session])

  const user = session?.user ?? null
  // Role sempre de app_metadata — nunca de user_metadata (editável pelo usuário)
  const rawRole = user?.app_metadata?.role
  const role: Role = rawRole === 'admin' ? 'admin' : user ? 'aluno' : null
  const isAdmin = role === 'admin'

  return (
    <AuthContext.Provider value={{ session, user, role, isAdmin, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
