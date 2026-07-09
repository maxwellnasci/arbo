import { supabase } from './supabase'

// Shared color palette for tag creation (used in TreinoFormPanel and AdminTurmaDetail)
export const TAG_COLORS = [
  { name: 'Laranja', hex: '#E8521A' },
  { name: 'Azul', hex: '#3B82F6' },
  { name: 'Verde', hex: '#22C55E' },
  { name: 'Vermelho', hex: '#EF4444' },
  { name: 'Amarelo', hex: '#EAB308' },
  { name: 'Roxo', hex: '#A855F7' },
  { name: 'Ciano', hex: '#06B6D4' },
  { name: 'Cinza', hex: '#71717A' },
]

// Authoritative list of built-in training types
export const TRAINING_TYPE_OPTIONS = ['corrida', 'hiit', 'recovery', 'forca', 'mobilidade'] as const

export const TRAINING_TYPE_LABELS: Record<string, string> = {
  corrida: 'Corrida',
  hiit: 'HIIT',
  recovery: 'Recuperação',
  forca: 'Força',
  mobilidade: 'Mobilidade',
}

// Cores selecionáveis para bibliotecas de treino (training_programs.color) —
// mesmas 4 opções do CHECK constraint no banco.
export const PROGRAM_COLOR_OPTIONS = ['green', 'yellow', 'orange', 'red'] as const

export const PROGRAM_COLOR_LABELS: Record<string, string> = {
  green: 'Verde',
  yellow: 'Amarelo',
  orange: 'Laranja',
  red: 'Vermelho',
}

export const PROGRAM_COLOR_VAR_MAP: Record<string, { accent: string; bg: string; border: string }> = {
  green: { accent: 'var(--green-accent)', bg: 'var(--green-subtle)', border: 'var(--green-border)' },
  yellow: { accent: 'var(--yellow-accent)', bg: 'var(--yellow-subtle)', border: 'var(--yellow-border)' },
  orange: { accent: 'var(--orange)', bg: 'var(--orange-subtle)', border: 'var(--orange-border)' },
  red: { accent: 'var(--red-accent)', bg: 'var(--red-subtle)', border: 'var(--red-border)' },
}

// Métodos/categorias de treino de corrida (trainings.category)
export const CATEGORY_OPTIONS = [
  'intervalado',
  'fartlek',
  'contínuo',
  'progressivo',
  'pirâmide',
  'ritmo',
  'regenerativo',
  'teste',
] as const

export const CATEGORY_LABELS: Record<string, string> = {
  intervalado: 'Intervalado',
  fartlek: 'Fartlek',
  'contínuo': 'Contínuo',
  progressivo: 'Progressivo',
  'pirâmide': 'Pirâmide',
  ritmo: 'Ritmo',
  regenerativo: 'Regenerativo',
  teste: 'Teste',
}

export async function insertTag(userId: string, name: string, color: string) {
  return supabase
    .from('tags')
    .insert({ name, color, created_by: userId })
    .select('id, name, color, created_at, created_by, updated_at')
    .single()
}

export async function insertTrainingType(userId: string, name: string) {
  return supabase
    .from('training_types')
    .insert({ name, is_custom: true, created_by: userId })
    .select('id, name, is_custom, created_at, created_by')
    .single()
}
