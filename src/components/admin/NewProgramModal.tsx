import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PROGRAM_COLOR_OPTIONS, PROGRAM_COLOR_LABELS, PROGRAM_COLOR_VAR_MAP } from '../../lib/trainingUtils'
import type { TrainingProgram } from '../../lib/types'

interface NewProgramModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, description: string, color: string) => Promise<TrainingProgram | null>
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-secondary)',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  marginBottom: '6px',
}

export function NewProgramModal({ isOpen, onClose, onCreate }: NewProgramModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>('orange')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setName('')
    setDescription('')
    setColor('orange')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || isSaving) return
    setIsSaving(true)
    setError(null)
    const created = await onCreate(name.trim(), description.trim(), color)
    setIsSaving(false)
    if (!created) {
      setError('Erro ao criar biblioteca. Tente novamente.')
      return
    }
    handleClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'var(--backdrop-bg)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: 'var(--shadow-modal)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 600 }}>
              Nova Biblioteca
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                  placeholder="Ex: Meia Maratona"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Descrição (opcional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Descreva a biblioteca..."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Cor</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {PROGRAM_COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      title={PROGRAM_COLOR_LABELS[c]}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        border: color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                        background: PROGRAM_COLOR_VAR_MAP[c].accent,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>

              {error && <p style={{ color: 'var(--red-accent)', fontSize: '13px', margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !name.trim()}
                  style={{
                    background: 'var(--orange)',
                    border: 'none',
                    color: 'var(--text-on-brand)',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
