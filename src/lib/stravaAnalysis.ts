import type { StravaAnalysis } from './types'

// Feedback do "Professor Digital Amigo" já no formato que a UI consome.
export type CoachFeedback = {
  message: string
  highlight: string | null
  nextStep: string
  summary: string
  promptVersion: number
}

// Colunas lidas de strava_analysis (ou devolvidas por strava-analyze). As da v2
// são opcionais porque análises antigas (prompt_version 1) só têm
// summary/analysis/tip.
export type StravaAnalysisFields = Pick<StravaAnalysis, 'summary' | 'analysis' | 'tip'> &
  Partial<Pick<StravaAnalysis, 'message' | 'highlight' | 'next_step' | 'prompt_version'>>

export const STRAVA_ANALYSIS_COLUMNS = 'summary, analysis, tip, message, highlight, next_step, prompt_version'

// v1 → message = analysis, nextStep = tip, sem highlight. Assim a mesma UI
// mostra análises antigas e novas sem precisar regenerar nada.
export function toCoachFeedback(row: StravaAnalysisFields): CoachFeedback {
  return {
    message: row.message?.trim() || row.analysis,
    highlight: row.highlight?.trim() || null,
    nextStep: row.next_step?.trim() || row.tip,
    summary: row.summary,
    promptVersion: row.prompt_version ?? 1,
  }
}
