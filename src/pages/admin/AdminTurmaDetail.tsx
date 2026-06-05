import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAdminTurmaDetail, type GroupDayTraining } from '../../hooks/useAdminTurmaDetail'
import { useGroupPlanMutations, type NewTrainingInput } from '../../hooks/useGroupPlanMutations'
import { useAuth } from '../../contexts/AuthContext'
import type { Tag, Training, TrainingType } from '../../lib/types'
import { EditGroupModal } from '../../components/admin/EditGroupModal'
import { Edit2 } from 'lucide-react'

// ─── Labels ────────────────────────────────────────────────────────────────

const goalLabel: Record<string, string> = {
  '5k': '5K', '10k': '10K', '21k': '21K',
  evoluir_10k: 'Evolução 10K', evoluir_21k: 'Evolução 21K',
}
const frequencyLabel: Record<string, string> = { '2x': '2×/sem', '3x': '3×/sem' }
const typeLabel: Record<string, string> = {
  corrida: 'Corrida', hiit: 'HIIT', recovery: 'Recuperação',
  forca: 'Força', mobilidade: 'Mobilidade',
}
const DAY_NAMES = ['', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MONTH_NAMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

const TAG_COLORS = [
  { name: 'Laranja', hex: '#E8521A' },
  { name: 'Azul', hex: '#3B82F6' },
  { name: 'Verde', hex: '#22C55E' },
  { name: 'Vermelho', hex: '#EF4444' },
  { name: 'Amarelo', hex: '#EAB308' },
  { name: 'Roxo', hex: '#A855F7' },
  { name: 'Ciano', hex: '#06B6D4' },
  { name: 'Cinza', hex: '#71717A' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function addDays(base: string, days: number): Date {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d
}

function formatDay(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

function weekRange(cycleStart: string, weekNumber: number): string {
  const start = addDays(cycleStart, (weekNumber - 1) * 7)
  const end = addDays(cycleStart, (weekNumber - 1) * 7 + 6)
  return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]}`
}

function dayDate(cycleStart: string, weekNumber: number, dayOfWeek: number): Date {
  return addDays(cycleStart, (weekNumber - 1) * 7 + (dayOfWeek - 1))
}

// ─── Panel state ────────────────────────────────────────────────────────────

type PanelMode = 'search' | 'create' | 'view'

type PanelState = {
  weekNumber: number
  dayOfWeek: number
  mode: PanelMode
  existing: GroupDayTraining | null
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function AdminTurmaDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { group, plan, trainings, cycleStart, defaultWeekNumber, isLoading, error, refresh } =
    useAdminTurmaDetail(id ?? '')
  const { addTraining, removeTraining, createAndAddTraining, releaseThrough } =
    useGroupPlanMutations(id ?? '', cycleStart, plan?.id ?? null)

  const [view, setView] = useState<'week' | 'month'>('week')
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [panel, setPanel] = useState<PanelState | null>(null)
  const [mutating, setMutating] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [allTrainings, setAllTrainings] = useState<Training[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [releasing, setReleasing] = useState(false)

  const [showEditModal, setShowEditModal] = useState(false)

  // 0 = user hasn't navigated yet → fall back to the hook's default (current week in cycle)
  const effectiveWeek = selectedWeek > 0 ? selectedWeek : defaultWeekNumber

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [trainingsRes, tagsRes] = await Promise.all([
        supabase.from('trainings').select('*').order('title'),
        supabase.from('tags').select('*').order('name'),
      ])
      if (cancelled) return
      if (trainingsRes.data) setAllTrainings(trainingsRes.data)
      if (tagsRes.data) setAllTags(tagsRes.data)
    }

    load()
    return () => { cancelled = true }
  }, [])

  function openSlot(weekNumber: number, dayOfWeek: number) {
    setMutationError(null)
    setPanel({ weekNumber, dayOfWeek, mode: 'search', existing: null })
  }

  function openCard(entry: GroupDayTraining) {
    setMutationError(null)
    setPanel({ weekNumber: entry.weekNumber, dayOfWeek: entry.dayOfWeek, mode: 'view', existing: entry })
  }

  async function handleAddTraining(trainingId: string) {
    if (!panel) return
    setMutating(true)
    setMutationError(null)
    try {
      await addTraining(panel.weekNumber, panel.dayOfWeek, trainingId)
      refresh()
      setPanel(null)
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Erro ao adicionar treino')
    } finally {
      setMutating(false)
    }
  }

  async function handleRemoveTraining() {
    if (!panel?.existing) return
    setMutating(true)
    setMutationError(null)
    try {
      await removeTraining(panel.existing.id)
      refresh()
      setPanel(null)
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Erro ao remover treino')
    } finally {
      setMutating(false)
    }
  }

  async function handleCreateTraining(input: NewTrainingInput) {
    if (!panel) return
    setMutating(true)
    setMutationError(null)
    try {
      await createAndAddTraining(panel.weekNumber, panel.dayOfWeek, input)
      refresh()
      setPanel(null)
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Erro ao criar treino')
    } finally {
      setMutating(false)
    }
  }

  async function handleRelease(weekNumber: 1 | 2 | 3 | 4) {
    if (!plan || weekNumber <= plan.released_through_week) return
    setReleasing(true)
    try {
      await releaseThrough(weekNumber)
      refresh()
      const msg = weekNumber === 4
        ? 'Todas as semanas liberadas para os alunos'
        : `Semana ${weekNumber} liberada para os alunos`
      toast.success(msg)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao liberar semana')
    } finally {
      setReleasing(false)
    }
  }

  function switchToWeekFromMonth(weekNumber: number, dayOfWeek: number) {
    setMutationError(null)
    setView('week')
    setSelectedWeek(weekNumber)
    setPanel({ weekNumber, dayOfWeek, mode: 'search', existing: null })
  }

  const hasPanelOpen = panel !== null

  if (!id) return null

  return (
    <div>
      {/* Page header */}
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '32px', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate('/admin/turmas')}
            style={{ background: 'none', border: 'none', color: 'var(--orange)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', padding: 0 }}
          >
            ← Turmas
          </button>
          
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-subtle)', gap: '4px' }}>
            {(['month', 'week'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 14px', borderRadius: '6px',
                  border: view === v ? '1px solid var(--border-default)' : '1px solid transparent',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  background: view === v ? 'var(--bg-surface-hover)' : 'transparent',
                  color: view === v ? 'var(--text-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                {v === 'month' ? 'Mês' : 'Semana'}
              </button>
            ))}
          </div>
        </div>

        {group && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h1 style={{ fontFamily: 'var(--heading)', fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
              {group.name}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'rgba(232, 82, 26, 0.1)', color: 'var(--orange)', fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(232, 82, 26, 0.2)' }}>
                {goalLabel[group.goal] ?? group.goal}
              </span>
              <span style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
                {frequencyLabel[group.frequency] ?? group.frequency}
              </span>
              <span style={{ background: group.is_active ? 'rgba(74, 222, 128, 0.1)' : 'var(--bg-input)', color: group.is_active ? 'var(--green-accent)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', border: group.is_active ? '1px solid rgba(74, 222, 128, 0.2)' : '1px solid var(--border-subtle)' }}>
                {group.is_active ? 'Ativa' : 'Inativa'}
              </span>
              
              <button
                onClick={() => setShowEditModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '11px',
                  fontWeight: 600, cursor: 'pointer', marginLeft: 'auto',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <Edit2 size={12} />
                Editar
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', gap: '0', background: '#1c1c1e', borderRadius: '12px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>

          {/* Main grid area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {view === 'week' ? (
              <WeekView
                cycleStart={cycleStart}
                selectedWeek={effectiveWeek}
                trainings={trainings}
                panelEntry={panel?.existing ?? null}
                releasedThroughWeek={plan?.released_through_week ?? null}
                releasing={releasing}
                onNavigate={setSelectedWeek}
                onSlotClick={openSlot}
                onCardClick={openCard}
                onRelease={handleRelease}
              />
            ) : (
              <MonthView
                cycleStart={cycleStart}
                trainings={trainings}
                onCellClick={switchToWeekFromMonth}
              />
            )}
          </div>

          {/* Side panel */}
          {hasPanelOpen && panel && (
            <SidePanel
              cycleStart={cycleStart}
              panelState={panel}
              cycleTrainings={trainings}
              allTrainings={allTrainings}
              allTags={allTags}
              mutating={mutating}
              mutationError={mutationError}
              onModeChange={mode => setPanel(p => p ? { ...p, mode } : null)}
              onAddTraining={handleAddTraining}
              onRemoveTraining={handleRemoveTraining}
              onCreateTraining={handleCreateTraining}
              onClose={() => { setMutationError(null); setPanel(null) }}
              onTagCreated={(tag: Tag) => setAllTags(prev => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))}
            />
          )}
        </div>
      )}

      {showEditModal && group && (
        <EditGroupModal
          group={group}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

// ─── WeekView ───────────────────────────────────────────────────────────────

function WeekView({
  cycleStart,
  selectedWeek,
  trainings,
  panelEntry,
  releasedThroughWeek,
  releasing,
  onNavigate,
  onSlotClick,
  onCardClick,
  onRelease,
}: {
  cycleStart: string
  selectedWeek: number
  trainings: GroupDayTraining[]
  panelEntry: GroupDayTraining | null
  releasedThroughWeek: number | null
  releasing: boolean
  onNavigate: (week: number) => void
  onSlotClick: (weekNumber: number, dayOfWeek: number) => void
  onCardClick: (entry: GroupDayTraining) => void
  onRelease: (week: 1 | 2 | 3 | 4) => void
}) {
  const weekTrainings = trainings.filter(t => t.weekNumber === selectedWeek)
  const trainingByDay = new Map(weekTrainings.map(t => [t.dayOfWeek, t]))

  return (
    <div>
      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
        <button
          onClick={() => onNavigate(selectedWeek - 1)}
          disabled={selectedWeek <= 1}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '7px', color: selectedWeek <= 1 ? '#333' : '#E8521A', fontSize: '14px', fontWeight: 700, cursor: selectedWeek <= 1 ? 'not-allowed' : 'pointer' }}
        >‹</button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Semana {selectedWeek} de 4</div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{weekRange(cycleStart, selectedWeek)}</div>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '6px' }}>
            {[1, 2, 3, 4].map(w => {
              const isActive = w === selectedWeek
              const isReleased = releasedThroughWeek !== null && w <= releasedThroughWeek
              return (
                <button
                  key={w}
                  onClick={() => onNavigate(w)}
                  style={{
                    padding: '2px 7px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                    fontSize: '9px', fontWeight: 700, lineHeight: 1.4,
                    background: isActive ? '#E8521A' : isReleased ? '#4caf5022' : '#1e1e1e',
                    color: isActive ? '#fff' : isReleased ? '#4caf50' : '#3a3a3a',
                  }}
                >
                  S{w} {releasedThroughWeek !== null ? (isReleased ? '✓' : '🔒') : ''}
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={() => onNavigate(selectedWeek + 1)}
          disabled={selectedWeek >= 4}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '7px', color: selectedWeek >= 4 ? '#333' : '#E8521A', fontSize: '14px', fontWeight: 700, cursor: selectedWeek >= 4 ? 'not-allowed' : 'pointer' }}
        >›</button>
      </div>

      {/* Banner de liberação — só quando semana ativa está bloqueada */}
      {releasedThroughWeek !== null && selectedWeek > releasedThroughWeek && (
        <div style={{
          margin: '0 16px 8px',
          background: '#E8521A0f',
          border: '1px solid #E8521A33',
          borderRadius: '9px',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
          <div>
            <div style={{ color: '#E8521A', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
              Semana {selectedWeek} bloqueada
            </div>
            <div style={{ color: '#666', fontSize: '10px' }}>
              Alunos não veem os treinos desta semana
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={() => onRelease(selectedWeek as 1 | 2 | 3 | 4)}
              disabled={releasing}
              style={{
                background: '#E8521A', color: '#fff', border: 'none',
                borderRadius: '6px', padding: '6px 12px', fontSize: '10px',
                fontWeight: 700, cursor: releasing ? 'not-allowed' : 'pointer',
                opacity: releasing ? 0.6 : 1,
              }}
            >
              {releasing ? '...' : `Liberar S${selectedWeek}`}
            </button>
            <button
              onClick={() => onRelease(4)}
              disabled={releasing}
              style={{
                background: '#1e1e1e', color: '#666',
                border: '1px solid #2a2a2a', borderRadius: '6px',
                padding: '6px 10px', fontSize: '10px',
                cursor: releasing ? 'not-allowed' : 'pointer',
                opacity: releasing ? 0.6 : 1,
              }}
            >
              Liberar tudo
            </button>
          </div>
        </div>
      )}

      {/* Day grid */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', padding: '6px 16px 16px', minWidth: '420px' }}>
          {[1, 2, 3, 4, 5, 6].map(dow => {
            const date = cycleStart ? dayDate(cycleStart, selectedWeek, dow) : null
            const entry = trainingByDay.get(dow) ?? null
            const isSelected = panelEntry?.weekNumber === selectedWeek && panelEntry?.dayOfWeek === dow

            return (
              <div key={dow} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '6px 4px', textAlign: 'center', border: '1px solid #222' }}>
                  <div style={{ fontSize: '9px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{DAY_NAMES[dow]}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ccc', marginTop: '1px' }}>{date?.getDate() ?? ''}</div>
                </div>

                {entry ? (
                  <button
                    onClick={() => onCardClick(entry)}
                    style={{
                      background: isSelected ? '#1d1311' : '#1a1a1a',
                      border: `1px solid ${isSelected ? '#E8521A' : '#E8521A33'}`,
                      borderRadius: '8px', padding: '7px 6px', cursor: 'pointer',
                      textAlign: 'left', width: '100%',
                    }}
                  >
                    {entry.training.tags && (
                      <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '2px', color: entry.training.tags.color, background: entry.training.tags.color + '18', padding: '1px 5px', borderRadius: '3px', display: 'inline-block' }}>
                        {entry.training.tags.name}
                      </div>
                    )}
                    <div style={{ fontSize: '8px', color: '#E8521A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                      {typeLabel[entry.training.type] ?? entry.training.type}
                    </div>
                    <div style={{ fontSize: '10px', color: '#ddd', fontWeight: 600, lineHeight: 1.3 }}>{entry.training.title}</div>
                    {entry.training.distance_m && (
                      <div style={{ fontSize: '8px', color: '#555', marginTop: '3px' }}>{(entry.training.distance_m / 1000).toFixed(1)}km</div>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => onSlotClick(selectedWeek, dow)}
                    style={{
                      border: `1px dashed ${isSelected ? '#E8521A' : '#252525'}`,
                      borderRadius: '8px', minHeight: '52px', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: isSelected ? '#E8521A' : '#303030',
                      fontSize: '18px', cursor: 'pointer', background: isSelected ? '#E8521A0a' : 'transparent',
                      width: '100%',
                    }}
                  >+</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── MonthView ──────────────────────────────────────────────────────────────

function MonthView({
  cycleStart,
  trainings,
  onCellClick,
}: {
  cycleStart: string
  trainings: GroupDayTraining[]
  onCellClick: (weekNumber: number, dayOfWeek: number) => void
}) {
  return (
    <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1, 2, 3, 4].map(wn => (
        <div key={wn}>
          <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
            Semana {wn} · {cycleStart ? weekRange(cycleStart, wn) : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
            {[1, 2, 3, 4, 5, 6].map(dow => {
              const entry = trainings.find(t => t.weekNumber === wn && t.dayOfWeek === dow)
              return (
                <button
                  key={dow}
                  onClick={() => onCellClick(wn, dow)}
                  style={{
                    background: entry ? '#1a1a1a' : '#161616',
                    border: `1px solid ${entry ? '#E8521A22' : '#1e1e1e'}`,
                    borderRadius: '7px', padding: '5px 4px', minHeight: '46px',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{ fontSize: '8px', color: '#444', fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' }}>{DAY_NAMES[dow]}</div>
                  {entry ? (
                    <div style={{ fontSize: '8px', color: '#E8521A', fontWeight: 600, lineHeight: 1.3 }}>
                      {entry.training.title.length > 14 ? entry.training.title.slice(0, 13) + '…' : entry.training.title}
                    </div>
                  ) : (
                    <div style={{ color: '#252525', fontSize: '14px', textAlign: 'center' }}>+</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── SidePanel ──────────────────────────────────────────────────────────────

function SidePanel({
  cycleStart,
  panelState,
  cycleTrainings,
  allTrainings,
  allTags,
  mutating,
  mutationError,
  onModeChange,
  onAddTraining,
  onRemoveTraining,
  onCreateTraining,
  onClose,
  onTagCreated,
}: {
  cycleStart: string
  panelState: PanelState
  cycleTrainings: GroupDayTraining[]
  allTrainings: Training[]
  allTags: Tag[]
  mutating: boolean
  mutationError: string | null
  onModeChange: (mode: PanelMode) => void
  onAddTraining: (trainingId: string) => void
  onRemoveTraining: () => void
  onCreateTraining: (input: NewTrainingInput) => void
  onClose: () => void
  onTagCreated: (tag: Tag) => void
}) {
  const { weekNumber, dayOfWeek, mode, existing } = panelState
  const date = cycleStart ? dayDate(cycleStart, weekNumber, dayOfWeek) : null
  const dayLabel = date ? `${DAY_NAMES[dayOfWeek]}, ${formatDay(date)}` : DAY_NAMES[dayOfWeek]

  const [search, setSearch] = useState('')

  const cycleTrainingIds = new Set(cycleTrainings.map(t => t.training.id))
  const inCycle = allTrainings.filter(t => cycleTrainingIds.has(t.id))
  const others = allTrainings.filter(t => !cycleTrainingIds.has(t.id))

  function filtered(list: Training[]) {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(t => t.title.toLowerCase().includes(q))
  }

  const panelStyle: React.CSSProperties = {
    width: '220px',
    background: '#161616',
    borderLeft: '1px solid #1e1e1e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>
            {existing ? (
              <><span style={{ color: '#E8521A' }}>{typeLabel[existing.training.type] ?? existing.training.type}</span> — {DAY_NAMES[dayOfWeek]}</>
            ) : (
              <><span style={{ color: '#E8521A' }}>Adicionar treino</span> — {dayLabel}</>
            )}
          </div>
          {existing && (
            <div style={{ fontSize: '12px', color: '#ccc', marginTop: '3px', fontWeight: 600 }}>{existing.training.title}</div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#444', fontSize: '14px', cursor: 'pointer', padding: '0', lineHeight: 1 }}>✕</button>
      </div>

      {mutationError && (
        <div style={{ margin: '8px 14px 0', padding: '7px 10px', background: '#ff3b3011', border: '1px solid #ff3b3044', borderRadius: '7px', fontSize: '10px', color: '#ff6b6b' }}>
          {mutationError}
        </div>
      )}

      {/* View mode: existing entry */}
      {mode === 'view' && existing && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {existing.training.distance_m && (
            <div style={{ fontSize: '11px', color: '#888' }}>Distância: {(existing.training.distance_m / 1000).toFixed(1)} km</div>
          )}
          {existing.training.description && (
            <div style={{ fontSize: '11px', color: '#666', lineHeight: 1.4 }}>{existing.training.description}</div>
          )}
          <button
            onClick={onRemoveTraining}
            disabled={mutating}
            style={{ marginTop: '8px', background: '#ff3b3011', border: '1px solid #ff3b3044', borderRadius: '8px', padding: '8px', color: '#ff6b6b', fontSize: '11px', fontWeight: 600, cursor: mutating ? 'not-allowed' : 'pointer' }}
          >
            {mutating ? 'Removendo…' : 'Remover deste dia'}
          </button>
        </div>
      )}

      {/* Search mode */}
      {mode === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px 0' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar treino…"
              style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '7px 10px', fontSize: '11px', color: '#ccc', outline: 'none' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
            {filtered(inCycle).length > 0 && (
              <>
                <div style={{ fontSize: '9px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Usados neste ciclo</div>
                {filtered(inCycle).map(t => {
                  const tag = allTags.find(tg => tg.id === t.tag_id)
                  return <TrainingListItem key={t.id} training={t} mutating={mutating} onSelect={() => onAddTraining(t.id)} tagName={tag?.name} tagColor={tag?.color} />
                })}
              </>
            )}
            {filtered(others).length > 0 && (
              <>
                <div style={{ fontSize: '9px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '8px 0 5px' }}>Outros treinos</div>
                {filtered(others).map(t => {
                  const tag = allTags.find(tg => tg.id === t.tag_id)
                  return <TrainingListItem key={t.id} training={t} mutating={mutating} onSelect={() => onAddTraining(t.id)} tagName={tag?.name} tagColor={tag?.color} />
                })}
              </>
            )}
          </div>
          <div style={{ padding: '8px 14px 12px', borderTop: '1px solid #1e1e1e' }}>
            <button
              onClick={() => onModeChange('create')}
              style={{ width: '100%', background: '#E8521A11', border: '1px solid #E8521A33', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: '#E8521A', cursor: 'pointer' }}
            >
              + Criar novo treino
            </button>
          </div>
        </div>
      )}

      {/* Create mode */}
      {mode === 'create' && (
        <CreateTrainingForm
          mutating={mutating}
          allTags={allTags}
          onBack={() => onModeChange('search')}
          onSubmit={onCreateTraining}
          onTagCreated={onTagCreated}
        />
      )}
    </div>
  )
}

// ─── TrainingListItem ────────────────────────────────────────────────────────

function TrainingListItem({ training, mutating, onSelect, tagName, tagColor }: { training: Training; mutating: boolean; onSelect: () => void; tagName?: string; tagColor?: string }) {
  return (
    <button
      onClick={onSelect}
      disabled={mutating}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
        padding: '7px 8px', borderRadius: '7px', background: '#1a1a1a',
        border: 'none', cursor: mutating ? 'not-allowed' : 'pointer', marginBottom: '3px', textAlign: 'left',
      }}
    >
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#E8521A', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '10px', color: '#ccc', fontWeight: 600 }}>{training.title}</div>
        <div style={{ fontSize: '8px', color: '#555', marginTop: '1px' }}>
          {typeLabel[training.type] ?? training.type}
          {tagName && <> · <span style={{ color: tagColor }}>{tagName}</span></>}
          {training.distance_m ? ` · ${(training.distance_m / 1000).toFixed(1)}km` : ''}
        </div>
      </div>
    </button>
  )
}

// ─── CreateTrainingForm ─────────────────────────────────────────────────────

const TRAINING_TYPES: TrainingType[] = ['corrida', 'hiit', 'recovery', 'forca', 'mobilidade']

function parsePace(value: string): number | undefined {
  const match = value.match(/^(\d+):(\d{2})$/)
  if (!match) return undefined
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function CreateTrainingForm({ mutating, allTags, onBack, onSubmit, onTagCreated }: {
  mutating: boolean
  allTags: Tag[]
  onBack: () => void
  onSubmit: (input: NewTrainingInput) => void
  onTagCreated: (tag: Tag) => void
}) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TrainingType>('corrida')
  const [distanceKm, setDistanceKm] = useState('')
  const [pace, setPace] = useState('')
  const [sets, setSets] = useState('')
  const [description, setDescription] = useState('')
  const [tagId, setTagId] = useState<string>('')
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#E8521A')
  const [creatingTag, setCreatingTag] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    setCreatingTag(true)
    setTagError(null)
    const { data, error } = await supabase
      .from('tags')
      .insert({ name: newTagName.trim(), color: newTagColor, created_by: user?.id ?? '' })
      .select('*')
      .single()
    setCreatingTag(false)
    if (error || !data) { setTagError(error?.message ?? 'Erro ao criar etiqueta'); return }
    onTagCreated(data as Tag)
    setTagId(data.id)
    setShowNewTag(false)
    setNewTagName('')
  }

  function handleSubmit() {
    if (!title.trim()) return
    const input: NewTrainingInput = { title: title.trim(), type }
    const distNum = parseFloat(distanceKm)
    if (!isNaN(distNum) && distNum > 0) input.distance_m = Math.round(distNum * 1000)
    const paceSeconds = parsePace(pace)
    if (paceSeconds) input.target_pace_seconds_per_km = paceSeconds
    const setsNum = parseInt(sets)
    if (!isNaN(setsNum) && setsNum > 0) input.sets = setsNum
    if (description.trim()) input.description = description.trim()
    if (tagId) input.tag_id = tagId
    onSubmit(input)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a',
    borderRadius: '7px', padding: '6px 8px', fontSize: '11px', color: '#ccc', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '9px', color: '#555', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.4px', marginBottom: '3px', display: 'block',
  }

  return (
    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#E8521A', fontSize: '10px', fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', marginBottom: '2px' }}>
        ← Voltar à busca
      </button>
      <div>
        <label style={labelStyle}>Título *</label>
        <input autoFocus style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Intervalo 400m" />
      </div>
      <div>
        <label style={labelStyle}>Tipo *</label>
        <select style={{ ...inputStyle, color: '#E8521A', fontWeight: 600 }} value={type} onChange={e => setType(e.target.value as TrainingType)}>
          {TRAINING_TYPES.map(t => <option key={t} value={t}>{typeLabel[t]}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Distância (km)</label>
          <input style={inputStyle} value={distanceKm} onChange={e => setDistanceKm(e.target.value)} placeholder="ex: 8" type="number" min="0" step="0.1" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Pace alvo</label>
          <input style={inputStyle} value={pace} onChange={e => setPace(e.target.value)} placeholder="5:30" />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Séries</label>
        <input style={inputStyle} value={sets} onChange={e => setSets(e.target.value)} placeholder="ex: 8" type="number" min="1" />
      </div>
      <div>
        <label style={labelStyle}>Descrição</label>
        <textarea
          style={{ ...inputStyle, resize: 'none', minHeight: '56px' }}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Instruções do treino…"
        />
      </div>
      <div>
        <label style={labelStyle}>Etiqueta</label>
        {showNewTag ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              style={inputStyle}
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              placeholder="Nome da etiqueta"
            />
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {TAG_COLORS.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setNewTagColor(c.hex)}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', border: newTagColor === c.hex ? '2px solid #fff' : '2px solid transparent',
                    background: c.hex, cursor: 'pointer', padding: 0,
                  }}
                  title={c.name}
                />
              ))}
            </div>
            {tagError && (
              <div style={{ fontSize: '10px', color: '#ff6b6b', padding: '4px 6px', background: '#ff3b3011', borderRadius: '5px', border: '1px solid #ff3b3044' }}>
                {tagError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => { setShowNewTag(false); setTagError(null) }} style={{ ...inputStyle, textAlign: 'center', cursor: 'pointer', flex: 1 }}>Cancelar</button>
              <button type="button" onClick={handleCreateTag} disabled={creatingTag || !newTagName.trim()} style={{ flex: 1, background: '#E8521A', color: '#fff', border: 'none', borderRadius: '7px', padding: '6px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                {creatingTag ? '...' : 'Criar'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '6px' }}>
            <select style={{ ...inputStyle, flex: 1 }} value={tagId} onChange={e => setTagId(e.target.value)}>
              <option value="">Nenhuma</option>
              {allTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="button" onClick={() => setShowNewTag(true)} style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '7px', padding: '6px 8px', fontSize: '11px', color: '#E8521A', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Nova</button>
          </div>
        )}
      </div>
      <button
        onClick={handleSubmit}
        disabled={mutating || !title.trim()}
        style={{ background: mutating || !title.trim() ? '#333' : '#E8521A', color: '#fff', borderRadius: '8px', padding: '9px', textAlign: 'center', fontSize: '11px', fontWeight: 700, cursor: mutating || !title.trim() ? 'not-allowed' : 'pointer', border: 'none', marginTop: '4px' }}
      >
        {mutating ? 'Salvando…' : 'Salvar e adicionar ao dia'}
      </button>
    </div>
  )
}
