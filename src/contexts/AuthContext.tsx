import { createContext, useContext, useEffect, useState } from 'react'
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
