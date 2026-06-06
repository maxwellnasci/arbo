import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Tag, TrainingType, TrainingCustomType } from '../../lib/types'
import type { TrainingWithTag } from '../../hooks/useAdminTreinos'
import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'sonner'

type TrainingInsert = Database['public']['Tables']['trainings']['Insert']

interface TreinoFormPanelProps {
  isOpen: boolean
  onClose: () => void
  treinoToEdit?: TrainingWithTag | null
  onSubmit: (data: Omit<TrainingInsert, 'created_by'>) => void
  tags: Tag[]
  customTypes: TrainingCustomType[]
  onTagCreated: (tag: Tag) => void
  onTypeCreated: (type: TrainingCustomType) => void
}

const TAG_COLORS = [
  { name: 'Laranja', hex: '#E8521A' },
  { name: 'Azul', hex: '#3B82F6' },
  { name: 'Verde', hex: '#22C55E' },
  { name: 'Vermelho', hex: '#EF4444' },
  { name: 'Amarelo', hex: '#EAB308' },
  { name: 'Roxo', hex: '#A855F7' },
  { name: 'Ciano', hex: '#06B6D4' },
  { name: 'Cinza', hex: '#71717A' },
]

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

export function TreinoFormPanel({ isOpen, onClose, treinoToEdit, onSubmit, tags, customTypes, onTagCreated, onTypeCreated }: TreinoFormPanelProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [distanceM, setDistanceM] = useState<number | ''>('')
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('')
  const [paceMinutes, setPaceMinutes] = useState<number | ''>('')
  const [paceSeconds, setPaceSeconds] = useState<number | ''>('')
  const [sets, setSets] = useState<number | ''>('')
  const [type, setType] = useState<string>('corrida')
  const [tagId, setTagId] = useState('')

  // Inline Creation State
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#E8521A')
  const [creatingTag, setCreatingTag] = useState(false)

  const [showNewType, setShowNewType] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [creatingType, setCreatingType] = useState(false)

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
    setShowNewTag(false)
    setShowNewType(false)
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

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    setCreatingTag(true)
    const { data, error } = await supabase
      .from('tags')
      .insert({ name: newTagName.trim(), color: newTagColor, created_by: user?.id ?? '' })
      .select('*')
      .single()
    setCreatingTag(false)
    if (error || !data) {
      toast.error(error?.message ?? 'Erro ao criar etiqueta')
      return
    }
    onTagCreated(data as Tag)
    setTagId(data.id)
    setShowNewTag(false)
    setNewTagName('')
  }

  async function handleCreateType() {
    if (!newTypeName.trim()) return
    setCreatingType(true)
    const { data, error } = await supabase
      .from('training_types')
      .insert({ name: newTypeName.trim(), is_custom: true, created_by: user?.id ?? '' })
      .select('*')
      .single()
    setCreatingType(false)
    if (error || !data) {
      toast.error(error?.message ?? 'Erro ao criar tipo')
      return
    }
    onTypeCreated(data as TrainingCustomType)
    setType(data.name) // Types are string-based now
    setShowNewType(false)
    setNewTypeName('')
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'flex-start' }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  {showNewType ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input
                        style={inputStyle}
                        value={newTypeName}
                        onChange={e => setNewTypeName(e.target.value)}
                        placeholder="Ex: Fartlek"
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => setShowNewType(false)} style={{ ...inputStyle, textAlign: 'center', cursor: 'pointer', flex: 1, padding: '6px' }}>Cancelar</button>
                        <button type="button" onClick={handleCreateType} disabled={creatingType || !newTypeName.trim()} style={{ flex: 1, background: '#E8521A', color: '#fff', border: 'none', borderRadius: '7px', padding: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                          {creatingType ? '...' : 'Criar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={type}
                      onChange={e => {
                        if (e.target.value === 'NEW') setShowNewType(true)
                        else setType(e.target.value)
                      }}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <optgroup label="Padrão">
                        {typeOptions.map(opt => (
                          <option key={opt} value={opt}>{typeLabel[opt]}</option>
                        ))}
                      </optgroup>
                      {customTypes.length > 0 && (
                        <optgroup label="Personalizados">
                          {customTypes.map(ct => (
                            <option key={ct.id} value={ct.name}>{ct.name}</option>
                          ))}
                        </optgroup>
                      )}
                      <option value="NEW">+ Criar novo tipo</option>
                    </select>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Etiqueta</label>
                  {showNewTag ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input
                        style={inputStyle}
                        value={newTagName}
                        onChange={e => setNewTagName(e.target.value)}
                        placeholder="Ex: Fase de Base"
                      />
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {TAG_COLORS.map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setNewTagColor(c.hex)}
                            style={{
                              width: 20, height: 20, borderRadius: '50%', border: newTagColor === c.hex ? '2px solid #fff' : '2px solid transparent',
                              background: c.hex, cursor: 'pointer', padding: 0,
                            }}
                            title={c.name}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => setShowNewTag(false)} style={{ ...inputStyle, textAlign: 'center', cursor: 'pointer', flex: 1, padding: '6px' }}>Cancelar</button>
                        <button type="button" onClick={handleCreateTag} disabled={creatingTag || !newTagName.trim()} style={{ flex: 1, background: '#E8521A', color: '#fff', border: 'none', borderRadius: '7px', padding: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                          {creatingTag ? '...' : 'Criar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={tagId}
                      onChange={e => {
                        if (e.target.value === 'NEW') setShowNewTag(true)
                        else setTagId(e.target.value)
                      }}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="">Nenhuma</option>
                      {tags.map(tag => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                      <option value="NEW">+ Criar nova etiqueta</option>
                    </select>
                  )}
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
