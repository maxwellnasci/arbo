import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Sentry } from '../lib/sentry'

// Hook que remove um vídeo do bucket R2 via Edge Function r2-delete.
// - Reusa o padrão de fetch direto do hook useStravaConnection (chamada
//   autenticada, sem nunca usar supabase.from direto porque a tabela é
//   service_role-only).
// - Idempotente no servidor: a function trata 404 (objeto já inexistente)
//   como 200, então chamar duas vezes não dá erro.
// - No cliente: se a function falhar, NÃO limpa o state local — o chamador
//   decide o que fazer com o retorno (geralmente manter o vídeo visível na
//   UI até o usuário tentar de novo).
export function useR2Delete() {
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteVideo = useCallback(async (publicUrl: string): Promise<boolean> => {
    setIsDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ publicUrl }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Erro ao remover vídeo.')
      }

      return true
    } catch (e: unknown) {
      console.error('Erro ao remover vídeo do R2:', e)
      Sentry.captureException(e, { contexts: { r2Delete: { publicUrl } } })
      return false
    } finally {
      setIsDeleting(false)
    }
  }, [])

  return { deleteVideo, isDeleting }
}