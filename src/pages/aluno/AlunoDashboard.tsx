import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '../../contexts/AuthContext'
import { useWeeklyPlan, type DayTraining } from '../../hooks/useWeeklyPlan'
import { useProgresso } from '../../hooks/useProgresso'
import { useScheduling } from '../../hooks/useScheduling'
import { supabase } from '../../lib/supabase'
import type { TrainingType } from '../../lib/types'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Home, TrendingUp, MessageSquare, User, Calendar, CheckCircle2, Medal, Flame, Eye, Lock } from 'lucide-react'
import LockedScreen from '../../components/aluno/LockedScreen'
import FlexibleTrainingCard from '../../components/aluno/FlexibleTrainingCard'
import { VideoPlayer } from '../../components/ui/VideoPlayer'
import type { DayOfWeek } from '../../components/aluno/DayPicker'
import styles from './AlunoDashboard.module.css'

// Abas carregadas sob demanda — evita baixar recharts (AlunoProgresso) e o resto
// no primeiro load de quem nunca sai da aba Início
const AlunoChat = lazy(() => import('./AlunoChat'))
const AlunoProgresso = lazy(() => import('./AlunoProgresso'))
const AlunoPerfil = lazy(() => import('./AlunoPerfil'))
const CheckinSheet = lazy(() => import('../../components/aluno/CheckinSheet'))

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



// ── Formatters ────────────────────────────────────────────────────────────────

function formatDistance(meters: number | null): string | null {
  if (meters == null) return null
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}



function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null
  return `${Math.floor(seconds / 60)} min`
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
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonGrid} />
      </div>
      <BottomNav activeTab="inicio" onTabChange={() => {}} />
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <Calendar size={32} className={styles.emptyIcon} />
      <p className={styles.emptyTitle}>Nenhum treino programado</p>
      <p className={styles.emptySubtext}>Fale com seu professor para montar sua semana</p>
    </div>
  )
}

// ── Bottom Navigation ─────────────────────────────────────────────────────────

type NavTab = 'inicio' | 'progresso' | 'chat' | 'perfil' | 'calendario'

