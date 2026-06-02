import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLogout } from '../../hooks/useLogout'
import { useWeeklyPlan, type DayTraining, type LastWeekSummary } from '../../hooks/useWeeklyPlan'
import { supabase } from '../../lib/supabase'
import type { Checkin, TrainingType, UserLevel } from '../../lib/types'
import AlunoChat from './AlunoChat'
import AlunoProgresso from './AlunoProgresso'
import styles from './AlunoDashboard.module.css'

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES: Record<number, string> = {
  0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta',
  4: 'Quinta',  5: 'Sexta',  6: 'Sábado',
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

const EFFORT_EMOJIS: Record<number, string> = {
  1: '😴', 2: '🙂', 3: '💪', 4: '🔥', 5: '💀',
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDistance(meters: number | null): string | null {
  if (meters == null) return null
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

function formatPace(secondsPerKm: number | null): string | null {
  if (secondsPerKm == null) return null
  const min = Math.floor(secondsPerKm / 60)
  const sec = String(secondsPerKm % 60).padStart(2, '0')
  return `${min}:${sec}/km`
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null
  return `${Math.floor(seconds / 60)} min`
}

function getGreeting(name: string | null | undefined, email: string | undefined) {
  const hour = new Date().getHours()
  const period = hour >= 5 && hour < 12 ? 'Bom dia'
    : hour >= 12 && hour < 18 ? 'Boa tarde'
    : 'Boa noite'
  return { period, name: name ?? email?.split('@')[0] ?? 'atleta' }
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function IconRoad() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l4-10 5 8 4-8 5 10" />
    </svg>
  )
}

function IconTimer() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  )
}

// ── Skeleton Loader ───────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.skeletonHeader}>
          <div>
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonBadge} />
          </div>
        </div>
        <div className={styles.skeletonProgressArea}>
          <div className={styles.skeletonProgressLabel} />
          <div className={styles.skeletonProgressBar} />
        </div>
        <div className={styles.skeletonCardLarge} />
        <div className={styles.skeletonCardSmall} />
        <div className={styles.skeletonCardSmall} />
      </div>
      <BottomNav activeTab="inicio" onTabChange={() => {}} />
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <svg className={styles.emptyIcon} viewBox="0 0 96 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 52C10 52 16 36 26 34L50 34L68 39C74 40.5 80 44 83 49L86 52C86 52 88 55 88 58L14 58C11.5 58 10 56 10 52Z" fill="#ffffff"/>
        <path d="M26 34L28 20C28 18 31 15 34 15L44 15C47 15 49 18 49 20L50 34Z" fill="#d0d0d0"/>
        <path d="M30 22L48 22M31 28L46 28" stroke="#aaaaaa" strokeWidth="2" strokeLinecap="round"/>
        <rect x="8" y="56" width="80" height="8" rx="4" fill="#cccccc"/>
      </svg>
      <p className={styles.emptyTitle}>Nenhum treino programado</p>
      <p className={styles.emptySubtext}>Fale com seu professor para montar sua semana</p>
    </div>
  )
}

// ── Locked Screen ─────────────────────────────────────────────────────────────

