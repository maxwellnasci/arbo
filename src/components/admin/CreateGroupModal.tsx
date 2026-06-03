import React, { useState } from 'react'
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
  const [startsAt, setStartsAt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
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
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#1c1c1e',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '500px',
        border: '1px solid #333',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <h2 style={{ margin: '0 0 24px', fontSize: '20px', color: '#fff' }}>Nova Turma</h2>
        
        {error && (
          <div style={{ padding: '12px', background: 'rgba(255, 107, 107, 0.1)', color: '#ff6b6b', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Nome da Turma</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Turma Janeiro 2026"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#2a2a2c',
                color: '#fff',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Objetivo</label>
              <select 
                value={goal}
                onChange={e => setGoal(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#2a2a2c',
                  color: '#fff',
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

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Frequência</label>
              <select 
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#2a2a2c',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="2x">2x por semana</option>
                <option value="3x">3x por semana</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Tipo de Plano</label>
              <select 
                value={planType}
                onChange={e => setPlanType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#2a2a2c',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="grupo">Grupo</option>
                <option value="individual">Individual</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Início (Opcional)</label>
              <input 
                type="date"
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#2a2a2c',
                  color: '#fff',
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
                color: '#aaa',
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
                background: '#E8521A',
                color: '#fff',
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
