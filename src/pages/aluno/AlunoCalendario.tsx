import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar } from 'lucide-react'
import { useProgresso } from '../../hooks/useProgresso'
import type { CheckinData } from '../../hooks/useProgresso'
import CheckinDetailModal from '../../components/shared/CheckinDetailModal'
import progressoStyles from './AlunoProgresso.module.css'
import styles from './AlunoCalendario.module.css'

function formatTime(seconds: number): string {
  if (!seconds) return 'N/A'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${h}:${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

const EFFORT_EMOJIS: Record<number, string> = {
  1: '😴', 2: '🙂', 3: '💪', 4: '🔥', 5: '💀',
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

type MonthGroup = {
  key: string
  label: string
  checkins: CheckinData[]
  totalKm: number
}

function groupByMonth(checkins: CheckinData[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  for (const checkin of checkins) {
    const key = monthKey(checkin.created_at)
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: monthLabel(checkin.created_at), checkins: [], totalKm: 0 }
      groups.push(group)
    }
    group.checkins.push(checkin)
    const dist = checkin.actual_distance_m ?? checkin.trainings?.distance_m ?? 0
    group.totalKm += dist / 1000
  }
  return groups
}

export default function AlunoCalendario({ studentId }: { studentId: string }) {
  const { allCheckins, isLoading, markFeedbackSeen } = useProgresso(studentId)
  const [selectedCheckin, setSelectedCheckin] = useState<CheckinData | null>(null)

  function handleOpenCheckin(checkin: CheckinData) {
    setSelectedCheckin(checkin)
    if (checkin.professor_feedback && !checkin.professor_feedback_seen_at) {
      markFeedbackSeen(checkin.id)
    }
  }

  if (isLoading) {
    return <div className={progressoStyles.loadingState}>Carregando histórico...</div>
  }

  const monthGroups = groupByMonth(allCheckins)

  return (
    <div className={progressoStyles.container}>
      <header className={progressoStyles.hero}>
        <p className={progressoStyles.eyebrow}>CALENDÁRIO</p>
        <h1 className={progressoStyles.title}>
          Seu histórico,<br />
          <em>completo.</em>
        </h1>
      </header>

      {monthGroups.length === 0 ? (
        <div className={styles.emptyState}>
          <Calendar size={32} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Nenhum check-in ainda</p>
          <p className={styles.emptySubtext}>Seu histórico vai aparecer aqui conforme você for fazendo check-ins.</p>
        </div>
      ) : (
        monthGroups.map(group => (
          <section key={group.key} className={progressoStyles.section}>
            <div className={styles.monthHeader}>
              <h2 className={progressoStyles.sectionTitle}>{group.label}</h2>
              <span className={styles.monthSummary}>
                {group.checkins.length} {group.checkins.length === 1 ? 'treino' : 'treinos'} · {group.totalKm.toFixed(1).replace('.', ',')} km
              </span>
            </div>
            <div className={progressoStyles.historyList}>
              {group.checkins.map((checkin, i) => {
                const dist = checkin.actual_distance_m || checkin.trainings?.distance_m
                const time = checkin.actual_duration_seconds
                const pace = checkin.actual_pace_seconds_per_km
                const emoji = checkin.perceived_effort ? EFFORT_EMOJIS[checkin.perceived_effort] : '✅'
                const hasUnseenFeedback = !!checkin.professor_feedback && !checkin.professor_feedback_seen_at

                return (
                  <motion.div
                    key={checkin.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                  >
                    <button
                      type="button"
                      className={progressoStyles.historyCard}
                      onClick={() => handleOpenCheckin(checkin)}
                    >
                      <div className={progressoStyles.historyHeader}>
                        <span className={progressoStyles.historyDate}>
                          {new Date(checkin.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                        <span className={progressoStyles.historyEmoji}>{emoji}</span>
                      </div>

                      <div className={progressoStyles.historyTitle}>
                        {checkin.trainings?.title || (checkin.trainings?.type?.toUpperCase() ?? '')}
                      </div>

                      <div className={progressoStyles.historyStats}>
                        {dist && <span>{(dist / 1000).toFixed(2).replace('.', ',')} km</span>}
                        {time && pace && <span> • </span>}
                        {pace && <span>Pace {formatTime(pace)}</span>}
                      </div>

                      {checkin.notes && (
                        <div className={progressoStyles.historyNotes}>
                          "{checkin.notes}"
                        </div>
                      )}

                      {hasUnseenFeedback && (
                        <div className={progressoStyles.historyFeedbackBadge}>💬 Feedback do professor</div>
                      )}
                    </button>
                  </motion.div>
                )
              })}
            </div>
          </section>
        ))
      )}

      {selectedCheckin && (
        <CheckinDetailModal
          checkin={selectedCheckin}
          onClose={() => setSelectedCheckin(null)}
          readOnly
        />
      )}
    </div>
  )
}
