import { useState, useEffect } from 'react'
import { useInvite } from '../../hooks/useInvite'
import { supabase } from '../../lib/supabase'

type Invite = {
  id: string
  email: string
  role: string
  status: string
  created_at: string
}

export default function AdminConvites() {
  const { invite } = useInvite()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'aluno' | 'admin'>('aluno')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [invites, setInvites] = useState<Invite[]>([])

  const fetchInvites = async () => {
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setInvites(data)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data && !cancelled) setInvites(data)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    try {
      await invite(email, role)
      setStatus('success')
      setEmail('')
      setRole('aluno')
      fetchInvites()
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
      <div style={{ background: '#1c1c1e', padding: '24px', borderRadius: '12px', maxWidth: '500px', marginBottom: '32px' }}>
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
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setStatus('idle') }}
              placeholder={role === 'admin' ? 'Email do professor' : 'Email do aluno'}
              required
              style={{ flex: '1 1 200px', padding: '12px', borderRadius: '8px', background: '#2a2a2a', border: '1px solid #333', color: '#fff' }}
            />
            <button type="submit" disabled={status === 'loading'} style={{ flex: '1 1 auto', background: '#E8521A', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
              {status === 'loading' ? 'Enviando...' : 'Convidar'}
            </button>
          </div>
        </form>
        {status === 'success' && <p style={{ color: '#4caf50', marginTop: '12px' }}>Convite enviado com sucesso!</p>}
        {status === 'error' && <p style={{ color: '#ff6b6b', marginTop: '12px' }}>{errorMsg}</p>}
      </div>

      <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#ddd' }}>Convites Enviados</h2>
      <div style={{ background: '#1c1c1e', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#2a2a2a' }}>
              <th style={{ padding: '12px 16px', color: '#999', fontWeight: 500, fontSize: '13px' }}>Email</th>
              <th style={{ padding: '12px 16px', color: '#999', fontWeight: 500, fontSize: '13px' }}>Role</th>
              <th style={{ padding: '12px 16px', color: '#999', fontWeight: 500, fontSize: '13px' }}>Status</th>
              <th style={{ padding: '12px 16px', color: '#999', fontWeight: 500, fontSize: '13px' }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
                  Nenhum convite enviado ainda.
                </td>
              </tr>
            ) : (
              invites.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: '12px 16px', color: '#ddd' }}>{inv.email}</td>
                  <td style={{ padding: '12px 16px', color: '#ddd', textTransform: 'capitalize' }}>{inv.role}</td>
                  <td style={{ padding: '12px 16px', color: '#ddd' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      background: inv.status === 'sent' ? '#2e7d32' : '#555',
                      color: '#fff',
                      whiteSpace: 'nowrap'
                    }}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#888', fontSize: '13px', whiteSpace: 'nowrap' }}>
                    {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
