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

// Enums
export type TrainingType     = Database['public']['Enums']['training_type']
export type DistanceCategory = Database['public']['Enums']['distance_category']
export type UserLevel        = Database['public']['Enums']['user_level']
