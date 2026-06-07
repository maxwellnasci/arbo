import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import type { Checkin } from '../../lib/types'
import type { DayTraining } from '../../hooks/useWeeklyPlan'
import styles from './CheckinSheet.module.css'

const EFFORT_EMOJIS: Record<number, string> = {
  1: '😴', 2: '🙂', 3: '💪', 4: '🔥', 5: '💀',
}

type CheckinSheetProps = {
  dayTraining: DayTraining
  planId: string | null
  userId: string
  scheduleId?: string
  existingCheckin?: Checkin | null
  onClose: () => void
  onSuccess: () => void
}

export default function CheckinSheet({ dayTraining, planId, userId, scheduleId, existingCheckin, onClose, onSuccess }: CheckinSheetProps) {
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
          student_id:  userId,
          training_id: dayTraining.training.id,
          plan_id:     planId || null,
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

  return (
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

              <form onSubmit={handleSubmit} className={styles.form}>
                {/* Distância */}
                <div className={styles.field}>
                  <label className={styles.label}>Distância (km)</label>
                  <div className={styles.numericInput}>
                    <button type="button" className={styles.numBtn} onClick={() => adjustDistance(-0.5)}>−</button>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={styles.inputField}
                      value={distance}
                      onChange={e => setDistance(e.target.value)}
                      placeholder="0,0"
                    />
                    <button type="button" className={styles.numBtn} onClick={() => adjustDistance(0.5)}>+</button>
                  </div>
                </div>

                {/* Tempo */}
                <div className={styles.field}>
                  <label className={styles.label}>Tempo (min)</label>
                  <div className={styles.numericInput}>
                    <button type="button" className={styles.numBtn} onClick={() => adjustMinutes(-5)}>−</button>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={styles.inputField}
                      value={minutes}
                      onChange={e => setMinutes(e.target.value)}
                      placeholder="0"
                    />
                    <button type="button" className={styles.numBtn} onClick={() => adjustMinutes(5)}>+</button>
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
    </AnimatePresence>
  )
}
