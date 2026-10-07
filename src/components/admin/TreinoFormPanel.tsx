import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, Upload, Film, Trash2 } from 'lucide-react'
import type { Tag, TrainingType, TrainingCustomType, TrainingProgram } from '../../lib/types'
import type { TrainingWithTag } from '../../hooks/useAdminTreinos'
import type { Database } from '../../lib/database.types'
import { TAG_COLORS, TRAINING_TYPE_OPTIONS, TRAINING_TYPE_LABELS } from '../../lib/trainingUtils'
import { ConfirmModal } from '../ui/ConfirmModal'
import { supabase } from '../../lib/supabase'
import { useExercises } from '../../hooks/useTrainingBlocks'
import { TrainingBlocksEditor } from './TrainingBlocksEditor'
import {
  MODALITY_OPTIONS,
  WOD_FORMAT_LABELS,
  blockDraftFromRow,
  formatSeconds,
  hasBlocksModality,
  isModality,
  parseTimeInput,
  type BlockDraft,
  type Modality,
  type WodFormat,
} from '../../lib/modalities'

type TrainingInsert = Database['public']['Tables']['trainings']['Insert']

const YOUTUBE_REGEX = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_VIDEO_BYTES = 500 * 1024 * 1024
const UPLOADED_VIDEO_HOST = 'videos.mxos.com.br'

function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    return decodeURIComponent(pathname.split('/').pop() || url)
  } catch {
    return url
  }
}

