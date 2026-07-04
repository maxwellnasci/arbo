import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import styles from './StravaCallback.module.css'

export default function StravaCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function process() {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const stravaError = searchParams.get('error')

      const savedState = sessionStorage.getItem('arbo_strava_state')
      sessionStorage.removeItem('arbo_strava_state')

      if (stravaError) {
        if (!cancelled) setError('Conexão com o Strava cancelada.')
        return
      }

      if (!code) {
        if (!cancelled) setError('Código de autorização ausente. Tente novamente.')
        return
      }

      if (!state || state !== savedState) {
        if (!cancelled) setError('Falha de validação de segurança. Tente conectar novamente.')
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Sessão expirada. Faça login novamente.')

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-callback`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ code }),
          },
        )

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || 'Erro ao conectar com o Strava.')
        }

        if (!cancelled) navigate('/aluno?strava=success', { replace: true })
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao conectar com o Strava.')
      }
    }

    process()
    return () => { cancelled = true }
  }, [searchParams, navigate])

  if (error) {
    return (
      <main className={styles.container}>
        <p className={styles.errorText}>{error}</p>
        <button className={styles.backBtn} onClick={() => navigate('/aluno')}>Voltar ao app</button>
      </main>
    )
  }

  return (
    <main className={styles.container}>
      <div className={styles.spinner} />
      <p className={styles.text}>Conectando ao Strava...</p>
    </main>
  )
}
