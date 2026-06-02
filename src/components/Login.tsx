import { useState } from 'react'
import { supabase } from '../lib/supabase'
import arboLogo from '../assets/arbo-logo.png'
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
    // Se sucesso, o AuthContext detecta a nova sessão e LoginPage redireciona
  }

  const handleForgotPassword = async () => {
    setError(null)
    setInfo(null)

    if (!email) {
      setError('Digite seu email antes de recuperar a senha.')
      return
    }

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    })

    setInfo('Email de recuperação enviado. Verifique sua caixa de entrada.')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src={arboLogo} alt="Arbo CrossFit" className="login-logo-img" />
          <h1 className="login-title">ARBO</h1>
          <span className="login-badge">CROSSFIT RUNNING</span>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
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
          <div className="login-field">
            <label htmlFor="password">Senha</label>
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

          {error && <p className="login-error">{error}</p>}
          {info && <p className="login-info">{info}</p>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
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
    </div>
  )
}
