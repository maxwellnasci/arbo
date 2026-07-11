import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil } from 'lucide-react'
import { PROGRAM_COLOR_VAR_MAP } from '../../lib/trainingUtils'
import { NewProgramModal } from './NewProgramModal'
import type { Training, TrainingProgram } from '../../lib/types'

interface ManageProgramsModalProps {
  isOpen: boolean
  onClose: () => void
  programs: TrainingProgram[]
  allTrainings: Training[]
  onCreateProgram: (name: string, description: string, color: string) => Promise<TrainingProgram | null>
  onUpdateProgramName: (id: string, name: string) => Promise<{ error: string | null }>
  onMoveTraining: (trainingId: string, newProgramSlug: string) => Promise<void>
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

export function ManageProgramsModal({
  isOpen,
  onClose,
  programs,
  allTrainings,
  onCreateProgram,
  onUpdateProgramName,
  onMoveTraining,
}: ManageProgramsModalProps) {
  const [showProgramForm, setShowProgramForm] = useState(false)
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null)

  const [selectedTrainingId, setSelectedTrainingId] = useState('')
  const [selectedTargetSlug, setSelectedTargetSlug] = useState('')
  const [isMoving, setIsMoving] = useState(false)

  function openCreateForm() {
    setEditingProgram(null)
    setShowProgramForm(true)
  }

  function openEditForm(program: TrainingProgram) {
    setEditingProgram(program)
    setShowProgramForm(true)
  }

  async function handleMove() {
    if (!selectedTrainingId || !selectedTargetSlug || isMoving) return
    setIsMoving(true)
    await onMoveTraining(selectedTrainingId, selectedTargetSlug)
    setIsMoving(false)
    setSelectedTrainingId('')
    setSelectedTargetSlug('')
  }

  const programsBySlug = new Map(programs.map(p => [p.slug, p]))

  return (
    <>
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
            onClick={onClose}
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
                maxWidth: '480px',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-modal)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 600 }}>
                Gerenciar Pastas
              </h3>

              {/* Lista de pastas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {programs.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Nenhuma pasta criada ainda.</p>
                ) : (
                  programs.map(program => (
                    <div
                      key={program.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'var(--bg-input)', padding: '9px 12px', borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: PROGRAM_COLOR_VAR_MAP[program.color]?.accent ?? 'var(--text-secondary)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{program.name}</span>
                      </div>
                      <button
                        onClick={() => openEditForm(program)}
                        title="Renomear pasta"
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={openCreateForm}
                style={{
                  width: '100%', background: 'var(--orange-subtle)', border: '1px solid var(--orange-border)',
                  borderRadius: '8px', padding: '9px', textAlign: 'center', fontSize: '13px', fontWeight: 600,
                  color: 'var(--orange)', cursor: 'pointer', marginBottom: '20px',
                }}
              >
                + Nova pasta
              </button>

              <div style={{ height: '1px', background: 'var(--border-default)', marginBottom: '20px' }} />

              {/* Mover treino */}
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Mover Treino
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Treino</label>
                  <select
                    value={selectedTrainingId}
                    onChange={e => setSelectedTrainingId(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Selecione um treino…</option>
                    {allTrainings.map(t => {
                      const currentProgram = t.program ? programsBySlug.get(t.program) : null
                      return (
                        <option key={t.id} value={t.id}>
                          {t.title}{currentProgram ? ` · ${currentProgram.name}` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Mover para</label>
                  <select
                    value={selectedTargetSlug}
                    onChange={e => setSelectedTargetSlug(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Selecione a pasta destino…</option>
                    {programs.map(p => <option key={p.id} value={p.slug}>{p.name}</option>)}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleMove}
                  disabled={!selectedTrainingId || !selectedTargetSlug || isMoving}
                  style={{
                    background: !selectedTrainingId || !selectedTargetSlug || isMoving ? 'var(--bg-input)' : 'var(--orange)',
                    color: !selectedTrainingId || !selectedTargetSlug || isMoving ? 'var(--text-secondary)' : 'var(--text-on-brand)',
                    border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 600,
                    cursor: !selectedTrainingId || !selectedTargetSlug || isMoving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isMoving ? 'Movendo…' : 'Mover treino'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-primary)',
                    padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <NewProgramModal
        isOpen={showProgramForm}
        programToEdit={editingProgram}
        onClose={() => setShowProgramForm(false)}
        onCreate={onCreateProgram}
        onUpdate={onUpdateProgramName}
      />
    </>
  )
}