interface TreinoFormPanelProps {
  isOpen: boolean
  onClose: () => void
  treinoToEdit?: TrainingWithTag | null
  tags: Tag[]
  customTypes: TrainingCustomType[]
  programs: TrainingProgram[]
  onCreateTag: (name: string, color: string) => Promise<Tag | null>
  onCreateType: (name: string) => Promise<TrainingCustomType | null>
  onUploadVideo: (file: File, trainingId: string, onProgress: (percent: number) => void) => Promise<string | null>
  // Recebe a URL do vídeo antigo (se houver) a ser apagada do R2 — só é
  // apagada de fato depois que o treino for salvo com sucesso (ver handleSubmit).
  // blocks: estações/exercícios (Hyrox/CrossFit) — salvos pelo pai via RPC
  // save_training_blocks depois que o treino existir. Corrida: lista vazia.
  onSubmit: (data: Omit<TrainingInsert, 'created_by'>, videoUrlToDelete: string | null, blocks: BlockDraft[]) => void
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

export function TreinoFormPanel({ isOpen, onClose, treinoToEdit, onSubmit, tags, customTypes, programs, onCreateTag, onCreateType, onUploadVideo }: TreinoFormPanelProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [distanceM, setDistanceM] = useState<number | ''>('')
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('')
  const [paceMinutes, setPaceMinutes] = useState<number | ''>('')
  const [paceSeconds, setPaceSeconds] = useState<number | ''>('')
  const [sets, setSets] = useState<number | ''>('')
  const [type, setType] = useState<string>('corrida')
  const [tagId, setTagId] = useState('')
  const [programSlug, setProgramSlug] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [modality, setModality] = useState<Modality>('corrida')
  const [wodFormat, setWodFormat] = useState<WodFormat | ''>('')
  const [timeCapText, setTimeCapText] = useState('')
  const [blocks, setBlocks] = useState<BlockDraft[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const exercises = useExercises(isOpen)

  const [videoMode, setVideoMode] = useState<'youtube' | 'upload'>('youtube')
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingUploadId, setPendingUploadId] = useState<string>(() => crypto.randomUUID())
  // URL do vídeo R2 marcado para remoção — só é de fato apagada do bucket
  // depois que o treino for salvo com sucesso (handleSubmit → onSubmit).
  const [pendingDeleteUrl, setPendingDeleteUrl] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
    setProgramSlug('treinos_gerais')
    setVideoUrl('')
    setModality('corrida')
    setWodFormat('')
    setTimeCapText('')
    setBlocks([])
    setFormError(null)
    setVideoMode('youtube')
    setUploadedFileName(null)
    setUploadProgress(0)
    setUploadError(null)
    setPendingUploadId(crypto.randomUUID())
    setPendingDeleteUrl(null)
    setShowDeleteConfirm(false)
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
        setProgramSlug(treinoToEdit.program || '')
        const editModality: Modality = isModality(treinoToEdit.modality) ? treinoToEdit.modality : 'corrida'
        setModality(editModality)
        setWodFormat((treinoToEdit.wod_format as WodFormat | null) ?? '')
        setTimeCapText(formatSeconds(treinoToEdit.time_cap_seconds))
        setFormError(null)
        setBlocks([])
        if (hasBlocksModality(editModality)) {
          const { data, error } = await supabase
            .from('training_blocks')
            .select('id, training_id, sort_order, block_type, exercise_id, distance_m, reps, load_kg, duration_seconds, target_pace_seconds_per_km, rounds, notes, created_at')
            .eq('training_id', treinoToEdit.id)
            .order('sort_order')
          if (cancelled) return
          if (error) setFormError('Não foi possível carregar os blocos deste treino.')
          else setBlocks((data ?? []).map(blockDraftFromRow))
        }
        const existingUrl = treinoToEdit.video_url || ''
        setVideoUrl(existingUrl)
        setUploadError(null)
        setUploadProgress(0)
        setPendingDeleteUrl(null)
        setShowDeleteConfirm(false)
        if (existingUrl.includes(UPLOADED_VIDEO_HOST)) {
          setVideoMode('upload')
          setUploadedFileName(getFilenameFromUrl(existingUrl))
        } else {
          setVideoMode('youtube')
          setUploadedFileName(null)
        }
      } else {
        resetForm()
      }
    }
    load()
    return () => { cancelled = true }
  }, [treinoToEdit, isOpen])

  const uploadTrainingId = treinoToEdit?.id ?? pendingUploadId

  async function handleFileSelect(file: File) {
    setUploadError(null)

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setUploadError('Formato não suportado. Use MP4, WebM ou MOV.')
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setUploadError('Arquivo maior que 500MB.')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    const publicUrl = await onUploadVideo(file, uploadTrainingId, setUploadProgress)
    setIsUploading(false)

    if (!publicUrl) {
      setUploadError('Erro ao enviar o vídeo. Tente novamente.')
      return
    }

    setVideoUrl(publicUrl)
    setUploadedFileName(file.name)
  }

  function handleRemoveUploadedVideo() {
    // Se a URL atual não é do nosso bucket R2 (ex: link do YouTube), nada foi
    // enviado ao nosso armazenamento — só limpa o state, sem confirmação.
    if (!videoUrl || !videoUrl.includes(UPLOADED_VIDEO_HOST)) {
      setVideoUrl('')
      setUploadedFileName(null)
      setUploadError(null)
      setUploadProgress(0)
      return
    }
    // Exclusão do objeto no R2 é permanente e sem desfazer — sempre confirma antes.
    setShowDeleteConfirm(true)
  }

  // Só marca o vídeo para remoção (state local); a Edge Function r2-delete só é
  // chamada de fato pelo pai depois que o treino for salvo com sucesso — assim
  // clicar em "Cancelar" no formulário nunca apaga um arquivo que ainda está
  // referenciado pelo treino salvo no banco.
  function confirmRemoveVideo() {
    setShowDeleteConfirm(false)
    setPendingDeleteUrl(videoUrl)
    setVideoUrl('')
    setUploadedFileName(null)
    setUploadError(null)
    setUploadProgress(0)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const paceMin = Number(paceMinutes) || 0
    const paceSec = Number(paceSeconds) || 0
    const totalPaceSeconds = paceMin * 60 + paceSec

    if (isUploading) return // Previne submit com upload em andamento

    if (videoMode === 'youtube' && videoUrl && !YOUTUBE_REGEX.test(videoUrl)) {
      return // Previne submit se URL for inválida
    }

    const usesBlocks = hasBlocksModality(modality)
    const timeCap = parseTimeInput(timeCapText)
    if (usesBlocks && timeCapText.trim() && timeCap === null) {
      setFormError('Time cap inválido. Use o formato m:ss (ex.: 20:00).')
      return
    }
    if (usesBlocks && blocks.some(b => (b.block_type === 'station' || b.block_type === 'wod') && !b.exercise_id)) {
      setFormError('Escolha o exercício de cada estação/exercício antes de salvar.')
      return
    }
    setFormError(null)

    const data: Omit<TrainingInsert, 'created_by'> = {
      title,
      description: description || null,
      // Distância/pace/séries são da corrida; Hyrox/CrossFit usam os blocos.
      distance_m: !usesBlocks && distanceM ? Number(distanceM) : null,
      duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      target_pace_seconds_per_km: !usesBlocks && totalPaceSeconds > 0 ? totalPaceSeconds : null,
      sets: !usesBlocks && sets ? Number(sets) : null,
      type,
      tag_id: tagId || null,
      program: programSlug || null,
      video_url: videoUrl ? videoUrl : null,
      modality,
      wod_format: modality === 'crossfit' && wodFormat ? wodFormat : null,
      time_cap_seconds: usesBlocks && timeCap && timeCap > 0 ? timeCap : null,
    }

    onSubmit(data, pendingDeleteUrl, usesBlocks ? blocks : [])
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    setCreatingTag(true)
    const tag = await onCreateTag(newTagName.trim(), newTagColor)
    setCreatingTag(false)
    if (!tag) return
    setTagId(tag.id)
    setShowNewTag(false)
    setNewTagName('')
  }

  async function handleCreateType() {
    if (!newTypeName.trim()) return
    setCreatingType(true)
    const customType = await onCreateType(newTypeName.trim())
    setCreatingType(false)
    if (!customType) return
    setType(customType.name)
    setShowNewType(false)
    setNewTypeName('')
  }

  return (
    <>
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
              background: 'var(--bg-surface)',
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
                borderBottom: '1px solid var(--border-default)',
              }}
            >
              <h2
                style={{
                  color: 'var(--text-primary)',
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
                  color: 'var(--text-tertiary)',
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

              {/* Modalidade */}
              <div>
                <label style={labelStyle}>Modalidade</label>
                <div style={{ display: 'flex', gap: '8px' }} role="radiogroup" aria-label="Modalidade do treino">
                  {MODALITY_OPTIONS.map(opt => {
                    const active = modality === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setModality(opt.value)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: active ? '1px solid var(--orange)' : '1px solid var(--border-subtle)',
                          background: active ? 'var(--orange-subtle)' : 'var(--bg-input)',
                          color: active ? 'var(--orange)' : 'var(--text-secondary)',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
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
                        <button type="button" onClick={handleCreateType} disabled={creatingType || !newTypeName.trim()} style={{ flex: 1, background: 'var(--orange)', color: 'var(--text-on-brand)', border: 'none', borderRadius: '7px', padding: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
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
                        {TRAINING_TYPE_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{TRAINING_TYPE_LABELS[opt]}</option>
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
                              width: 20, height: 20, borderRadius: '50%',
                              border: newTagColor === c.hex ? '2px solid var(--text-primary)' : '2px solid transparent',
                              background: c.hex, cursor: 'pointer', padding: 0,
                            }}
                            title={c.name}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => setShowNewTag(false)} style={{ ...inputStyle, textAlign: 'center', cursor: 'pointer', flex: 1, padding: '6px' }}>Cancelar</button>
                        <button type="button" onClick={handleCreateTag} disabled={creatingTag || !newTagName.trim()} style={{ flex: 1, background: 'var(--orange)', color: 'var(--text-on-brand)', border: 'none', borderRadius: '7px', padding: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
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

              {/* Biblioteca */}
              <div>
                <label style={labelStyle}>Biblioteca</label>
                <select
                  value={programSlug}
                  onChange={e => setProgramSlug(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">Nenhuma biblioteca</option>
                  {programs.map(program => (
                    <option key={program.id} value={program.slug}>{program.name}</option>
                  ))}
                </select>
              </div>

              {/* Distância + Duração (distância só na corrida) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {modality === 'corrida' && <div>
                  <label style={labelStyle}>Distância (m)</label>
                  <input
                    type="number"
                    min="0"
                    value={distanceM}
                    onChange={e => setDistanceM(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Ex: 5000"
                    style={inputStyle}
                  />
                </div>}
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

              {modality === 'corrida' && <>
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
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '18px', fontWeight: 600 }}>:</span>
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
              </>}

              {/* Hyrox / CrossFit: formato, time cap e blocos */}
              {hasBlocksModality(modality) && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: modality === 'crossfit' ? '1fr 1fr' : '1fr', gap: '12px' }}>
                    {modality === 'crossfit' && (
                      <div>
                        <label style={labelStyle}>Formato do WOD</label>
                        <select
                          value={wodFormat}
                          onChange={e => setWodFormat(e.target.value as WodFormat | '')}
                          style={{ ...inputStyle, cursor: 'pointer' }}
                        >
                          <option value="">Livre</option>
                          {(Object.keys(WOD_FORMAT_LABELS) as WodFormat[]).map(f => (
                            <option key={f} value={f}>{WOD_FORMAT_LABELS[f]}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label style={labelStyle}>Time cap (m:ss, opcional)</label>
                      <input
                        inputMode="numeric"
                        value={timeCapText}
                        onChange={e => setTimeCapText(e.target.value)}
                        placeholder={modality === 'hyrox' ? 'Ex: 1:30:00' : 'Ex: 20:00'}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>{modality === 'hyrox' ? 'Estações e corridas' : 'Blocos do WOD'}</label>
                    <TrainingBlocksEditor
                      modality={modality}
                      blocks={blocks}
                      exercises={exercises}
                      onChange={setBlocks}
                    />
                  </div>
                </>
              )}

              {/* Vídeo */}
              <div>
                <label style={labelStyle}>Vídeo (opcional)</label>

                {/* Toggle YouTube / Upload */}
                <div style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '4px', marginBottom: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setVideoMode('youtube')}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      background: videoMode === 'youtube' ? 'var(--orange)' : 'transparent',
                      color: videoMode === 'youtube' ? 'var(--text-on-brand)' : 'var(--text-secondary)',
                      border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <Link2 size={13} /> Link YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoMode('upload')}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      background: videoMode === 'upload' ? 'var(--orange)' : 'transparent',
                      color: videoMode === 'upload' ? 'var(--text-on-brand)' : 'var(--text-secondary)',
                      border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <Upload size={13} /> Upload de vídeo
                  </button>
                </div>

                {videoMode === 'youtube' ? (
                  <>
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={e => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      style={{ ...inputStyle, borderColor: (videoUrl && !YOUTUBE_REGEX.test(videoUrl)) ? '#EF4444' : 'var(--border-subtle)' }}
                    />
                    {(videoUrl && !YOUTUBE_REGEX.test(videoUrl)) && (
                      <span style={{ color: '#EF4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        Insira uma URL válida do YouTube
                      </span>
                    )}
                  </>
                ) : (
                  <div>
                    {uploadedFileName && !isUploading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '10px 12px' }}>
                        <Film size={16} color="var(--orange)" />
                        <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {uploadedFileName}
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveUploadedVideo}
                          style={{ background: 'none', border: 'none', color: 'var(--red-accent)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                          title="Remover vídeo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : (
                      <label
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          border: '1px dashed var(--border-default)', borderRadius: '10px', padding: '20px',
                          cursor: isUploading ? 'not-allowed' : 'pointer', textAlign: 'center',
                        }}
                      >
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          disabled={isUploading}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleFileSelect(file)
                            e.target.value = ''
                          }}
                          style={{ display: 'none' }}
                        />
                        <Upload size={20} color="var(--text-tertiary)" />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {isUploading ? 'Enviando...' : 'Clique para selecionar um vídeo'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Máximo 500MB — MP4, WebM ou MOV</span>
                      </label>
                    )}

                    {isUploading && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ width: '100%', height: '6px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--orange)', transition: 'width 0.2s' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>{uploadProgress}%</span>
                      </div>
                    )}

                    {uploadError && (
                      <span style={{ color: '#EF4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                        {uploadError}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {formError && (
                <p role="alert" style={{ margin: 0, color: 'var(--red-accent)', fontSize: '13px' }}>{formError}</p>
              )}

              {/* Botões */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  style={{
                    background: 'var(--orange)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 24px',
                    color: 'var(--text-on-brand)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    opacity: isUploading ? 0.6 : 1,
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
    {createPortal(
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Remover vídeo"
        description="O vídeo será apagado permanentemente do armazenamento ao salvar as alterações. Essa ação não pode ser desfeita. Deseja continuar?"
        confirmText="Remover"
        onConfirm={confirmRemoveVideo}
        onCancel={() => setShowDeleteConfirm(false)}
      />,
      document.body
    )}
    </>
  )
}
