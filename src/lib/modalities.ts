// Modalidades híbridas (Etapa 7): Corrida, CrossFit e Hyrox.
// Treino 'corrida' sem blocos continua com o comportamento de sempre.
import type { Database } from './database.types'

export type Modality = 'corrida' | 'crossfit' | 'hyrox'
export type WodFormat = 'for_time' | 'amrap' | 'emom' | 'rounds' | 'tabata'
export type BlockType = 'run' | 'station' | 'wod' | 'rest'
export type ExerciseMetric = 'distance' | 'reps' | 'time' | 'load'

export type Exercise = Database['public']['Tables']['exercises']['Row']
export type TrainingBlock = Database['public']['Tables']['training_blocks']['Row']
export type CheckinBlockResult = Database['public']['Tables']['checkin_block_results']['Row']

export type TrainingBlockWithExercise = TrainingBlock & {
  exercises: Pick<Exercise, 'id' | 'name' | 'metric' | 'modality'> | null
}

export const MODALITY_OPTIONS: { value: Modality; label: string }[] = [
  { value: 'corrida', label: 'Corrida' },
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'hyrox', label: 'Hyrox' },
]

export const MODALITY_LABELS: Record<Modality, string> = {
  corrida: 'Corrida',
  crossfit: 'CrossFit',
  hyrox: 'Hyrox',
}

export const WOD_FORMAT_LABELS: Record<WodFormat, string> = {
  for_time: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  rounds: 'Rounds',
  tabata: 'Tabata',
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  run: 'Corrida',
  station: 'Estação',
  wod: 'Exercício',
  rest: 'Descanso',
}

export function isModality(value: unknown): value is Modality {
  return value === 'corrida' || value === 'crossfit' || value === 'hyrox'
}

export function hasBlocksModality(modality: string | null | undefined): boolean {
  return modality === 'crossfit' || modality === 'hyrox'
}

// ── Rascunho de bloco no formulário do professor ───────────────────────────
// Campos numéricos como number | null; `key` é só para o React (id local).
export type BlockDraft = {
  key: string
  id: string | null
  block_type: BlockType
  exercise_id: string | null
  distance_m: number | null
  reps: number | null
  load_kg: number | null
  duration_seconds: number | null
  target_pace_seconds_per_km: number | null
  rounds: number | null
  notes: string
}

let localKey = 0
export function newBlockKey(): string {
  localKey += 1
  return `new-${localKey}`
}

export function emptyBlock(blockType: BlockType, exercise?: Pick<Exercise, 'id' | 'default_distance_m' | 'default_reps'>): BlockDraft {
  return {
    key: newBlockKey(),
    id: null,
    block_type: blockType,
    exercise_id: exercise?.id ?? null,
    distance_m: exercise?.default_distance_m ?? (blockType === 'run' ? 1000 : null),
    reps: exercise?.default_reps ?? null,
    load_kg: null,
    duration_seconds: null,
    target_pace_seconds_per_km: null,
    rounds: null,
    notes: '',
  }
}

export function blockDraftFromRow(row: TrainingBlock): BlockDraft {
  return {
    key: row.id,
    id: row.id,
    block_type: row.block_type as BlockType,
    exercise_id: row.exercise_id,
    distance_m: row.distance_m,
    reps: row.reps,
    load_kg: row.load_kg,
    duration_seconds: row.duration_seconds,
    target_pace_seconds_per_km: row.target_pace_seconds_per_km,
    rounds: row.rounds,
    notes: row.notes ?? '',
  }
}

// Payload da RPC save_training_blocks (ordem = posição no array).
export function blockDraftsToPayload(blocks: BlockDraft[]) {
  return blocks.map(b => ({
    ...(b.id ? { id: b.id } : {}),
    block_type: b.block_type,
    exercise_id: b.block_type === 'run' || b.block_type === 'rest' ? null : b.exercise_id,
    distance_m: positiveOrNull(b.distance_m),
    reps: positiveOrNull(b.reps),
    load_kg: positiveOrNull(b.load_kg),
    duration_seconds: positiveOrNull(b.duration_seconds),
    target_pace_seconds_per_km: positiveOrNull(b.target_pace_seconds_per_km),
    rounds: positiveOrNull(b.rounds),
    notes: b.notes.trim() || null,
  }))
}

function positiveOrNull(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

// Hyrox oficial: 8 × (1 km de corrida + estação), na ordem da prova.
export function officialHyroxBlocks(stations: Pick<Exercise, 'id' | 'default_distance_m' | 'default_reps' | 'sort_order'>[]): BlockDraft[] {
  return [...stations]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap(station => [emptyBlock('run'), emptyBlock('station', station)])
}

// ── Tempo ──────────────────────────────────────────────────────────────────

export function formatSeconds(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(total) || total < 0) return ''
  const s = Math.round(total)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

// Aceita "4:30" (m:ss), "1:02:15" (h:mm:ss) ou só segundos ("90"). Retorna
// null para vazio ou formato inválido.
export function parseTimeInput(value: string): number | null {
  const v = value.trim()
  if (!v) return null
  if (/^\d+$/.test(v)) return Number(v)
  const parts = v.split(':')
  if (parts.length < 2 || parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.slice(1).some(n => n >= 60)) return null
  return nums.reduce((acc, n) => acc * 60 + n, 0)
}

// ── Descrição da meta de um bloco (cards do aluno/professor) ───────────────

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km` : `${m} m`
}

export function describeBlockTarget(block: Pick<TrainingBlock, 'distance_m' | 'reps' | 'load_kg' | 'duration_seconds' | 'rounds' | 'target_pace_seconds_per_km'>): string {
  const parts: string[] = []
  if (block.rounds) parts.push(`${block.rounds}×`)
  if (block.distance_m) parts.push(formatDistance(block.distance_m))
  if (block.reps) parts.push(`${block.reps} reps`)
  if (block.load_kg) parts.push(`${Number(block.load_kg).toLocaleString('pt-BR')} kg`)
  if (block.duration_seconds) parts.push(formatSeconds(block.duration_seconds))
  if (block.target_pace_seconds_per_km) parts.push(`pace ${formatSeconds(block.target_pace_seconds_per_km)}/km`)
  return parts.join(' · ')
}

export function blockTitle(block: Pick<TrainingBlock, 'block_type'>, exerciseName: string | null | undefined): string {
  if (block.block_type === 'run') return 'Corrida'
  if (block.block_type === 'rest') return 'Descanso'
  return exerciseName ?? BLOCK_TYPE_LABELS[block.block_type as BlockType] ?? 'Bloco'
}
