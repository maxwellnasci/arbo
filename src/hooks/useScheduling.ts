import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type Schedule = Database['public']['Tables']['schedules']['Row']

const SELECT_FIELDS = 'id, student_id, group_plan_training_id, scheduled_day_of_week, checkin_id, completed_at, created_at, updated_at'

export function useScheduling(groupPlanTrainingIds: string[]) {
  const [loading, setLoading] = useState(false)

  const fetchSchedules = useCallback(async (studentId?: string): Promise<Schedule[]> => {
    if (!groupPlanTrainingIds.length) return []
    setLoading(true)

    let query = supabase
      .from('schedules')
      .select(SELECT_FIELDS)
      .in('group_plan_training_id', groupPlanTrainingIds)

    if (studentId) query = query.eq('student_id', studentId)

    const { data, error } = await query.order('scheduled_day_of_week')
    setLoading(false)

    if (error) {
      console.error('Erro ao buscar agendamentos:', error.message)
      return []
    }
    return data ?? []
  }, [groupPlanTrainingIds])

  const scheduleTraining = useCallback(async (
    studentId: string,
    groupPlanTrainingId: string,
    scheduledDayOfWeek: number,
  ): Promise<Schedule | null> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('schedules')
      .insert({ student_id: studentId, group_plan_training_id: groupPlanTrainingId, scheduled_day_of_week: scheduledDayOfWeek })
      .select(SELECT_FIELDS)
      .single()
    setLoading(false)

    if (error) {
      console.error('Erro ao agendar treino:', error.message)
      return null
    }
    return data
  }, [])

  const rescheduleTraining = useCallback(async (
    scheduleId: string,
    newDayOfWeek: number,
  ): Promise<Schedule | null> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('schedules')
      .update({ scheduled_day_of_week: newDayOfWeek, updated_at: new Date().toISOString() })
      .eq('id', scheduleId)
      .select(SELECT_FIELDS)
      .single()
    setLoading(false)

    if (error) {
      console.error('Erro ao reagendar treino:', error.message)
      return null
    }
    return data
  }, [])

  // Não inclui confirmação — o chamador deve exibir ConfirmModal antes de invocar
  const deleteSchedule = useCallback(async (scheduleId: string): Promise<boolean> => {
    setLoading(true)
    const { error } = await supabase.from('schedules').delete().eq('id', scheduleId)
    setLoading(false)

    if (error) {
      console.error('Erro ao excluir agendamento:', error.message)
      return false
    }
    return true
  }, [])

  return { fetchSchedules, scheduleTraining, rescheduleTraining, deleteSchedule, loading }
}
