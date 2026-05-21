import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLogout } from '../../hooks/useLogout'
import { useWeeklyPlan, type DayTraining } from '../../hooks/useWeeklyPlan'
import { supabase } from '../../lib/supabase'
import type { TrainingType, UserLevel } from '../../lib/types'
import styles from './AlunoDashboard.module.css'

const DAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
}

const TYPE_CLASS: Record<TrainingType, string> = {
  corrida:    styles.typeCorrida,
  hiit:       styles.typeHiit,
  recovery:   styles.typeRecovery,
  forca:      styles.typeForca,
  mobilidade: styles.typeMobilidade,
}

const LEVEL_LABEL: Record<UserLevel, string> = {
  iniciante:     'Iniciante',
  intermediario: 'Intermediário',
  avancado:      'Avançado',
}

const LEVEL_CLASS: Record<UserLevel, string> = {
  iniciante:     styles.levelIniciante,
  intermediario: styles.levelIntermediario,
  avancado:      styles.levelAvancado,
}

function getGreeting(name: string | null | undefined, email: string | undefined): string {
  const hour = new Date().getHours()
  const period = hour >= 5 && hour < 12 ? 'Bom dia'
    : hour >= 12 && hour < 18 ? 'Boa tarde'
    : 'Boa noite'
  return `${period}, ${name ?? email ?? 'atleta'}!`
}

function formatDistance(meters: number | null): string | null {
  if (meters === null || meters === undefined) return null
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

function formatPace(secondsPerKm: number | null): string | null {
  if (secondsPerKm === null || secondsPerKm === undefined) return null
  const min = Math.floor(secondsPerKm / 60)
  const sec = String(secondsPerKm % 60).padStart(2, '0')
  return `${min}:${sec} /km`
}

type CheckinModalProps = {
  dayTraining: DayTraining
  planId: string
  userId: string
  onClose: () => void
  onSuccess: () => void
}

function CheckinModal({ dayTraining, planId, userId, onClose, onSuccess }: CheckinModalProps) {
  const [distance, setDistance] = useState('')
  const [minutes, setMinutes] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const distM = distance ? parseInt(distance, 10) : null
    const durSec = minutes ? Math.round(parseFloat(minutes) * 60) : null
    const pace = distM && durSec ? Math.round(durSec / (distM / 1000)) : null

    const { error: err } = await supabase.from('checkins').insert({
      student_id: userId,
      training_id: dayTraining.training.id,
      plan_id: planId,
      actual_distance_m: distM,
      actual_duration_seconds: durSec,
      actual_pace_seconds_per_km: pace,
      notes: notes.trim() || null,
    })

    setSubmitting(false)

    if (err) {
      setError(err.message)
      return
    }

    onSuccess()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Check-in</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <p className={styles.modalSubtitle}>{dayTraining.training.title}</p>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Distância percorrida (m) — opcional</label>
            <input
              type="number"
              className={styles.input}
              value={distance}
              onChange={e => setDistance(e.target.value)}
              min={0}
              placeholder="ex: 5000"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Tempo total (minutos) — opcional</label>
            <input
              type="number"
              className={styles.input}
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              min={0}
              step="0.1"
              placeholder="ex: 30"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Observações — opcional</label>
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Como foi o treino?"
            />
          </div>
          {error && <p className={styles.modalError}>{error}</p>}
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? 'Salvando...' : 'Registrar treino'}
          </button>
        </form>
      </div>
    </div>
  )
}

type TrainingCardProps = {
  dayTraining: DayTraining
  planId: string
  userId: string
  isToday: boolean
  onCheckinSuccess: () => void
}

function TrainingCard({ dayTraining, planId, userId, isToday, onCheckinSuccess }: TrainingCardProps) {
  const [showModal, setShowModal] = useState(false)
  const { training, checkin, dayOfWeek } = dayTraining

  return (
    <>
      <div className={`${styles.card}${isToday ? ` ${styles.cardToday}` : ''}`}>
        <div className={styles.cardHeader}>
          <span className={styles.dayName}>{DAY_NAMES[dayOfWeek] ?? `Dia ${dayOfWeek}`}</span>
          <span className={`${styles.typeBadge} ${TYPE_CLASS[training.type] ?? styles.typeDefault}`}>
            {training.type}
          </span>
        </div>

        <h3 className={styles.trainingTitle}>{training.title}</h3>

        <div className={styles.trainingMeta}>
          {training.distance_m != null && (
            <span className={styles.metaItem}>
              Distância: <span className={styles.metaValue}>{formatDistance(training.distance_m)}</span>
            </span>
          )}
          {training.target_pace_seconds_per_km != null && (
            <span className={styles.metaItem}>
              Pace: <span className={styles.metaValue}>{formatPace(training.target_pace_seconds_per_km)}</span>
            </span>
          )}
          {training.duration_minutes != null && (
            <span className={styles.metaItem}>
              Duração: <span className={styles.metaValue}>{training.duration_minutes} min</span>
            </span>
          )}
        </div>

        {checkin ? (
          <div className={styles.doneBadge}>Concluído ✓</div>
        ) : (
          <button className={styles.checkinBtn} onClick={() => setShowModal(true)}>
            Fazer check-in
          </button>
        )}
      </div>

      {showModal && (
        <CheckinModal
          dayTraining={dayTraining}
          planId={planId}
          userId={userId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            onCheckinSuccess()
          }}
        />
      )}
    </>
  )
}

export default function AlunoDashboard() {
  const { user } = useAuth()
  const logout = useLogout()
  const { profile, plan, trainings, isLoading, error, refresh } = useWeeklyPlan(user?.id)

  const todayDow = new Date().getDay()
  const completed = trainings.filter(t => t.checkin !== null).length
  const total = trainings.length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.stateCard}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Carregando...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.stateCard}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={refresh}>Tentar novamente</button>
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <header className={styles.header}>
          <div>
            <h1 className={styles.greeting}>
              {getGreeting(profile?.full_name, user?.email)}
            </h1>
            {profile?.level && (
              <span className={`${styles.levelBadge} ${LEVEL_CLASS[profile.level] ?? styles.levelIniciante}`}>
                {LEVEL_LABEL[profile.level] ?? profile.level}
              </span>
            )}
          </div>
          <button className={styles.logoutBtn} onClick={logout}>Sair</button>
        </header>

        {!plan ? (
          <div className={styles.stateCard}>
            <p className={styles.emptyText}>Nenhum treino programado para esta semana.</p>
          </div>
        ) : (
          <>
            <section className={styles.progressSection}>
              <p className={styles.progressLabel}>{completed} de {total} treinos realizados</p>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
              </div>
            </section>

            <div className={styles.trainingList}>
              {[...trainings].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(dt => (
                <TrainingCard
                  key={dt.weeklyPlanTrainingId}
                  dayTraining={dt}
                  planId={plan.id}
                  userId={user.id}
                  isToday={dt.dayOfWeek === todayDow}
                  onCheckinSuccess={refresh}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
