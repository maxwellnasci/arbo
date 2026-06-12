import { useState, useEffect } from 'react'
import { useInvite } from '../../hooks/useInvite'
import { supabase } from '../../lib/supabase'
import { motion } from 'framer-motion'
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react'

type Invite = {
  id: string
  email: string
  role: string
  status: string
  created_at: string
}

const listContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const listItem = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 }
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
      .select('id, email, role, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (!error && data) {
      setInvites(data)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('invites')
        .select('id, email, role, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
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
    padding: '12px 16px',
    border: active ? '1px solid var(--border-default)' : '1px solid transparent',
    borderRadius: '10px',
    cursor: 'pointer' as const,
    fontWeight: 700,
    fontSize: '14px',
    transition: 'all 0.2s ease',
    background: active ? 'var(--bg-surface-hover)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
  })

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--heading)', marginBottom: '32px', margin: '0 0 32px' }}>Convites</h1>
      
      <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', maxWidth: '600px', marginBottom: '40px', border: '1px solid var(--border-default)' }}>
        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 600 }}>
              Tipo de convite
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-input)', borderRadius: '12px', padding: '6px', border: '1px solid var(--border-subtle)' }}>
              <button type="button" onClick={() => setRole('aluno')} style={toggleStyle(role === 'aluno')}>
                🏃 Aluno
              </button>
              <button type="button" onClick={() => setRole('admin')} style={toggleStyle(role === 'admin')}>
                🛡️ Professor
              </button>
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 600 }}>
              Email do destinatário
            </label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 250px' }}>
                <Mail size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setStatus('idle') }}
                  placeholder={role === 'admin' ? 'professor@email.com' : 'aluno@email.com'}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '14px 16px 14px 44px',
                    borderRadius: '12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--orange)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{
                  flex: '0 1 auto',
                  background: 'var(--orange)',
                  color: 'var(--text-on-brand)',
                  border: 'none',
                  padding: '14px 28px',
                  borderRadius: '12px',
                  cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'opacity 0.2s',
                  opacity: status === 'loading' ? 0.7 : 1
                }}
              >
                {status === 'loading' ? 'Enviando...' : <><Send size={16} /> Convidar</>}
              </button>
            </div>
          </div>
        </form>
        
        {status === 'success' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', padding: '12px 16px', borderRadius: '10px', marginTop: '16px' }}>
            <CheckCircle2 size={16} color="var(--green-accent)" />
            <p style={{ color: 'var(--green-accent)', margin: 0, fontSize: '13px', fontWeight: 600 }}>Convite enviado com sucesso!</p>
          </div>
        )}
        {status === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--red-subtle)', border: '1px solid var(--red-border)', padding: '12px 16px', borderRadius: '10px', marginTop: '16px' }}>
            <AlertCircle size={16} color="var(--red-accent)" />
            <p style={{ color: 'var(--red-accent)', margin: 0, fontSize: '13px', fontWeight: 600 }}>{errorMsg}</p>
          </div>
        )}
      </div>

      <h2 style={{ fontFamily: 'var(--heading)', fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Convites Enviados</h2>
      
      {invites.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', padding: '40px', borderRadius: '16px', textAlign: 'center', border: '1px solid var(--border-default)' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Nenhum convite enviado ainda.</p>
        </div>
      ) : (
        <motion.div variants={listContainer} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {invites.map((inv) => (
            <motion.div
              key={inv.id}
              variants={listItem}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: '16px',
                padding: '16px 20px',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-surface-hover)';
                e.currentTarget.style.transform = 'scale(0.995)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-surface)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 700, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.email}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {inv.role}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
              
              <div style={{ flexShrink: 0 }}>
                <span style={{ 
                  padding: '6px 12px', 
                  borderRadius: '20px', 
                  fontSize: '11px', 
                  fontWeight: 700,
                  background: inv.status === 'sent' ? 'rgba(74, 222, 128, 0.1)' : 'var(--bg-input)',
                  color: inv.status === 'sent' ? 'var(--green-accent)' : 'var(--text-secondary)',
                  border: inv.status === 'sent' ? '1px solid rgba(74, 222, 128, 0.2)' : '1px solid var(--border-subtle)',
                  whiteSpace: 'nowrap',
                  display: 'inline-block'
                }}>
                  {inv.status === 'sent' ? 'Enviado' : inv.status}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
