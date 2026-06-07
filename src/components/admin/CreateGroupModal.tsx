import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

interface CreateGroupModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function CreateGroupModal({ onClose, onSuccess }: CreateGroupModalProps) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('10k')
  const [frequency, setFrequency] = useState('3x')
  const [planType, setPlanType] = useState('grupo')
  const [mode, setMode] = useState('fixo')
  const [startsAt, setStartsAt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Preencha o nome da turma.')
      return
    }
    
    setIsSubmitting(true)
    setError('')

    const { error: insertError } = await supabase.from('groups').insert({
      name,
      goal,
      frequency,
      plan_type: planType,
      mode,
      starts_at: startsAt || null,
      is_active: true
    })

    if (insertError) {
      setError(insertError.message)
      setIsSubmitting(false)
    } else {
      setIsSubmitting(false)
      onSuccess()
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'var(--backdrop-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '500px',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-card)'
      }}>
        <h2 style={{ margin: '0 0 24px', fontSize: '20px', color: 'var(--text-primary)' }}>Nova Turma</h2>
        
        {error && (
          <div style={{ padding: '12px', background: 'var(--red-subtle)', color: 'var(--red-accent)', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Nome da Turma</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Turma Janeiro 2026"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Objetivo</label>
              <select 
                value={goal}
                onChange={e => setGoal(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="5k">5K</option>
                <option value="10k">10K</option>
                <option value="21k">21K</option>
                <option value="evoluir_10k">Evolução 10K</option>
                <option value="evoluir_21k">Evolução 21K</option>
              </select>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Frequência</label>
              <select 
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="2x">2x por semana</option>
                <option value="3x">3x por semana</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Tipo de Plano</label>
              <select 
                value={planType}
                onChange={e => setPlanType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="grupo">Grupo</option>
                <option value="individual">Individual</option>
              </select>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Modo</label>
              <select 
                value={mode}
                onChange={e => setMode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="fixo">Fixo (Semanal)</option>
                <option value="flexivel">Flexível (Lista)</option>
              </select>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Início (Opcional)</label>
              <input 
                type="date"
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  colorScheme: 'dark'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--orange)',
                color: 'var(--text-primary)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Turma'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
