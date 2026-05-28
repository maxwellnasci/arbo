import { useState } from 'react'
import { useInvite } from '../../hooks/useInvite'

export default function AdminConvites() {
  const { invite } = useInvite()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      await invite(email)
      setStatus('success')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Convites</h1>
      <div style={{ background: '#1c1c1e', padding: '24px', borderRadius: '12px', maxWidth: '500px' }}>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setStatus('idle') }}
            placeholder="Email do aluno"
            required
            style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#2a2a2a', border: '1px solid #333', color: '#fff' }}
          />
          <button type="submit" disabled={status === 'loading'} style={{ background: '#E8521A', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer' }}>
            {status === 'loading' ? 'Enviando...' : 'Convidar'}
          </button>
        </form>
        {status === 'success' && <p style={{ color: '#4caf50', marginTop: '12px' }}>Convite enviado!</p>}
        {status === 'error' && <p style={{ color: '#ff6b6b', marginTop: '12px' }}>Erro ao enviar convite.</p>}
      </div>
    </div>
  )
}
