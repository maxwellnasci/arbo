import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
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
    })

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

    navigate('/dashboard')
  }

  if (!ready) {
    return (
      <div style={styles.page}>
        <p style={styles.validating}>Validando convite...</p>
      </div>
    )
  }

  return (
    <div style={styles.page}>
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
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    backgroundColor: '#111111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  validating: {
    color: '#E8521A',
    fontFamily: 'sans-serif',
    fontSize: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: '390px',
    backgroundColor: '#1c1c1e',
    borderRadius: '24px',
    padding: '36px 28px 28px',
    boxSizing: 'border-box',
  },
  title: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: 800,
    margin: '0 0 8px',
    fontFamily: 'sans-serif',
  },
  subtitle: {
    color: '#888',
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
    color: '#d0d0d0',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'sans-serif',
  },
  input: {
    backgroundColor: '#2a2a2a',
    border: '1.5px solid #3a3a3a',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    padding: '14px 16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'sans-serif',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '13px',
    margin: 0,
    fontFamily: 'sans-serif',
  },
  button: {
    backgroundColor: '#E8521A',
    color: '#ffffff',
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