function LockedScreen({ lockedWeekNumber, lastWeekSummary }: {
  lockedWeekNumber: number
  lastWeekSummary: LastWeekSummary | null
}) {
  return (
    <div className={styles.trainingList}>
      {/* Semana 2+: resumo da semana anterior (só se tiver check-ins) */}
      {lastWeekSummary !== null && lastWeekSummary.checkinCount > 0 && (
        <div className={styles.lockedLastWeek}>
          <div className={styles.lockedLastWeekTitle}>
            Semana {lockedWeekNumber - 1} concluída ✓
          </div>
          <div className={styles.lockedMetrics}>
            <div className={styles.lockedMetric}>
              <span className={styles.lockedMetricValue}>{lastWeekSummary.checkinCount}</span>
              <span className={styles.lockedMetricLabel}>treinos</span>
            </div>
            <div className={styles.lockedMetric}>
              <span className={styles.lockedMetricValue}>{(lastWeekSummary.totalDistanceM / 1000).toFixed(0)}</span>
              <span className={styles.lockedMetricLabel}>km</span>
            </div>
            {lastWeekSummary.avgPaceSecondsPerKm !== null && (
              <div className={styles.lockedMetric}>
                <span className={styles.lockedMetricValue}>{formatPace(lastWeekSummary.avgPaceSecondsPerKm)}</span>
                <span className={styles.lockedMetricLabel}>pace médio</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Semana 1 bloqueada — boas-vindas */}
      {lastWeekSummary === null && (
        <div className={styles.lockedWelcome}>
          <div className={styles.lockedWelcomeIcon}>🏃</div>
          <p className={styles.lockedWelcomeTitle}>Pronto para correr?</p>
          <p className={styles.lockedWelcomeText}>
            Seu professor está preparando o plano da primeira semana.
          </p>
        </div>
      )}

      {/* Card "a caminho" */}
      <div className={styles.lockedComing}>
        <span className={styles.lockedComingIcon}>⏳</span>
        <div>
          <p className={styles.lockedComingTitle}>Semana {lockedWeekNumber} a caminho</p>
          <p className={styles.lockedComingText}>Seu professor está preparando os treinos. Em breve! 💪</p>
        </div>
      </div>

      {/* Barra de progresso do ciclo S1–S4 */}
      <div className={styles.lockedCycle}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} className={styles.lockedCycleItem}>
            <div className={`${styles.lockedCycleBar} ${
              n < lockedWeekNumber ? styles.lockedCycleBarDone :
              n === lockedWeekNumber ? styles.lockedCycleBarCurrent :
              styles.lockedCycleBarFuture
            }`} />
            <span className={`${styles.lockedCycleLabel} ${
              n < lockedWeekNumber ? styles.lockedCycleLabelDone :
              n === lockedWeekNumber ? styles.lockedCycleLabelCurrent :
              styles.lockedCycleLabelFuture
            }`}>S{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bottom Navigation ─────────────────────────────────────────────────────────

type NavTab = 'inicio' | 'progresso' | 'chat' | 'perfil'

function BottomNav({ activeTab, onTabChange }: { activeTab: NavTab; onTabChange: (tab: NavTab) => void }) {
  const tabs: { id: NavTab; icon: string; label: string }[] = [
    { id: 'inicio',    icon: '🏠', label: 'Início' },
    { id: 'progresso', icon: '📊', label: 'Progresso' },
    { id: 'chat',      icon: '💬', label: 'Chat' },
    { id: 'perfil',    icon: '👤', label: 'Perfil' },
  ]
  return (
    <nav className={styles.bottomNav}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`${styles.navItem}${activeTab === tab.id ? ` ${styles.navItemActive}` : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className={styles.navIcon}>{tab.icon}</span>
          <span className={styles.navLabel}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

// ── Profile Menu ──────────────────────────────────────────────────────────────

type ProfileMenuProps = {
  name: string | null | undefined
  level: UserLevel | null | undefined
  onClose: () => void
  onLogout: () => void
}

function ProfileMenu({ name, level, onClose, onLogout }: ProfileMenuProps) {
  return (
    <>
      <div className={styles.profileMenuOverlay} onClick={onClose} />
      <div className={styles.profileMenu}>
        {name && (
          <>
            <div className={styles.profileMenuInfo}>
              <p className={styles.profileMenuName}>{name}</p>
              {level && <p className={styles.profileMenuLevel}>{LEVEL_LABEL[level] ?? level}</p>}
            </div>
            <div className={styles.profileMenuDivider} />
          </>
        )}
        <button
          className={`${styles.profileMenuItem} ${styles.profileMenuLogout}`}
          onClick={onLogout}
        >
          Sair da conta
        </button>
      </div>
    </>
  )
}

// ── Checkin Bottom Sheet ──────────────────────────────────────────────────────

type CheckinSheetProps = {
  dayTraining: DayTraining
  planId: string
  userId: string
  existingCheckin?: Checkin | null
  onClose: () => void
  onSuccess: () => void
}

function CheckinSheet({ dayTraining, planId, userId, existingCheckin, onClose, onSuccess }: CheckinSheetProps) {
  const [visible, setVisible] = useState(false)
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

  useEffect(() => {
    // two rAFs to ensure the element is in DOM before the CSS transition fires
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 420)
  }

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

    const { error: err } = existingCheckin
      ? await supabase.from('checkins').update(payload).eq('id', existingCheckin.id)
      : await supabase.from('checkins').insert({
          student_id:  userId,
          training_id: dayTraining.training.id,
          plan_id:     planId,
          ...payload,
        })

    setSubmitting(false)
    if (err) { setError(err.message); return }

    setShowSuccess(true)
    setTimeout(() => {
      setVisible(false)
      setTimeout(() => { onSuccess(); onClose() }, 420)
    }, 1500)
  }

  return (
    <div
      className={`${styles.sheetOverlay}${visible ? ` ${styles.sheetOverlayVisible}` : ''}`}
      onClick={handleClose}
    >
      <div
        className={`${styles.sheet}${visible ? ` ${styles.sheetVisible}` : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.sheetHandle} />

        {showSuccess ? (
          <div className={styles.successState}>
            <div className={styles.successIcon}>✓</div>
            <p className={styles.successText}>Treino registrado!</p>
          </div>
        ) : (
          <>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>
                {existingCheckin ? 'Editar check-in' : 'Check-in'}
              </h2>
              <button className={styles.sheetCloseBtn} onClick={handleClose} aria-label="Fechar">
                ×
              </button>
            </div>
            <p className={styles.sheetSubtitle}>{dayTraining.training.title}</p>

            <form onSubmit={handleSubmit} className={styles.sheetForm}>
              {/* Distância */}
              <div className={styles.sheetField}>
                <label className={styles.sheetLabel}>Distância (km)</label>
                <div className={styles.numericInput}>
                  <button type="button" className={styles.numBtn} onClick={() => adjustDistance(-0.5)}>−</button>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.numericInputField}
                    value={distance}
                    onChange={e => setDistance(e.target.value)}
                    placeholder="0,0"
                  />
                  <button type="button" className={styles.numBtn} onClick={() => adjustDistance(0.5)}>+</button>
                </div>
              </div>

              {/* Tempo */}
              <div className={styles.sheetField}>
                <label className={styles.sheetLabel}>Tempo (min)</label>
                <div className={styles.numericInput}>
                  <button type="button" className={styles.numBtn} onClick={() => adjustMinutes(-5)}>−</button>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.numericInputField}
                    value={minutes}
                    onChange={e => setMinutes(e.target.value)}
                    placeholder="0"
                  />
                  <button type="button" className={styles.numBtn} onClick={() => adjustMinutes(5)}>+</button>
                </div>
              </div>

              {/* Percepção de esforço */}
              <div className={styles.sheetField}>
                <label className={styles.sheetLabel}>Percepção de esforço — opcional</label>
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
              <div className={styles.sheetField}>
                <label className={styles.sheetLabel}>Observações — opcional</label>
                <textarea
                  className={styles.sheetTextarea}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Como foi o treino?"
                  rows={2}
                />
              </div>

              {error && <p className={styles.sheetError}>{error}</p>}

              <button type="submit" className={styles.sheetSubmitBtn} disabled={submitting}>
                {submitting ? 'Salvando...' : existingCheckin ? 'Salvar alterações' : 'Registrar treino'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ── Training Card ─────────────────────────────────────────────────────────────

type TrainingCardProps = {
  dayTraining: DayTraining
  planId: string
  userId: string
  isToday: boolean
  onCheckinSuccess: () => void
}

function TrainingCard({ dayTraining, planId, userId, isToday, onCheckinSuccess }: TrainingCardProps) {
  const [showSheet, setShowSheet] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { training, checkin, dayOfWeek } = dayTraining

  async function handleDelete() {
    if (!checkin) return
    setDeleting(true)
    await supabase.from('checkins').delete().eq('id', checkin.id)
    setDeleting(false)
    setDeleteConfirm(false)
    onCheckinSuccess()
  }

  function openNew()  { setEditMode(false); setShowSheet(true) }
  function openEdit() { setEditMode(true);  setShowSheet(true) }

  const titleClass  = `${styles.trainingTitle}${isToday ? ` ${styles.trainingTitleLarge}` : ''}`
  const valueClass  = `${styles.metricValue}${isToday  ? ` ${styles.metricValueLarge}` : ''}`

  return (
    <>
      <div className={`${styles.card}${isToday ? ` ${styles.cardToday}` : ''}${checkin ? ` ${styles.cardDone}` : ''}`}>
        {isToday && <span className={styles.todayBadge}>HOJE</span>}

        <div className={styles.cardHeader}>
          <span className={styles.dayName}>{DAY_NAMES[dayOfWeek] ?? `Dia ${dayOfWeek}`}</span>
          <span className={`${styles.typeBadge} ${TYPE_CLASS[training.type] ?? styles.typeDefault}`}>
            {training.type}
          </span>
        </div>

        <h3 className={titleClass}>{training.title}</h3>

        {/* Métricas: dados reais se concluído, template caso contrário */}
        <div className={styles.metrics}>
          {checkin ? (
            <>
              {checkin.actual_distance_m != null && (
                <div className={styles.metric}>
                  <span className={styles.metricIcon}><IconRoad /></span>
                  <span className={valueClass}>{formatDistance(checkin.actual_distance_m)}</span>
                  <span className={styles.metricLabel}>percorrido</span>
                </div>
              )}
              {checkin.actual_duration_seconds != null && (
                <div className={styles.metric}>
                  <span className={styles.metricIcon}><IconClock /></span>
                  <span className={valueClass}>{formatDuration(checkin.actual_duration_seconds)}</span>
                  <span className={styles.metricLabel}>tempo</span>
                </div>
              )}
              {checkin.actual_pace_seconds_per_km != null && (
                <div className={styles.metric}>
                  <span className={styles.metricIcon}><IconTimer /></span>
                  <span className={valueClass}>{formatPace(checkin.actual_pace_seconds_per_km)}</span>
                  <span className={styles.metricLabel}>pace real</span>
                </div>
              )}
            </>
          ) : (
            <>
              {training.distance_m != null && (
                <div className={styles.metric}>
                  <span className={styles.metricIcon}><IconRoad /></span>
                  <span className={valueClass}>{formatDistance(training.distance_m)}</span>
                  <span className={styles.metricLabel}>distância</span>
                </div>
              )}
              {training.target_pace_seconds_per_km != null && (
                <div className={styles.metric}>
                  <span className={styles.metricIcon}><IconTimer /></span>
                  <span className={valueClass}>{formatPace(training.target_pace_seconds_per_km)}</span>
                  <span className={styles.metricLabel}>pace alvo</span>
                </div>
              )}
              {training.duration_minutes != null && (
                <div className={styles.metric}>
                  <span className={styles.metricIcon}><IconClock /></span>
                  <span className={valueClass}>{training.duration_minutes} min</span>
                  <span className={styles.metricLabel}>duração</span>
                </div>
              )}
            </>
          )}
        </div>

        {checkin ? (
          <div className={styles.doneRow}>
            <div className={styles.doneBadge}>
              <span className={styles.doneCheck}>✓</span>
              Concluído
              {checkin.perceived_effort != null && (
                <span className={styles.effortPill}>{EFFORT_EMOJIS[checkin.perceived_effort]}</span>
              )}
            </div>
            <div className={styles.doneActions}>
              <button className={styles.actionBtn} onClick={openEdit} aria-label="Editar check-in">
                <IconEdit />
              </button>
              <button className={styles.actionBtn} onClick={() => setDeleteConfirm(true)} aria-label="Excluir check-in">
                <IconTrash />
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.checkinBtn} onClick={openNew}>
            Fazer check-in
          </button>
        )}

        {deleteConfirm && (
          <div className={styles.deleteConfirm}>
            <p className={styles.deleteMsg}>Remover este check-in?</p>
            <div className={styles.deleteActions}>
              <button className={styles.deleteCancelBtn} onClick={() => setDeleteConfirm(false)}>
                Cancelar
              </button>
              <button className={styles.deleteConfirmBtn} onClick={handleDelete} disabled={deleting}>
                {deleting ? '...' : 'Remover'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showSheet && (
        <CheckinSheet
          dayTraining={dayTraining}
          planId={planId}
          userId={userId}
          existingCheckin={editMode ? checkin : null}
          onClose={() => setShowSheet(false)}
          onSuccess={onCheckinSuccess}
        />
      )}
    </>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function AlunoDashboard() {
  const { user } = useAuth()
  const logout = useLogout()
  const { profile, plan, trainings, isLocked, lockedWeekNumber, lastWeekSummary, isLoading, error, refresh } = useWeeklyPlan(user?.id)
  const [activeTab, setActiveTab] = useState<NavTab>('inicio')
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const todayDow    = new Date().getDay()
  const completed   = trainings.filter(t => t.checkin !== null).length
  const total       = trainings.length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  function handleTabChange(tab: NavTab) {
    if (tab === 'perfil') {
      setShowProfileMenu(prev => !prev)
    } else {
      setShowProfileMenu(false)
      setActiveTab(tab)
    }
  }

  if (isLoading) return <SkeletonLoader />

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.stateCard}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={refresh}>Tentar novamente</button>
          </div>
        </div>
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    )
  }

  if (!user) return null

  const { period, name } = getGreeting(profile?.full_name, user.email)
  const sorted = [...trainings].sort((a, b) => a.dayOfWeek - b.dayOfWeek)

  return (
    <div className={styles.page}>
      {activeTab === 'chat' ? (
        <AlunoChat studentId={user.id} />
      ) : activeTab === 'progresso' ? (
        <AlunoProgresso studentId={user.id} />
      ) : (
        <div className={styles.container}>

          {/* Header */}
        <header className={styles.header}>
          <p className={styles.greeting}>
            {period},{' '}
            <span className={styles.greetingName}>{name}</span>
          </p>
          {profile?.level && (
            <span className={`${styles.levelBadge} ${LEVEL_CLASS[profile.level] ?? styles.levelIniciante}`}>
              {LEVEL_LABEL[profile.level] ?? profile.level}
            </span>
          )}
        </header>

        {/* Progresso semanal */}
        {total > 0 && (
          <section className={styles.progressSection}>
            <div className={styles.progressHeader}>
              <p className={styles.progressLabel}>{completed} de {total} treinos esta semana</p>
              <span className={styles.progressPct}>{progressPct}%</span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill}${progressPct > 0 ? ` ${styles.progressFillActive}` : ''}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </section>
        )}

        {/* Treinos */}
        {isLocked ? (
          <LockedScreen
            lockedWeekNumber={lockedWeekNumber}
            lastWeekSummary={lastWeekSummary}
          />
        ) : !plan ? (
          <EmptyState />
        ) : (
          <div className={styles.trainingList}>
            {sorted.map(dt => (
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
        )}

      </div>
      )}

      {/* Profile menu */}
      {showProfileMenu && (
        <ProfileMenu
          name={profile?.full_name}
          level={profile?.level}
          onClose={() => setShowProfileMenu(false)}
          onLogout={logout}
        />
      )}

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}
