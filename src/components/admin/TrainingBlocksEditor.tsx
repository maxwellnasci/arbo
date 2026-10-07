import { useState } from 'react'
import { ArrowUp, ArrowDown, Trash2, Plus, Zap } from 'lucide-react'
import {
  BLOCK_TYPE_LABELS,
  emptyBlock,
  formatSeconds,
  officialHyroxBlocks,
  parseTimeInput,
  type BlockDraft,
  type BlockType,
  type Exercise,
  type Modality,
} from '../../lib/modalities'
import styles from './TrainingBlocksEditor.module.css'

type Props = {
  modality: Modality
  blocks: BlockDraft[]
  exercises: Exercise[]
  onChange: (blocks: BlockDraft[]) => void
}

// Editor de blocos (estações do Hyrox / exercícios do WOD). Estado vive no
// TreinoFormPanel; o save (RPC save_training_blocks) é feito pelo pai.
export function TrainingBlocksEditor({ modality, blocks, exercises, onChange }: Props) {
  const sameModality = exercises.filter(e => e.modality === modality)
  const others = exercises.filter(e => e.modality !== modality && e.modality !== 'corrida')
  const hyroxStations = exercises.filter(e => e.modality === 'hyrox' && e.organization_id === null)
  const exerciseById = new Map(exercises.map(e => [e.id, e]))

  function update(index: number, patch: Partial<BlockDraft>) {
    onChange(blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function remove(index: number) {
    onChange(blocks.filter((_, i) => i !== index))
  }

  function add(type: BlockType) {
    onChange([...blocks, emptyBlock(type)])
  }

  function selectExercise(index: number, exerciseId: string) {
    const exercise = exerciseById.get(exerciseId)
    const block = blocks[index]
    const isEmpty = !block.distance_m && !block.reps && !block.load_kg && !block.duration_seconds
    update(index, {
      exercise_id: exerciseId || null,
      // aplica a meta padrão do exercício (ex.: Sled Push 50 m) só se o bloco estava vazio
      ...(exercise && isEmpty
        ? { distance_m: exercise.default_distance_m, reps: exercise.default_reps }
        : {}),
    })
  }

  const exerciseBlockType: BlockType = modality === 'hyrox' ? 'station' : 'wod'

  return (
    <div className={styles.editor}>
      {modality === 'hyrox' && blocks.length === 0 && hyroxStations.length > 0 && (
        <button type="button" className={styles.presetBtn} onClick={() => onChange(officialHyroxBlocks(hyroxStations))}>
          <Zap size={16} /> Montar Hyrox oficial (8 × 1 km + estação)
        </button>
      )}

      {blocks.length === 0 && (
        <p className={styles.empty}>
          {modality === 'hyrox'
            ? 'Monte a prova completa no atalho acima ou adicione corridas e estações.'
            : 'Adicione os exercícios do WOD na ordem em que devem ser feitos.'}
        </p>
      )}

      <ol className={styles.list}>
        {blocks.map((block, index) => (
          <li key={block.key} className={styles.block}>
            <div className={styles.blockHeader}>
              <span className={styles.index}>{index + 1}</span>
              <span className={styles.blockType}>{BLOCK_TYPE_LABELS[block.block_type]}</span>
              <div className={styles.actions}>
                <button type="button" className={styles.iconBtn} onClick={() => move(index, -1)} disabled={index === 0} aria-label="Subir bloco">
                  <ArrowUp size={14} />
                </button>
                <button type="button" className={styles.iconBtn} onClick={() => move(index, 1)} disabled={index === blocks.length - 1} aria-label="Descer bloco">
                  <ArrowDown size={14} />
                </button>
                <button type="button" className={`${styles.iconBtn} ${styles.danger}`} onClick={() => remove(index)} aria-label="Remover bloco">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {(block.block_type === 'station' || block.block_type === 'wod') && (
              <select
                className={styles.input}
                value={block.exercise_id ?? ''}
                onChange={e => selectExercise(index, e.target.value)}
                aria-label="Exercício"
              >
                <option value="">Escolha o exercício...</option>
                {sameModality.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                {others.length > 0 && (
                  <optgroup label="Outras modalidades">
                    {others.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </optgroup>
                )}
              </select>
            )}

            <div className={styles.grid}>
              {block.block_type !== 'rest' && (
                <NumberField label="Distância (m)" value={block.distance_m} onChange={v => update(index, { distance_m: v })} />
              )}
              {block.block_type === 'run' && (
                <TimeField label="Pace alvo (/km)" seconds={block.target_pace_seconds_per_km} onChange={v => update(index, { target_pace_seconds_per_km: v })} />
              )}
              {(block.block_type === 'station' || block.block_type === 'wod') && (
                <>
                  <NumberField label="Reps" value={block.reps} onChange={v => update(index, { reps: v })} />
                  <NumberField label="Carga (kg)" value={block.load_kg} step="0.5" onChange={v => update(index, { load_kg: v })} />
                  <NumberField label="Rounds" value={block.rounds} onChange={v => update(index, { rounds: v })} />
                </>
              )}
              {block.block_type !== 'run' && (
                <TimeField label="Tempo (m:ss)" seconds={block.duration_seconds} onChange={v => update(index, { duration_seconds: v })} />
              )}
            </div>

            <input
              className={styles.input}
              value={block.notes}
              maxLength={500}
              placeholder="Observação (opcional)"
              onChange={e => update(index, { notes: e.target.value })}
            />
          </li>
        ))}
      </ol>

      <div className={styles.addRow}>
        <button type="button" className={styles.addBtn} onClick={() => add('run')}>
          <Plus size={14} /> Corrida
        </button>
        <button type="button" className={styles.addBtn} onClick={() => add(exerciseBlockType)}>
          <Plus size={14} /> {modality === 'hyrox' ? 'Estação' : 'Exercício'}
        </button>
        <button type="button" className={styles.addBtn} onClick={() => add('rest')}>
          <Plus size={14} /> Descanso
        </button>
      </div>
    </div>
  )
}

function NumberField({ label, value, step = '1', onChange }: {
  label: string
  value: number | null
  step?: string
  onChange: (value: number | null) => void
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={value ?? ''}
        onChange={e => {
          const n = e.target.value === '' ? null : Number(e.target.value)
          onChange(n !== null && Number.isFinite(n) && n > 0 ? n : null)
        }}
      />
    </label>
  )
}

// Texto livre enquanto digita; converte para segundos ao sair do campo.
function TimeField({ label, seconds, onChange }: {
  label: string
  seconds: number | null
  onChange: (value: number | null) => void
}) {
  const [text, setText] = useState(formatSeconds(seconds))
  const [invalid, setInvalid] = useState(false)

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={`${styles.input} ${invalid ? styles.inputInvalid : ''}`}
        inputMode="numeric"
        placeholder="0:00"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => {
          const parsed = parseTimeInput(text)
          const isInvalid = text.trim() !== '' && parsed === null
          setInvalid(isInvalid)
          if (isInvalid) return
          onChange(parsed && parsed > 0 ? parsed : null)
          setText(formatSeconds(parsed && parsed > 0 ? parsed : null))
        }}
        aria-invalid={invalid}
      />
    </label>
  )
}
