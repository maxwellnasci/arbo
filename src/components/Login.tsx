import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock } from 'lucide-react'
import arboLogo from '../assets/arbo-run-logo.webp'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setError(null)
    setInfo(null)

    if (!email) {
      setError('Digite seu email antes de recuperar a senha.')
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    })

    if (resetError) {
      setError('Erro ao enviar email de recuperação. Tente novamente.')
    } else {
      setInfo('Email de recuperação enviado. Verifique sua caixa de entrada.')
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-logo-container">
          <div className="login-logo-glow" />
          <img src={arboLogo} alt="Arbo CrossFit" width="160" height="160" className="login-logo-img" />
        </div>
        
        <div className="login-header-text">
          <h1 className="login-title">ARBO RUN</h1>
          <p className="login-subtitle">A sua evolução começa aqui.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">E-mail</label>
            <div className="login-input-wrapper">
              <Mail className="login-input-icon" size={20} />
              <input
                type="email"
                id="email"
                name="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>
          
          <div className="login-field">
            <label htmlFor="password">Senha</label>
            <div className="login-input-wrapper">
              <Lock className="login-input-icon" size={20} />
              <input
                type="password"
                id="password"
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <p className="login-error">{error}</p>}
          {info && <p className="login-info">{info}</p>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'ENTRANDO...' : 'ENTRAR'}
          </button>
        </form>

        <button
          type="button"
          className="login-forgot"
          onClick={handleForgotPassword}
        >
          Esqueci minha senha
        </button>

        <p className="login-terms">
          Acesso exclusivo por convite.{' '}
          <br />
          Entre em contato com seu professor.
        </p>
      </div>
    </main>
  )
}
