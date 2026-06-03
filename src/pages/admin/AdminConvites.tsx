import { useState } from 'react'
import { useInvite } from '../../hooks/useInvite'

export default function AdminConvites() {
  const { invite } = useInvite()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'aluno' | 'admin'>('aluno')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    try {
      await invite(email, role)
      setStatus('success')
      setEmail('')
      setRole('aluno')
    } catch (err: unknown) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar convite.')
    }
  }

  const toggleStyle = (active: boolean) => ({
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer' as const,
    fontWeight: 600,
    fontSize: '14px',
    transition: 'all 0.2s ease',
    background: active ? '#E8521A' : '#2a2a2a',
    color: active ? '#fff' : '#888',
  })

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Convites</h1>
      <div style={{ background: '#1c1c1e', padding: '24px', borderRadius: '12px', maxWidth: '500px' }}>
        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
              Tipo de convite
            </label>
            <div style={{ display: 'flex', gap: '8px', background: '#111', borderRadius: '10px', padding: '4px' }}>
              <button type="button" onClick={() => setRole('aluno')} style={toggleStyle(role === 'aluno')}>
                🏃 Aluno
              </button>
              <button type="button" onClick={() => setRole('admin')} style={toggleStyle(role === 'admin')}>
                🛡️ Professor
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setStatus('idle') }}
              placeholder={role === 'admin' ? 'Email do professor' : 'Email do aluno'}
              required
              style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#2a2a2a', border: '1px solid #333', color: '#fff' }}
            />
            <button type="submit" disabled={status === 'loading'} style={{ background: '#E8521A', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
              {status === 'loading' ? 'Enviando...' : 'Convidar'}
            </button>
          </div>
        </form>
        {status === 'success' && <p style={{ color: '#4caf50', marginTop: '12px' }}>Convite enviado com sucesso!</p>}
        {status === 'error' && <p style={{ color: '#ff6b6b', marginTop: '12px' }}>{errorMsg}</p>}
      </div>
    </div>
  )
}
