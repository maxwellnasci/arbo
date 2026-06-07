import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase troca o token do hash por sessão automaticamente (detectSessionInUrl padrão)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })

    // Verifica se já há sessão ativa (ex: usuário recarregou a página)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    }).catch(() => { /* link pode estar expirado — aguarda evento do onAuthStateChange */ })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Marca que o aluno já definiu sua senha
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ has_set_password: true })
        .eq('id', user.id)
    }

    setIsSuccess(true)
    setLoading(false)
  }

  if (!ready) {
    return (
      <main style={styles.page}>
        <p style={styles.validating}>Validando convite...</p>
      </main>
    )
  }

  if (isSuccess) {
    return (
      <main style={styles.page}>
        <div style={{ ...styles.card, textAlign: 'center', padding: '48px 28px' }}>
          <div style={{ background: 'var(--orange-subtle)', color: 'var(--orange)', width: '64px', height: '64px', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style={{ ...styles.title, fontSize: '28px', marginBottom: '12px' }}>Acesso Liberado!</h2>
          <p style={{ ...styles.subtitle, fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '32px' }}>
            Sua senha foi configurada com sucesso. Seja muito bem-vindo(a) ao Arbo.
          </p>
          
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '16px', marginBottom: '32px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Link oficial do App</p>
            <p style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>arbo.mxos.com.br</p>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>Salve este link para seus próximos acessos</p>
          </div>

          <button 
            onClick={() => navigate('/dashboard')}
            style={styles.button}
          >
            Acessar meu Painel
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Defina sua senha</h2>
        <p style={styles.subtitle}>Escolha uma senha para acessar o Arbo.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Nova senha</label>
            <input
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
              style={styles.input}
              autoComplete="new-password"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Confirmar senha</label>
            <input
              type="password"
              placeholder="Repita a senha"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              minLength={8}
              required
              style={styles.input}
              autoComplete="new-password"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Salvando...' : 'Confirmar senha'}
          </button>
        </form>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  validating: {
    color: 'var(--orange)',
    fontFamily: 'sans-serif',
    fontSize: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: '390px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: '24px',
    padding: '36px 28px 28px',
    boxSizing: 'border-box',
  },
  title: {
    color: 'var(--text-primary)',
    fontSize: '24px',
    fontWeight: 800,
    margin: '0 0 8px',
    fontFamily: 'sans-serif',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    margin: '0 0 28px',
    fontFamily: 'sans-serif',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  label: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'sans-serif',
  },
  input: {
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '16px',
    padding: '14px 16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'sans-serif',
  },
  error: {
    color: 'var(--red-accent)',
    fontSize: '13px',
    margin: 0,
    fontFamily: 'sans-serif',
  },
  button: {
    backgroundColor: 'var(--orange)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 700,
    padding: '16px',
    cursor: 'pointer',
    width: '100%',
    marginTop: '4px',
    fontFamily: 'sans-serif',
  },
}
