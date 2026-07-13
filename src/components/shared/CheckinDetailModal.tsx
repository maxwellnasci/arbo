import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Activity, HeartPulse, Gauge, Mountain, Flame, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { useStravaActivityRaw } from '../../hooks/useStravaActivityRaw'
import styles from './CheckinDetailModal.module.css'

// Forma mínima estrutural usada pelo modal — tanto CheckinWithTraining (admin,
// com Training completo em `trainings`) quanto CheckinData (aluno, com
// `trainings` mais enxuto) satisfazem este tipo sem cast.
export type CheckinDetailData = {
  id: string
  created_at: string | null
  actual_distance_m: number | null
  actual_duration_seconds: number | null
  actual_pace_seconds_per_km: number | null
  perceived_effort: number | null
  notes: string | null
  strava_activity_id: number | null
  professor_feedback: string | null
  professor_feedback_at: string | null
  trainings: { title: string; type: string } | null
}

const effortEmoji: Record<number, string> = { 1: '😴', 2: '😌', 3: '😊', 4: '😤', 5: '🥵' }
const typeLabel: Record<string, string> = {
  corrida: 'Corrida', hiit: 'HIIT', recovery: 'Recuperação',
  forca: 'Força', mobilidade: 'Mobilidade',
}

function formatPace(seconds: number | null): string {
  if (!seconds) return '—'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}/km`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function formatDistance(meters: number | null): string {
  if (!meters) return '—'
  return `${(meters / 1000).toFixed(1)} km`
}

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

type CheckinDetailModalProps = {
  checkin: CheckinDetailData
  onClose: () => void
  readOnly?: boolean
  onSaveFeedback?: (checkinId: string, feedback: string) => Promise<string>
}

export default function CheckinDetailModal({ checkin, onClose, readOnly = false, onSaveFeedback }: CheckinDetailModalProps) {
  const { raw: stravaRaw, isLoading: isStravaLoading } = useStravaActivityRaw(checkin.strava_activity_id ?? null)
  const [feedback, setFeedback] = useState(checkin.professor_feedback ?? '')
  const [savedAt, setSavedAt] = useState(checkin.professor_feedback_at ?? null)
  const [isSaving, setIsSaving] = useState(false)

  const tType = checkin.trainings?.type ? (typeLabel[checkin.trainings.type] ?? checkin.trainings.type) : 'Treino'

  async function handleSaveFeedback() {
    if (!onSaveFeedback) return
    setIsSaving(true)
    try {
      const feedbackAt = await onSaveFeedback(checkin.id, feedback)
      setSavedAt(feedbackAt)
      toast.success('Feedback salvo!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar feedback.')
    } finally {
      setIsSaving(false)
    }
  }

  const hasMovingGap = stravaRaw?.moving_time != null
    && stravaRaw?.elapsed_time != null
    && stravaRaw.elapsed_time - stravaRaw.moving_time > 30

  const hasStravaStats = stravaRaw && (
    stravaRaw.average_heartrate != null
    || stravaRaw.average_cadence != null
    || stravaRaw.total_elevation_gain != null
    || stravaRaw.suffer_score != null
    || hasMovingGap
  )

  const showFeedbackSection = !readOnly || !!checkin.professor_feedback

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

          <div className={styles.header}>
            <h2 className={styles.title}>
              🏃 {tType} {checkin.trainings?.title ? `— ${checkin.trainings.title}` : ''}
            </h2>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">×</button>
          </div>
          <p className={styles.subtitle}>
            {checkin.created_at ? format(new Date(checkin.created_at), "dd MMM yyyy", { locale: ptBR }) : '—'}
          </p>

          <div className={styles.metaRow}>
            {checkin.actual_distance_m != null && <span>{formatDistance(checkin.actual_distance_m)}</span>}
            {checkin.actual_pace_seconds_per_km != null && <span>Pace: {formatPace(checkin.actual_pace_seconds_per_km)}</span>}
            {checkin.actual_duration_seconds != null && <span>Duração: {formatDuration(checkin.actual_duration_seconds)}</span>}
            {checkin.perceived_effort != null && <span>Esforço: {effortEmoji[checkin.perceived_effort]} {checkin.perceived_effort}/5</span>}
          </div>

          {checkin.notes && <div className={styles.notes}>"{checkin.notes}"</div>}

          {checkin.strava_activity_id != null && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}><Activity size={14} /> Dados do Strava</h3>
              {isStravaLoading ? (
                <p className={styles.stravaEmpty}>Carregando dados do Strava...</p>
              ) : !hasStravaStats ? (
                <p className={styles.stravaEmpty}>Nenhum dado adicional disponível para esta atividade.</p>
              ) : (
                <div className={styles.statGrid}>
                  {stravaRaw?.average_heartrate != null && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}><HeartPulse size={12} /> FC média / máxima</span>
                      <span className={styles.statValue}>
                        {Math.round(stravaRaw.average_heartrate)}{stravaRaw.max_heartrate != null ? ` / ${stravaRaw.max_heartrate}` : ''} bpm
                      </span>
                    </div>
                  )}
                  {stravaRaw?.average_cadence != null && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}><Gauge size={12} /> Cadência média</span>
                      {/* Strava reporta average_cadence de corrida por perna (passadas de 1 pé/min) — x2 para passos totais/min, convenção usada pelo próprio app do Strava e por relógios GPS */}
                      <span className={styles.statValue}>{Math.round(stravaRaw.average_cadence * 2)} spm</span>
                    </div>
                  )}
                  {stravaRaw?.total_elevation_gain != null && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}><Mountain size={12} /> Ganho de elevação</span>
                      <span className={styles.statValue}>{Math.round(stravaRaw.total_elevation_gain)} m</span>
                    </div>
                  )}
                  {stravaRaw?.suffer_score != null && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}><Flame size={12} /> Esforço Relativo (Strava)</span>
                      <span className={styles.statValue}>{stravaRaw.suffer_score}</span>
                    </div>
                  )}
                  {hasMovingGap && stravaRaw?.moving_time != null && stravaRaw?.elapsed_time != null && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}><Timer size={12} /> Em movimento / total</span>
                      <span className={styles.statValue}>{formatClock(stravaRaw.moving_time)} / {formatClock(stravaRaw.elapsed_time)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showFeedbackSection && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Feedback do professor</h3>
              {readOnly ? (
                <div className={styles.feedbackReadOnly}>{checkin.professor_feedback}</div>
              ) : (
                <>
                  <textarea
                    className={styles.feedbackTextarea}
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Deixe um feedback sobre este treino..."
                    rows={3}
                  />
                  <div className={styles.feedbackFooter}>
                    <span className={styles.feedbackSavedAt}>
                      {savedAt ? `Enviado em ${format(new Date(savedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}` : ''}
                    </span>
                    <button className={styles.saveBtn} onClick={handleSaveFeedback} disabled={isSaving}>
                      {isSaving ? 'Salvando...' : 'Salvar feedback'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
