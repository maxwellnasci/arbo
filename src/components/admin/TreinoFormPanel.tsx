import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Tag, TrainingType } from '../../lib/types'
import type { TrainingWithTag } from '../../hooks/useAdminTreinos'
import type { Database } from '../../lib/database.types'

type TrainingInsert = Database['public']['Tables']['trainings']['Insert']

interface TreinoFormPanelProps {
  isOpen: boolean
  onClose: () => void
  treinoToEdit?: TrainingWithTag | null
  onSubmit: (data: Omit<TrainingInsert, 'created_by'>) => void
  tags: Tag[]
}

const typeOptions: TrainingType[] = ['corrida', 'hiit', 'recovery', 'forca', 'mobilidade']

const typeLabel: Record<TrainingType, string> = {
  corrida: 'Corrida',
  hiit: 'HIIT',
  recovery: 'Recuperação',
  forca: 'Força',
  mobilidade: 'Mobilidade',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: '8px',
  padding: '10px 14px',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#888',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  marginBottom: '6px',
}

export function TreinoFormPanel({ isOpen, onClose, treinoToEdit, onSubmit, tags }: TreinoFormPanelProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [distanceM, setDistanceM] = useState<number | ''>('')
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('')
  const [paceMinutes, setPaceMinutes] = useState<number | ''>('')
  const [paceSeconds, setPaceSeconds] = useState<number | ''>('')
  const [sets, setSets] = useState<number | ''>('')
  const [type, setType] = useState<TrainingType>('corrida')
  const [tagId, setTagId] = useState('')

  function resetForm() {
    setTitle('')
    setDescription('')
    setDistanceM('')
    setDurationMinutes('')
    setPaceMinutes('')
    setPaceSeconds('')
    setSets('')
    setType('corrida')
    setTagId('')
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (cancelled) return
      if (treinoToEdit) {
        setTitle(treinoToEdit.title)
        setDescription(treinoToEdit.description || '')
        setDistanceM(treinoToEdit.distance_m || '')
        setDurationMinutes(treinoToEdit.duration_minutes || '')
        if (treinoToEdit.target_pace_seconds_per_km) {
          const total = treinoToEdit.target_pace_seconds_per_km
          setPaceMinutes(Math.floor(total / 60))
          setPaceSeconds(total % 60)
        } else {
          setPaceMinutes('')
          setPaceSeconds('')
        }
        setSets(treinoToEdit.sets || '')
        setType(treinoToEdit.type as TrainingType)
        setTagId(treinoToEdit.tag?.id || '')
      } else {
        resetForm()
      }
    }
    load()
    return () => { cancelled = true }
  }, [treinoToEdit, isOpen])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const paceMin = Number(paceMinutes) || 0
    const paceSec = Number(paceSeconds) || 0
    const totalPaceSeconds = paceMin * 60 + paceSec

    const data: Omit<TrainingInsert, 'created_by'> = {
      title,
      description: description || null,
      distance_m: distanceM ? Number(distanceM) : null,
      duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      target_pace_seconds_per_km: totalPaceSeconds > 0 ? totalPaceSeconds : null,
      sets: sets ? Number(sets) : null,
      type,
      tag_id: tagId || null,
    }

    onSubmit(data)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            style={{
              height: '100%',
              width: '100%',
              maxWidth: '480px',
              background: '#1c1c1e',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid #2a2a2a',
              }}
            >
              <h2
                style={{
                  color: '#fff',
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: 0,
                  fontFamily: 'Bebas Neue, sans-serif',
                  letterSpacing: '1px',
                }}
              >
                {treinoToEdit ? 'EDITAR TREINO' : 'NOVO TREINO'}
              </h2>
              <button
                onClick={onClose}
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#555',
                  cursor: 'pointer',
                  fontSize: '20px',
                  lineHeight: 1,
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '80px' }}>
              {/* Título */}
              <div>
                <label style={labelStyle}>Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  placeholder="Ex: Tiro 5×1000m"
                  style={inputStyle}
                />
              </div>

              {/* Descrição */}
              <div>
                <label style={labelStyle}>Descrição (opcional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Descreva o treino..."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Tipo + Etiqueta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as TrainingType)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {typeOptions.map(opt => (
                      <option key={opt} value={opt}>{typeLabel[opt]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Etiqueta</label>
                  <select
                    value={tagId}
                    onChange={e => setTagId(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Nenhuma</option>
                    {tags.map(tag => (
                      <option key={tag.id} value={tag.id}>{tag.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Distância + Duração */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Distância (m)</label>
                  <input
                    type="number"
                    min="0"
                    value={distanceM}
                    onChange={e => setDistanceM(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Ex: 5000"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Duração (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Ex: 30"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Pace */}
              <div>
                <label style={labelStyle}>Pace alvo (min : seg / km)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={paceMinutes}
                    onChange={e => setPaceMinutes(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Min"
                    style={inputStyle}
                  />
                  <span style={{ color: '#555', fontSize: '18px', fontWeight: 600 }}>:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={paceSeconds}
                    onChange={e => setPaceSeconds(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Seg"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Séries */}
              <div>
                <label style={labelStyle}>Séries</label>
                <input
                  type="number"
                  min="1"
                  value={sets}
                  onChange={e => setSets(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ex: 1"
                  style={inputStyle}
                />
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    color: '#aaa',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#E8521A',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 24px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {treinoToEdit ? 'Salvar Alterações' : 'Criar Treino'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
