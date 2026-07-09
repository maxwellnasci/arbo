import type { Database } from './database.types'

// Atalhos para os tipos de cada tabela (Row = linha lida do banco)
export type Profile         = Database['public']['Tables']['profiles']['Row']
export type Training        = Database['public']['Tables']['trainings']['Row']
export type WeeklyPlan      = Database['public']['Tables']['weekly_plans']['Row']
export type WeeklyPlanTraining = Database['public']['Tables']['weekly_plan_trainings']['Row']
export type Checkin         = Database['public']['Tables']['checkins']['Row']
export type PersonalRecord  = Database['public']['Tables']['records']['Row']  // "Record" é reservado no TS
export type Comment         = Database['public']['Tables']['comments']['Row']
export type Reaction        = Database['public']['Tables']['reactions']['Row']
export type StravaActivity  = Database['public']['Tables']['strava_activities']['Row']
export type Anamnesis       = Database['public']['Tables']['anamnesis']['Row']
export type Group           = Database['public']['Tables']['groups']['Row']
export type GroupPlan       = Database['public']['Tables']['group_plans']['Row']
export type GroupPlanTraining = Database['public']['Tables']['group_plan_trainings']['Row']
export type Tag             = Database['public']['Tables']['tags']['Row']
export type TrainingCustomType = Database['public']['Tables']['training_types']['Row']
export type TrainingProgram = Database['public']['Tables']['training_programs']['Row']

// Enums
// trainings.type was converted from enum to text (migration 20260606010118).
// The branded union `(string & {})` preserves IDE autocomplete for known values
// while allowing custom types. Record<TrainingType, V> maps still need `?? fallback`
// for custom type keys not present in the record.
export type TrainingType = 'corrida' | 'hiit' | 'recovery' | 'forca' | 'mobilidade' | (string & {})
export type DistanceCategory = Database['public']['Enums']['distance_category']
export type UserLevel        = Database['public']['Enums']['user_level']

// Valores que correspondem exatamente ao que é armazenado no banco (coluna groups.mode)
export type GroupMode = 'fixo' | 'flexivel'

export type ScheduleStatus = 'pendente' | 'agendado' | 'concluido'

// Espelha exatamente o schema da tabela schedules no Supabase
export type Schedule = Database['public']['Tables']['schedules']['Row']