function BottomNav({ activeTab, onTabChange }: { activeTab: NavTab; onTabChange: (tab: NavTab) => void }) {
  const tabs = [
    { id: 'inicio' as NavTab,    icon: Home,          label: 'Início' },
    { id: 'progresso' as NavTab, icon: TrendingUp,    label: 'Progresso' },
    { id: 'chat' as NavTab,      icon: MessageSquare, label: 'Chat' },
    { id: 'perfil' as NavTab,    icon: User,          label: 'Perfil' },
    { id: 'calendario' as NavTab,icon: Calendar,      label: 'Calendário' },
  ]
  return (
    <nav className={styles.bottomNav}>
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            className={`${styles.navItem}${isActive ? ` ${styles.navItemActive}` : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon size={22} className={styles.navIcon} />
            <span className={styles.navDot} />
          </button>
        )
      })}
    </nav>
  )
}

// ── Training Card ─────────────────────────────────────────────────────────────

type TrainingCardProps = {
  dayTraining: DayTraining
  planId: string | null
  userId: string
  isToday: boolean
  usedStravaActivityIds: Set<number>
  onCheckinSuccess: () => void
}

function TrainingCard({ dayTraining, planId, userId, isToday, usedStravaActivityIds, onCheckinSuccess }: TrainingCardProps) {
  const [showSheet, setShowSheet] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { training, checkin, dayOfWeek } = dayTraining

  async function handleDelete() {
    if (!checkin) return
    setDeleting(true)
    const { error } = await supabase.from('checkins').delete().eq('id', checkin.id)
    setDeleting(false)
    if (error) {
      toast.error('Erro ao remover check-in: ' + error.message)
      return
    }
    setDeleteConfirm(false)
    onCheckinSuccess()
  }

  function openNew()  { setEditMode(false); setShowSheet(true) }
  function openEdit() { setEditMode(true);  setShowSheet(true) }

  const isFuture = dayOfWeek !== null && !isToday && !checkin && dayOfWeek > new Date().getDay()

  const cardStateClass = checkin 
    ? styles.cardDone 
    : isToday 
      ? styles.cardToday 
      : isFuture 
        ? styles.cardFuture 
        : styles.cardPast

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{ scale: 1.01 }}
    >
      <div className={`${styles.card} ${cardStateClass}`}>
        <div className={styles.cardHeader}>
          <span className={styles.dayName}>{dayOfWeek !== null ? (DAY_NAMES[dayOfWeek] ?? `Dia ${dayOfWeek}`) : '—'}</span>
          {checkin && <CheckCircle2 size={16} className={styles.checkIcon} />}
        </div>

        <h3 className={styles.trainingTitle}>{training.title}</h3>
        <span className={`${styles.typeBadge} ${TYPE_CLASS[training.type] ?? styles.typeDefault}`}>
          {training.type}
        </span>

        <div className={styles.metrics}>
          {checkin ? (
            <>
              {checkin.actual_distance_m != null && (
                <div className={styles.metric}>
                  <span className={styles.metricIcon}><IconRoad /></span>
                  <span className={styles.metricValue}>{formatDistance(checkin.actual_distance_m)}</span>
                </div>
              )}
              {checkin.actual_duration_seconds != null && (
                <div className={styles.metric}>
                  <span className={styles.metricIcon}><IconClock /></span>
                  <span className={styles.metricValue}>{formatDuration(checkin.actual_duration_seconds)}</span>
                </div>
              )}
            </>
          ) : (
            <>
              {training.distance_m != null && (
                <div className={styles.metric}>
                  <span className={styles.metricIcon}><IconRoad /></span>
                  <span className={styles.metricValue}>{formatDistance(training.distance_m)}</span>
                </div>
              )}
              {training.duration_minutes != null && (
                <div className={styles.metric}>
                  <span className={styles.metricIcon}><IconClock /></span>
                  <span className={styles.metricValue}>{training.duration_minutes} min</span>
                </div>
              )}
            </>
          )}
        </div>

        {training.video_url && <VideoPlayer videoUrl={training.video_url} />}

        {checkin ? (
          <div className={styles.doneRow}>
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
        <Suspense fallback={null}>
          <CheckinSheet
            dayTraining={dayTraining}
            planId={planId}
            userId={userId}
            existingCheckin={editMode ? checkin : null}
            usedStravaActivityIds={usedStravaActivityIds}
            onClose={() => setShowSheet(false)}
            onSuccess={onCheckinSuccess}
          />
        </Suspense>
      )}
    </motion.div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function AlunoDashboard({ previewStudentId }: { previewStudentId?: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const effectiveUserId = previewStudentId || user?.id
  const isPreview = !!previewStudentId

  const [selectedWeek, setSelectedWeek] = useState<number | undefined>(undefined)

  const {
    profile,
    plan,
    groupMode,
    trainings,
    isLocked,
    lockedWeekNumber,
    lastWeekSummary,
    isLoading,
    error,
    refresh,
    currentWeekNumber,
    releasedThroughWeek,
    targetWeekNumber,
  } = useWeeklyPlan(effectiveUserId, selectedWeek)
  
  const { streak, recentCheckins, records, isLoading: isProgressoLoading } = useProgresso(effectiveUserId ?? '')

  const activeWeek = targetWeekNumber || currentWeekNumber || 1

  const gptIds = trainings.map(t => t.weeklyPlanTrainingId)
  const { scheduleTraining, rescheduleTraining } = useScheduling(gptIds)

  // Atividades Strava já vinculadas a algum check-in da semana — usado só para
  // sinalizar "já usada" na lista de importação, não bloqueia a escolha.
  const usedStravaActivityIds = useMemo(
    () => new Set(
      trainings
        .map(t => t.checkin?.strava_activity_id)
        .filter((id): id is number => id != null)
    ),
    [trainings]
  )

  const [activeTab, setActiveTab] = useState<NavTab>('inicio')
  const [activeCheckin, setActiveCheckin] = useState<DayTraining | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    async function syncStravaRedirect() {
      if (searchParams.get('strava') !== 'success') return
      setActiveTab('perfil')
      toast.success('Strava conectado com sucesso!')
      setSearchParams({}, { replace: true })
    }
    syncStravaRedirect()
  }, [searchParams, setSearchParams])

  const jsDow       = new Date().getDay()
  const todayDow    = jsDow === 0 ? 7 : jsDow // getDay() retorna 0 para domingo; day_of_week usa 1=Seg..7=Dom
  const completed   = trainings.filter(t => t.checkin !== null).length
  const total       = trainings.length

  async function handleScheduleUpdate(gptId: string, newDay: DayOfWeek) {
    const dt = trainings.find(t => t.weeklyPlanTrainingId === gptId)
    if (!effectiveUserId) return
    if (dt?.scheduleId) {
      const result = await rescheduleTraining(dt.scheduleId, newDay)
      if (!result) { toast.error('Erro ao reagendar treino. Tente novamente.'); return }
    } else {
      const result = await scheduleTraining(effectiveUserId, gptId, newDay)
      if (!result) { toast.error('Erro ao agendar treino. Tente novamente.'); return }
    }
    refresh()
  }

  function handleTabChange(tab: NavTab) {
    setActiveTab(tab)
  }

  if (isLoading || isProgressoLoading) return <SkeletonLoader />

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

  if (!effectiveUserId) return null

  const name = profile?.full_name || (isPreview ? 'Aluno Demo' : user?.email?.split('@')[0]) || 'Atleta'
  const sorted = [...trainings].sort((a, b) => (a.dayOfWeek ?? 99) - (b.dayOfWeek ?? 99))

  const numRecords = Object.values(records).filter(Boolean).length

  return (
    <div className={styles.page}>
      {isPreview && (
        <button
          onClick={() => navigate('/admin')}
          title="Voltar ao Admin"
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 9999,
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: '2px solid var(--orange)',
            background: 'var(--bg-surface)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: 'var(--orange)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <Eye size={20} />
        </button>
      )}
      {activeTab === 'chat' ? (
        <div className={styles.contentWrapper}>
          <Suspense fallback={<SkeletonLoader />}>
            <AlunoChat studentId={effectiveUserId} />
          </Suspense>
        </div>
      ) : activeTab === 'progresso' ? (
        <Suspense fallback={<SkeletonLoader />}>
          <AlunoProgresso studentId={effectiveUserId} />
        </Suspense>
      ) : activeTab === 'perfil' ? (
        <Suspense fallback={<SkeletonLoader />}>
          <AlunoPerfil studentId={effectiveUserId} isPreview={isPreview} />
        </Suspense>
      ) : activeTab === 'calendario' ? (
        <main className={styles.container}>
          <div className={styles.emptyState}>
            <Calendar size={32} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Calendário Completo</p>
            <p className={styles.emptySubtext}>Em breve você poderá ver todos os ciclos aqui.</p>
          </div>
        </main>
      ) : (
        <main className={styles.container}>

          <header className={styles.hero}>
            <div className={styles.heroOrbs}>
              <div className={styles.orb1} />
              <div className={styles.orb2} />
            </div>
            
            <svg width="140" height="200" viewBox="0 0 140 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.heroSvg}>
              <ellipse cx="95" cy="22" rx="14" ry="14" fill="var(--orange)"/>
              <line x1="95" y1="36" x2="88" y2="85" stroke="var(--orange)" strokeWidth="8" strokeLinecap="round"/>
              <line x1="92" y1="55" x2="60" y2="72" stroke="var(--orange)" strokeWidth="6" strokeLinecap="round"/>
              <line x1="92" y1="55" x2="115" y2="70" stroke="var(--orange)" strokeWidth="6" strokeLinecap="round"/>
              <line x1="88" y1="85" x2="65" y2="130" stroke="var(--orange)" strokeWidth="7" strokeLinecap="round"/>
              <line x1="65" y1="130" x2="45" y2="165" stroke="var(--orange)" strokeWidth="6" strokeLinecap="round"/>
              <line x1="88" y1="85" x2="108" y2="125" stroke="var(--orange)" strokeWidth="7" strokeLinecap="round"/>
              <line x1="108" y1="125" x2="120" y2="155" stroke="var(--orange)" strokeWidth="6" strokeLinecap="round"/>
            </svg>

            <div className={styles.heroOverlay} />
            
            <div className={styles.heroContent}>
              <p className={styles.heroEyebrow}>MEU TREINO</p>
              <h1 className={styles.heroTitle}>
                Bom treino,<br/>
                <em>{name}.</em>
              </h1>
              <p className={styles.heroSubtitle}>
                Semana {lockedWeekNumber || 1} de 4 · {total} treinos esta semana
              </p>
            </div>
          </header>

          <div className={styles.metricsGrid}>
            <motion.div className={styles.metricCardNext} whileHover={{ scale: 1.02 }}>
              <Calendar size={16} className={styles.mcIconOrange} />
              <span className={styles.mcNumberOrange}>{total - completed}</span>
              <span className={styles.mcLabel}>Próximos</span>
            </motion.div>
            
            <motion.div className={styles.metricCardStreak} whileHover={{ scale: 1.02 }}>
              <Flame size={16} className={styles.mcIconGreen} />
              <span className={styles.mcNumberGreen}>{streak}</span>
              <span className={styles.mcLabel}>Streak</span>
            </motion.div>
            
            <motion.div className={styles.metricCardDefault} whileHover={{ scale: 1.02 }}>
              <Medal size={16} className={styles.mcIconDefault} />
              <span className={styles.mcNumberDefault}>{numRecords}</span>
              <span className={styles.mcLabel}>PRs Pessoais</span>
            </motion.div>
            
            <motion.div className={styles.metricCardDefault} whileHover={{ scale: 1.02 }}>
              <CheckCircle2 size={16} className={styles.mcIconDefault} />
              <span className={styles.mcNumberDefault}>{recentCheckins.length}</span>
              <span className={styles.mcLabel}>Check-ins</span>
            </motion.div>
          </div>

          {isLocked ? (
            <LockedScreen
              lockedWeekNumber={lockedWeekNumber}
              lastWeekSummary={lastWeekSummary}
              activeWeek={activeWeek}
              releasedThroughWeek={releasedThroughWeek ?? 0}
              onSelectWeek={(week) => setSelectedWeek(week)}
            />
          ) : (
            <>
              {profile?.group_id && (
                <div className={styles.weekSelector}>
                  {[1, 2, 3, 4].map(n => {
                    const isReleased = n <= (releasedThroughWeek ?? 0)
                    const isSelected = n === activeWeek
                    return (
                      <button
                        key={n}
                        onClick={() => {
                          if (isReleased) {
                            setSelectedWeek(n)
                          } else {
                            toast.error(`Semana ${n} ainda não foi liberada pelo professor.`)
                          }
                        }}
                        className={`${styles.weekChip} ${
                          isSelected ? styles.weekChipSelected : 
                          isReleased ? styles.weekChipReleased : 
                          styles.weekChipLocked
                        }`}
                      >
                        <span>Semana {n}</span>
                        {!isReleased && <Lock size={12} className={styles.weekChipLockIcon} />}
                      </button>
                    )
                  })}
                </div>
              )}

              {trainings.length === 0 ? (
                <EmptyState />
              ) : groupMode === 'flexivel' ? (
                <div className={styles.trainingList}>
                  {sorted.map((dt, i) => (
                    <motion.div
                      key={dt.weeklyPlanTrainingId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.3 }}
                    >
                      <FlexibleTrainingCard
                        dayTraining={dt}
                        onScheduleUpdate={handleScheduleUpdate}
                        onCheckinClick={setActiveCheckin}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className={styles.trainingList}>
                  {sorted.map((dt, i) => (
                    <motion.div
                      key={dt.weeklyPlanTrainingId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.3 }}
                    >
                      <TrainingCard
                        dayTraining={dt}
                        planId={plan?.id ?? null}
                        userId={effectiveUserId}
                        isToday={dt.dayOfWeek !== null && dt.dayOfWeek === todayDow}
                        usedStravaActivityIds={usedStravaActivityIds}
                        onCheckinSuccess={refresh}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeCheckin && (
            <Suspense fallback={null}>
              <CheckinSheet
                dayTraining={activeCheckin}
                planId={plan?.id ?? null}
                scheduleId={activeCheckin.scheduleId}
                userId={effectiveUserId}
                existingCheckin={activeCheckin.checkin}
                usedStravaActivityIds={usedStravaActivityIds}
                onClose={() => setActiveCheckin(null)}
                onSuccess={() => { setActiveCheckin(null); refresh() }}
              />
            </Suspense>
          )}
        </main>
      )}

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}
