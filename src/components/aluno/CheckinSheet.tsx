import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Checkin } from '../../lib/types'
import type { DayTraining } from '../../hooks/useWeeklyPlan'
import { useStravaActivitiesLocal, type StravaActivityLocal } from '../../hooks/useStravaActivitiesLocal'
import styles from './CheckinSheet.module.css'

const EFFORT_EMOJIS: Record<number, string> = {
  1: '😴', 2: '🙂', 3: '💪', 4: '🔥', 5: '💀',
}

function formatActivityDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return '--:--'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

type CheckinSheetProps = {
  dayTraining: DayTraining
  planId: string | null
  userId: string
  scheduleId?: string
  existingCheckin?: Checkin | null
  usedStravaActivityIds?: Set<number>
  onClose: () => void
  onSuccess: () => void
}

export default function CheckinSheet({ dayTraining, planId, userId, scheduleId, existingCheckin, usedStravaActivityIds, onClose, onSuccess }: CheckinSheetProps) {
  const [distance, setDistance] = useState(() =>
    existingCheckin?.actual_distance_m != null
      ? String(existingCheckin.actual_distance_m / 1000).replace('.', ',')
      : ''
  )
  const [minutes, setMinutes] = useState(() =>
    existingCheckin?.actual_duration_seconds != null
      ? String(existingCheckin.actual_duration_seconds / 60)
      : ''
  )
  const [notes, setNotes] = useState(() => existingCheckin?.notes ?? '')
  const [effort, setEffort] = useState<number | null>(() => existingCheckin?.perceived_effort ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showStravaList, setShowStravaList] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<StravaActivityLocal | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { activities: stravaActivities } = useStravaActivitiesLocal(userId)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  function adjustDistance(delta: number) {
    const v = parseFloat(distance.replace(',', '.') || '0')
    const next = Math.max(0, Math.round((v + delta) * 10) / 10)
    setDistance(String(next).replace('.', ','))
  }

  function adjustMinutes(delta: number) {
    const v = parseFloat(minutes || '0')
    setMinutes(String(Math.max(0, v + delta)))
  }

  function handleSelectActivity(activity: StravaActivityLocal) {
    setSelectedActivity(activity)
    setDistance(String(activity.distance_m / 1000).replace('.', ','))
    setMinutes(String(Math.round(activity.duration_seconds / 60)))
    setShowStravaList(false)
  }

  function handleClearStravaImport() {
    setSelectedActivity(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const distM = distance.trim()
      ? Math.round(parseFloat(distance.trim().replace(',', '.')) * 1000)
      : null
    const durSec = minutes ? Math.round(parseFloat(minutes) * 60) : null
    const pace   = distM && durSec ? Math.round(durSec / (distM / 1000)) : null

    const payload = {
      actual_distance_m:          distM,
      actual_duration_seconds:    durSec,
      actual_pace_seconds_per_km: pace,
      notes:                      notes.trim() || null,
      perceived_effort:           effort,
    }

    let checkinErr: string | null = null
    let newCheckinId: string | null = null

    if (existingCheckin) {
      const { error } = await supabase.from('checkins').update(payload).eq('id', existingCheckin.id)
      if (error) checkinErr = error.message
    } else {
      const { data, error } = await supabase
        .from('checkins')
        .insert({
          student_id:          userId,
          training_id:         dayTraining.training.id,
          plan_id:             planId || null,
          strava_activity_id:  selectedActivity?.strava_id ?? null,
          ...payload,
        })
        .select('id')
        .single()
      if (error) checkinErr = error.message
      newCheckinId = data?.id ?? null
    }

    // Vincula o agendamento ao checkin recém-criado (modo flexível)
    if (!checkinErr && scheduleId && newCheckinId) {
      const { error: schedErr } = await supabase
        .from('schedules')
        .update({ checkin_id: newCheckinId, completed_at: new Date().toISOString() })
        .eq('id', scheduleId)
      if (schedErr) console.error('Erro ao vincular agendamento:', schedErr.message)
    }

    setSubmitting(false)
    if (checkinErr) { setError(checkinErr); return }

    setShowSuccess(true)
    timerRef.current = setTimeout(() => {
      onSuccess()
      onClose()
    }, 1500)
  }

  return createPortal(
    <AnimatePresence>
      <div className={styles.overlay} onClick={onClose}>
        <motion.div
          className={styles.sheet}
          onClick={e => e.stopPropagation()}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <div className={styles.handle} />

          {showSuccess ? (
            <div className={styles.successState}>
              <div className={styles.successIcon}>✓</div>
              <p className={styles.successText}>Treino registrado!</p>
            </div>
          ) : (
            <>
              <div className={styles.header}>
                <h2 className={styles.title}>
                  {existingCheckin ? 'Editar check-in' : 'Check-in'}
                </h2>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
                  ×
                </button>
              </div>
              <p className={styles.subtitle}>{dayTraining.training.title}</p>

              {!existingCheckin && stravaActivities.length > 0 && (
                <div className={styles.stravaSection}>
                  {selectedActivity ? (
                    <div className={styles.stravaImportedBadge}>
                      <Activity size={14} />
                      <span className={styles.stravaImportedText}>Importado do Strava · {selectedActivity.name}</span>
                      <button
                        type="button"
                        className={styles.stravaClearBtn}
                        onClick={handleClearStravaImport}
                        aria-label="Remover importação do Strava"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.stravaImportBtn}
                        onClick={() => setShowStravaList(s => !s)}
                      >
                        <Activity size={16} />
                        Importar do Strava
                      </button>
                      {showStravaList && (
                        <div className={styles.stravaList}>
                          {stravaActivities.map(activity => {
                            const alreadyUsed = usedStravaActivityIds?.has(activity.strava_id) ?? false
                            return (
                              <button
                                key={activity.strava_id}
                                type="button"
                                className={styles.stravaItem}
                                onClick={() => handleSelectActivity(activity)}
                              >
                                <div className={styles.stravaItemRow}>
                                  <span className={styles.stravaItemName}>{activity.name}</span>
                                  {alreadyUsed && <span className={styles.stravaItemUsedBadge}>já usada</span>}
                                </div>
                                <span className={styles.stravaItemDetails}>
                                  {formatActivityDate(activity.start_date)} · {(activity.distance_m / 1000).toFixed(1)} km · {formatPace(activity.pace_seconds_per_km)} /km
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className={styles.form}>
                {/* Distância */}
                <div className={styles.field}>
                  <label className={styles.label}>Distância (km)</label>
                  <div className={styles.numericInput}>
                    <button type="button" className={styles.numBtn} onClick={() => adjustDistance(-0.5)} disabled={!!selectedActivity}>−</button>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={styles.inputField}
                      value={distance}
                      onChange={e => setDistance(e.target.value)}
                      placeholder="0,0"
                      readOnly={!!selectedActivity}
                    />
                    <button type="button" className={styles.numBtn} onClick={() => adjustDistance(0.5)} disabled={!!selectedActivity}>+</button>
                  </div>
                </div>

                {/* Tempo */}
                <div className={styles.field}>
                  <label className={styles.label}>Tempo (min)</label>
                  <div className={styles.numericInput}>
                    <button type="button" className={styles.numBtn} onClick={() => adjustMinutes(-5)} disabled={!!selectedActivity}>−</button>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={styles.inputField}
                      value={minutes}
                      onChange={e => setMinutes(e.target.value)}
                      placeholder="0"
                      readOnly={!!selectedActivity}
                    />
                    <button type="button" className={styles.numBtn} onClick={() => adjustMinutes(5)} disabled={!!selectedActivity}>+</button>
                  </div>
                </div>

                {/* Percepção de esforço */}
                <div className={styles.field}>
                  <label className={styles.label}>Percepção de esforço — opcional</label>
                  <div className={styles.effortRow}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        className={`${styles.effortBtn}${effort === n ? ` ${styles.effortBtnActive}` : ''}`}
                        onClick={() => setEffort(effort === n ? null : n)}
                      >
                        <span className={styles.effortEmoji}>{EFFORT_EMOJIS[n]}</span>
                        <span className={styles.effortNum}>{n}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Observações */}
                <div className={styles.field}>
                  <label className={styles.label}>Observações — opcional</label>
                  <textarea
                    className={styles.textarea}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Como foi o treino?"
                    rows={2}
                  />
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? 'Salvando...' : existingCheckin ? 'Salvar alterações' : 'Registrar treino'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
