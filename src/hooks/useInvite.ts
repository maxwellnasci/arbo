import { supabase } from '../lib/supabase'

export function useInvite() {
  const invite = async (email: string, role: 'aluno' | 'admin' = 'aluno') => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) throw new Error('Sessão inválida. Faça login novamente.')

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, role }),
      }
    )

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || 'Erro ao enviar convite.')
    }
  }

  return { invite }
}
