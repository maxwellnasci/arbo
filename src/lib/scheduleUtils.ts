export function getScheduleStatus(schedule: unknown): 'pendente' | 'concluido' | 'agendado' {
  if (schedule == null || typeof schedule !== 'object') return 'pendente'

  const s = schedule as Record<string, unknown>
  if (s['completed_at'] != null) return 'concluido'
  if (s['scheduled_day_of_week'] != null) return 'agendado'
  return 'pendente'
}
