import React, { useMemo, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

type ScheduleRow = Database['public']['Tables']['schedules']['Row']

interface Student {
  id: string
  full_name: string | null
}

interface GroupTrainingEntry {
  id: string               // group_plan_training_id
  training: {
    id: string
    title: string
  }
}

interface ProfessorStatusGridProps {
  groupId: string
  planId: string | null
  groupTrainings: GroupTrainingEntry[]
}

const STATUS_COMPLETED = 'completed'
const STATUS_SCHEDULED = 'scheduled'
const STATUS_PENDING   = 'pending'

const STATUS_COLORS: Record<string, string> = {
  [STATUS_COMPLETED]: 'var(--green-accent)',
  [STATUS_SCHEDULED]: 'var(--orange)',
  [STATUS_PENDING]:   'var(--bg-input)',
}

function cellStatus(schedule?: ScheduleRow): string {
  if (!schedule) return STATUS_PENDING
  if (schedule.completed_at) return STATUS_COMPLETED
  if (schedule.scheduled_day_of_week != null) return STATUS_SCHEDULED
  return STATUS_PENDING
}

const DAY_NAMES: Record<number, string> = { 1:'Seg',2:'Ter',3:'Qua',4:'Qui',5:'Sex',6:'Sáb',7:'Dom' }

const Cell = React.memo(({ schedule }: { schedule?: ScheduleRow }) => {
  const status = cellStatus(schedule)
  const title = status === STATUS_COMPLETED
    ? 'Concluído'
    : status === STATUS_SCHEDULED
      ? `Agendado: ${DAY_NAMES[schedule?.scheduled_day_of_week ?? 0] ?? schedule?.scheduled_day_of_week}`
      : 'Pendente'

  return (
    <div
      style={{
        width: '100px', minWidth: '100px', height: '40px',
        backgroundColor: STATUS_COLORS[status],
        border: '1px solid var(--border-default)',
        borderRadius: '4px',
        margin: '2px',
      }}
      title={title}
    />
  )
})

export function ProfessorStatusGrid({ groupId, planId, groupTrainings }: ProfessorStatusGridProps) {
  const [students, setStudents]   = useState<Student[]>([])
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!planId || !groupTrainings.length) {
        if (!cancelled) setIsLoading(false)
        return
      }

      setIsLoading(true)
      const gptIds = groupTrainings.map(t => t.id)

      const [profilesRes, schedulesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('group_id', groupId)
          .order('full_name')
          .limit(200),
        supabase
          .from('schedules')
          .select('id, student_id, group_plan_training_id, scheduled_day_of_week, checkin_id, completed_at, created_at, updated_at')
          .in('group_plan_training_id', gptIds)
          .limit(200),
      ])

      if (cancelled) return

      if (profilesRes.error || schedulesRes.error) {
        setError(profilesRes.error?.message || schedulesRes.error?.message || 'Erro desconhecido')
      }

      setStudents(profilesRes.data ?? [])
      setSchedules(schedulesRes.data ?? [])
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [groupId, planId, groupTrainings])

  // Chave: `${student_id}-${group_plan_training_id}`
  const scheduleMap = useMemo(() => {
    const map = new Map<string, ScheduleRow>()
    schedules.forEach(s => {
      map.set(`${s.student_id}-${s.group_plan_training_id}`, s)
    })
    return map
  }, [schedules])

  if (isLoading) return <div style={{ color: 'var(--text-secondary)', padding: '16px' }}>Carregando grid...</div>
  if (error) return <div style={{ color: 'var(--red-accent)', padding: '16px' }}>Erro ao carregar dados: {error}</div>

  if (!planId) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: '16px', fontSize: '14px' }}>
        Nenhum plano ativo para esta turma.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <div style={{ width: '150px', minWidth: '150px' }} />
        {groupTrainings.map(entry => (
          <div
            key={entry.id}
            style={{ width: '100px', minWidth: '100px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', padding: '4px', borderBottom: '1px solid var(--border-default)' }}
            title={entry.training.title}
          >
            {entry.training.title.length > 12 ? entry.training.title.slice(0, 12) + '…' : entry.training.title}
          </div>
        ))}
      </div>

      {/* Linhas por aluno */}
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {students.map(student => (
          <div key={student.id} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <div
              style={{ width: '150px', minWidth: '150px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={student.full_name ?? ''}
            >
              {student.full_name ?? '—'}
            </div>
            {groupTrainings.map(entry => (
              <Cell
                key={entry.id}
                schedule={scheduleMap.get(`${student.id}-${entry.id}`)}
              />
            ))}
          </div>
        ))}

        {students.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '16px 0' }}>
            Nenhum aluno nesta turma.
          </div>
        )}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
        {[
          { color: STATUS_COLORS[STATUS_COMPLETED], label: 'Concluído' },
          { color: STATUS_COLORS[STATUS_SCHEDULED], label: 'Agendado' },
          { color: STATUS_COLORS[STATUS_PENDING],   label: 'Pendente' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: color, border: '1px solid var(--border-default)' }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
