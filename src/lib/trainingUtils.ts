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

// Programas da biblioteca de treinos do professor (trainings.program)
export const PROGRAM_OPTIONS = ['do_zero_5k', 'aperfeicoando_5k', 'rumo_10k'] as const

export const PROGRAM_LABELS: Record<string, string> = {
  do_zero_5k: 'Do Zero aos 5km',
  aperfeicoando_5k: 'Aperfeiçoando os 5km',
  rumo_10k: 'Rumo aos 10km',
}

export const PROGRAM_COLORS: Record<string, string> = {
  do_zero_5k: 'var(--green-accent)',
  aperfeicoando_5k: 'var(--yellow-accent)',
  rumo_10k: 'var(--red-accent)',
}

export const PROGRAM_BG_COLORS: Record<string, string> = {
  do_zero_5k: 'var(--green-subtle)',
  aperfeicoando_5k: 'var(--yellow-subtle)',
  rumo_10k: 'var(--red-subtle)',
}

export const PROGRAM_BORDER_COLORS: Record<string, string> = {
  do_zero_5k: 'var(--green-border)',
  aperfeicoando_5k: 'var(--yellow-border)',
  rumo_10k: 'var(--red-border)',
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
