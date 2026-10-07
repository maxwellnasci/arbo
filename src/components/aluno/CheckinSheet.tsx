import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Checkin } from '../../lib/types'
import type { DayTraining } from '../../hooks/useWeeklyPlan'
import { useStravaActivitiesLocal, type StravaActivityLocal } from '../../hooks/useStravaActivitiesLocal'
import { useTrainingBlocks } from '../../hooks/useTrainingBlocks'
import {
  blockTitle,
  describeBlockTarget,
  formatSeconds,
  hasBlocksModality,
  parseTimeInput,
} from '../../lib/modalities'
import { toast } from 'sonner'
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

// Resultado de um bloco (Hyrox/CrossFit) como texto do formulário.
type BlockResultDraft = { time: string; reps: string; load: string }

function parsePositive(value: string): number | null {
  const n = Number(value.replace(',', '.'))
  return value.trim() && Number.isFinite(n) && n >= 0 ? n : null
}

export default function CheckinSheet({ dayTraining, planId, userId, scheduleId, existingCheckin, usedStravaActivityIds, onClose, onSuccess }: CheckinSheetProps) {
  const modality = dayTraining.training.modality
  const usesBlocks = hasBlocksModality(modality)
  const { blocks } = useTrainingBlocks(dayTraining.training.id, usesBlocks)
  const [blockResults, setBlockResults] = useState<Record<string, BlockResultDraft>>({})

  // Editando um check-in: carrega os resultados por bloco já registrados.
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!usesBlocks || !existingCheckin) return
      const { data, error } = await supabase
        .from('checkin_block_results')
        .select('training_block_id, actual_duration_seconds, actual_reps, actual_load_kg')
        .eq('checkin_id', existingCheckin.id)
      if (cancelled || error || !data) return
      const next: Record<string, BlockResultDraft> = {}
      for (const r of data) {
        next[r.training_block_id] = {
          time: formatSeconds(r.actual_duration_seconds),
          reps: r.actual_reps != null ? String(r.actual_reps) : '',
          load: r.actual_load_kg != null ? String(r.actual_load_kg).replace('.', ',') : '',
        }
      }
      setBlockResults(next)
    }
    load()
    return () => { cancelled = true }
  }, [usesBlocks, existingCheckin])

  function updateBlockResult(blockId: string, patch: Partial<BlockResultDraft>) {
    setBlockResults(prev => ({
      ...prev,
      [blockId]: { ...(prev[blockId] ?? { time: '', reps: '', load: '' }), ...patch },
    }))
  }
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
    setError(null)

    // Resultados por bloco: valida tudo antes de gravar qualquer coisa.
    const resultRows = blocks.flatMap(block => {
      const draft = blockResults[block.id]
      if (!draft) return []
      const seconds = parseTimeInput(draft.time)
      const reps = parsePositive(draft.reps)
      const load = parsePositive(draft.load)
      if (seconds === null && reps === null && load === null) return []
      return [{ training_block_id: block.id, actual_duration_seconds: seconds, actual_reps: reps === null ? null : Math.round(reps), actual_load_kg: load }]
    })
    const invalidTime = blocks.some(block => {
      const time = blockResults[block.id]?.time ?? ''
      return time.trim() !== '' && parseTimeInput(time) === null
    })
    if (usesBlocks && invalidTime) {
      setError('Tempo inválido em algum bloco. Use m:ss (ex.: 4:30).')
      return
    }

    setSubmitting(true)

    const distM = distance.trim()
      ? Math.round(parseFloat(distance.trim().replace(',', '.')) * 1000)
      : null
    // Sem tempo total informado, usa a soma dos tempos por bloco.
    const blocksTotal = resultRows.reduce((sum, r) => sum + (r.actual_duration_seconds ?? 0), 0)
    const durSec = minutes ? Math.round(parseFloat(minutes) * 60) : (usesBlocks && blocksTotal > 0 ? blocksTotal : null)
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

    // Resultados por bloco (Hyrox/CrossFit) — depois do check-in existir.
    const checkinId = existingCheckin?.id ?? newCheckinId
    if (!checkinErr && checkinId && resultRows.length > 0) {
      const { error: resultsErr } = await supabase
        .from('checkin_block_results')
        .upsert(
          resultRows.map(r => ({ ...r, checkin_id: checkinId })),
          { onConflict: 'checkin_id,training_block_id' },
        )
      if (resultsErr) {
        console.error('Erro ao salvar resultados por bloco:', resultsErr.message)
        toast.error('Check-in salvo, mas os resultados por estação não foram salvos.')
      }
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
                {/* Distância (não se aplica ao CrossFit) */}
                {modality !== 'crossfit' && <div className={styles.field}>
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
                </div>}

                {/* Tempo */}
                <div className={styles.field}>
                  <label className={styles.label}>{usesBlocks ? 'Tempo total (min) — opcional' : 'Tempo (min)'}</label>
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

                {/* Resultados por bloco (Hyrox / CrossFit) */}
                {usesBlocks && blocks.length > 0 && (
                  <div className={styles.field}>
                    <label className={styles.label}>
                      {modality === 'hyrox' ? 'Tempo por estação — opcional' : 'Resultado por bloco — opcional'}
                    </label>
                    <div className={styles.blockResults}>
                      {blocks.map((block, index) => {
                        const draft = blockResults[block.id] ?? { time: '', reps: '', load: '' }
                        const metric = block.exercises?.metric
                        const showReps = metric === 'reps' || block.reps != null
                        const showLoad = metric === 'load' || block.load_kg != null
                        const target = describeBlockTarget(block)
                        return (
                          <div key={block.id} className={styles.blockResultRow}>
                            <div className={styles.blockResultInfo}>
                              <span className={styles.blockResultName}>{index + 1}. {blockTitle(block, block.exercises?.name)}</span>
                              {target && <span className={styles.blockResultTarget}>{target}</span>}
                            </div>
                            <div className={styles.blockResultInputs}>
                              <input
                                className={styles.blockResultInput}
                                inputMode="numeric"
                                placeholder="m:ss"
                                aria-label={`Tempo do bloco ${index + 1}`}
                                value={draft.time}
                                onChange={e => updateBlockResult(block.id, { time: e.target.value })}
                              />
                              {showReps && (
                                <input
                                  className={styles.blockResultInput}
                                  inputMode="numeric"
                                  placeholder="reps"
                                  aria-label={`Repetições do bloco ${index + 1}`}
                                  value={draft.reps}
                                  onChange={e => updateBlockResult(block.id, { reps: e.target.value })}
                                />
                              )}
                              {showLoad && (
                                <input
                                  className={styles.blockResultInput}
                                  inputMode="decimal"
                                  placeholder="kg"
                                  aria-label={`Carga do bloco ${index + 1}`}
                                  value={draft.load}
                                  onChange={e => updateBlockResult(block.id, { load: e.target.value })}
                                />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

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
