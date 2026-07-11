import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAdminTurmaDetail, type GroupDayTraining } from '../../hooks/useAdminTurmaDetail'
import { useGroupPlanMutations, type NewTrainingInput } from '../../hooks/useGroupPlanMutations'
import { useTrainingPrograms } from '../../hooks/useTrainingPrograms'
import { useTreinoMutations } from '../../hooks/useTreinoMutations'
import { useAuth } from '../../contexts/AuthContext'
import type { Tag, Training, TrainingCustomType, TrainingProgram } from '../../lib/types'
import { TAG_COLORS, TRAINING_TYPE_OPTIONS, TRAINING_TYPE_LABELS, PROGRAM_COLOR_VAR_MAP, insertTag, insertTrainingType } from '../../lib/trainingUtils'
import { EditGroupModal } from '../../components/admin/EditGroupModal'
import { ManageProgramsModal } from '../../components/admin/ManageProgramsModal'
import { Edit2, Trash2 } from 'lucide-react'
import { ProfessorStatusGrid } from '../../components/admin/ProfessorStatusGrid'
import { VideoPlayer } from '../../components/ui/VideoPlayer'

// ─── Labels ────────────────────────────────────────────────────────────────

const goalLabel: Record<string, string> = {
  '5k': '5K', '10k': '10K', '21k': '21K',
  evoluir_10k: 'Evolução 10K', evoluir_21k: 'Evolução 21K',
}
const frequencyLabel: Record<string, string> = { '2x': '2×/sem', '3x': '3×/sem' }
const DAY_NAMES = ['', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MONTH_NAMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

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
  const { addTraining, removeTraining, createAndAddTraining, releaseThrough, deleteGroup } =
    useGroupPlanMutations(id ?? '', cycleStart, plan?.id ?? null)
  const { programs, createProgram, updateProgramName } = useTrainingPrograms()
  const { updateTraining } = useTreinoMutations()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'treinos' | 'status'>('treinos')
  const [view, setView] = useState<'week' | 'month'>('week')
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [panel, setPanel] = useState<PanelState | null>(null)
  const [mutating, setMutating] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [allTrainings, setAllTrainings] = useState<Training[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [allCustomTypes, setAllCustomTypes] = useState<TrainingCustomType[]>([])
  const [releasing, setReleasing] = useState(false)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showManagePastas, setShowManagePastas] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // 0 = user hasn't navigated yet → fall back to the hook's default (current week in cycle)
  const effectiveWeek = selectedWeek > 0 ? selectedWeek : defaultWeekNumber

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [trainingsRes, tagsRes, typesRes] = await Promise.all([
        supabase.from('trainings').select('id, title, duration_minutes, distance_m, type, category, program, description, sets, target_pace_seconds_per_km, tag_id, video_url, created_at, created_by, updated_at').order('title').limit(200),
        supabase.from('tags').select('id, name, color, created_at, created_by, updated_at').order('name'),
        supabase.from('training_types').select('id, name, is_custom, created_at, created_by').eq('is_custom', true).order('name'),
      ])
      if (cancelled) return
      if (trainingsRes.error) { setMutationError('Erro ao carregar treinos: ' + trainingsRes.error.message); return }
      if (tagsRes.error)      { setMutationError('Erro ao carregar etiquetas: ' + tagsRes.error.message); return }
      if (typesRes.error)     { setMutationError('Erro ao carregar tipos: ' + typesRes.error.message); return }
      if (trainingsRes.data) setAllTrainings(trainingsRes.data)
      if (tagsRes.data) setAllTags(tagsRes.data)
      if (typesRes.data) setAllCustomTypes(typesRes.data)
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
    setPanel({ weekNumber: entry.weekNumber, dayOfWeek: entry.dayOfWeek ?? 0, mode: 'view', existing: entry })
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

  async function handleCreateTagMutation(name: string, color: string): Promise<Tag | null> {
    if (!user) { toast.error('Sessão expirada. Recarregue a página.'); return null }
    const { data, error } = await insertTag(user.id, name, color)
    if (error || !data) {
      if (error?.code === '23505') toast.error('Já existe uma etiqueta com esse nome')
      else toast.error(error?.message ?? 'Erro ao criar etiqueta')
      return null
    }
    setAllTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }

  async function handleCreateTypeMutation(name: string): Promise<TrainingCustomType | null> {
    if (!user) { toast.error('Sessão expirada. Recarregue a página.'); return null }
    const { data, error } = await insertTrainingType(user.id, name)
    if (error || !data) {
      if (error?.code === '23505') toast.error('Já existe um tipo com esse nome')
      else toast.error(error?.message ?? 'Erro ao criar tipo')
      return null
    }
    setAllCustomTypes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }

  async function handleMoveTraining(trainingId: string, newProgramSlug: string) {
    try {
      await updateTraining({ id: trainingId, program: newProgramSlug })
      setAllTrainings(prev => prev.map(t => t.id === trainingId ? { ...t, program: newProgramSlug } : t))
      toast.success('Treino movido de pasta')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao mover treino')
    }
  }

  async function handleSetRelease(target: 0 | 1 | 2 | 3 | 4) {
    if (!plan) return
    setReleasing(true)
    try {
      await releaseThrough(target)
      refresh()
      const msg =
        target === 0 ? 'Plano bloqueado para os alunos' :
        target === 4 ? 'Todas as semanas liberadas para os alunos' :
        `Semana ${target} liberada para os alunos`
      toast.success(msg)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao liberar semana')
    } finally {
      setReleasing(false)
    }
  }

  async function handleDeleteGroup() {
    if (!id || !group || deleteConfirmText !== group.name) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteGroup(id)
      toast.success('Turma excluída')
      navigate('/admin/turmas')
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Erro ao excluir turma')
      setIsDeleting(false)
    }
  }

  function handleChipClick(w: 1 | 2 | 3 | 4) {
    if (!plan) return
    const current = plan.released_through_week
    const target = (w === current ? w - 1 : w) as 0 | 1 | 2 | 3 | 4
    handleSetRelease(target)
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
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-subtle)', gap: '4px' }}>
              {(['treinos', 'status'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    padding: '6px 14px', borderRadius: '6px',
                    border: activeTab === t ? '1px solid var(--border-default)' : '1px solid transparent',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    background: activeTab === t ? 'var(--bg-surface-hover)' : 'transparent',
                    color: activeTab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  {t === 'treinos' ? 'Treinos' : 'Status'}
                </button>
              ))}
            </div>

            {activeTab === 'treinos' && group?.mode !== 'flexivel' && (
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
            )}
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

      {error && <p style={{ color: 'var(--red-accent)', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', gap: '0', background: 'var(--bg-card-green)', borderRadius: '12px', border: '1px solid var(--border-green)', overflow: 'hidden' }}>

          {/* Main grid area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeTab === 'status' ? (
              <ProfessorStatusGrid
                groupId={group?.id || ''}
                planId={plan?.id ?? null}
                groupTrainings={trainings}
              />
            ) : group?.mode === 'flexivel' ? (
              <div style={{ padding: '16px' }}>
                <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: '16px' }}>Treinos da Turma (Flexível)</h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '2px' }}>Liberar:</span>
                  {([1, 2, 3, 4] as const).map(w => {
                    const isReleased = (plan?.released_through_week ?? 0) >= w
                    return (
                      <button
                        key={w}
                        onClick={() => handleChipClick(w)}
                        disabled={releasing || !plan}
                        style={{
                          padding: '4px 10px', borderRadius: '6px', border: 'none',
                          cursor: releasing || !plan ? 'not-allowed' : 'pointer',
                          fontSize: '11px', fontWeight: 700,
                          background: isReleased ? 'var(--border-green)' : 'var(--bg-surface)',
                          color: isReleased ? 'var(--green-accent)' : 'var(--text-secondary)',
                          opacity: releasing ? 0.6 : 1,
                        }}
                      >
                        S{w} {isReleased ? '✓' : '🔒'}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {([1, 2, 3, 4] as const).map(w => {
                    const isReleased = (plan?.released_through_week ?? 0) >= w
                    const weekTrainings = trainings.filter(entry => entry.weekNumber === w)
                    return (
                      <div key={w}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Semana {w}</span>
                          <span style={{ fontSize: '10px', color: isReleased ? 'var(--green-accent)' : 'var(--text-tertiary)', fontWeight: 600 }}>
                            {isReleased ? '✓ liberada' : '🔒 bloqueada'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {weekTrainings.map(entry => (
                            <div
                              key={entry.id}
                              onClick={() => openCard(entry)}
                              style={{ background: panel?.existing?.id === entry.id ? 'var(--bg-card-orange)' : 'var(--bg-surface)', border: `1px solid ${panel?.existing?.id === entry.id ? 'var(--orange)' : 'var(--border-default)'}`, padding: '12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--orange)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                                  {TRAINING_TYPE_LABELS[entry.training.type] ?? entry.training.type}
                                </div>
                                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>{entry.training.title}</div>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                {entry.training.distance_m ? `${(entry.training.distance_m/1000).toFixed(1)}km` : ''}
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => openSlot(w, 1)}
                            style={{ border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}
                          >
                            + Adicionar Treino · Semana {w}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : view === 'week' ? (
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
                onRelease={handleSetRelease}
                onChipRelease={handleChipClick}
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
              allTrainings={allTrainings}
              allTags={allTags}
              allCustomTypes={allCustomTypes}
              allPrograms={programs}
              mutating={mutating}
              mutationError={mutationError}
              onModeChange={mode => setPanel(p => p ? { ...p, mode } : null)}
              onAddTraining={handleAddTraining}
              onRemoveTraining={handleRemoveTraining}
              onCreateTraining={handleCreateTraining}
              onClose={() => { setMutationError(null); setPanel(null) }}
              onCreateTag={handleCreateTagMutation}
              onCreateType={handleCreateTypeMutation}
              onOpenManagePastas={() => setShowManagePastas(true)}
            />
          )}
        </div>
      )}

      {group && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(220, 38, 38, 0.2)',
          borderRadius: '16px',
          padding: '24px',
          marginTop: '24px',
        }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>
            Zona de Perigo
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5 }}>
            Excluir a turma remove permanentemente o plano de treino, os treinos atribuídos e os agendamentos. Os alunos matriculados não são excluídos — apenas ficam sem turma.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(220, 38, 38, 0.1)', color: 'var(--red-accent)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '12px', padding: '10px 20px',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer',
            }}
          >
            <Trash2 size={16} />
            Excluir turma
          </button>
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

      <ManageProgramsModal
        isOpen={showManagePastas}
        onClose={() => setShowManagePastas(false)}
        programs={programs}
        allTrainings={allTrainings}
        onCreateProgram={createProgram}
        onUpdateProgramName={updateProgramName}
        onMoveTraining={handleMoveTraining}
      />

      {showDeleteModal && group && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '440px',
            width: '100%',
          }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>
              Excluir turma?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px' }}>
              Isso vai apagar o plano de treino, os treinos atribuídos e os agendamentos dessa turma. Os alunos matriculados NÃO serão excluídos — eles ficam sem turma (SEM TURMA). Essa ação não pode ser desfeita.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 8px' }}>
              Digite <strong style={{ color: 'var(--text-primary)' }}>{group.name}</strong> para confirmar:
            </p>
            <input
              autoFocus
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={group.name}
              style={{
                width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
                border: '1px solid var(--border-default)', borderRadius: '8px',
                padding: '10px 12px', fontSize: '14px', color: 'var(--text-primary)',
                outline: 'none', marginBottom: '16px',
              }}
            />
            {deleteError && (
              <p style={{
                color: 'var(--red-accent)', fontSize: '13px', margin: '0 0 16px',
                padding: '10px', background: 'rgba(255, 59, 48, 0.07)',
                borderRadius: '8px', border: '1px solid rgba(255, 59, 48, 0.25)',
              }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteError(null); setDeleteConfirmText('') }}
                disabled={isDeleting}
                style={{
                  flex: 1, background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)', borderRadius: '12px',
                  padding: '12px', fontWeight: 700, fontSize: '14px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={isDeleting || deleteConfirmText !== group.name}
                style={{
                  flex: 1, background: 'var(--red-accent)', color: 'var(--text-on-brand)',
                  border: 'none', borderRadius: '12px',
                  padding: '12px', fontWeight: 700, fontSize: '14px',
                  cursor: isDeleting || deleteConfirmText !== group.name ? 'not-allowed' : 'pointer',
                  opacity: isDeleting || deleteConfirmText !== group.name ? 0.5 : 1,
                }}
              >
                {isDeleting ? 'Excluindo…' : 'Excluir permanentemente'}
              </button>
            </div>
          </div>
        </div>
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
  onChipRelease,
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
  onRelease: (week: 0 | 1 | 2 | 3 | 4) => void
  onChipRelease: (week: 1 | 2 | 3 | 4) => void
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
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '7px', color: selectedWeek <= 1 ? 'var(--text-disabled)' : 'var(--orange)', fontSize: '14px', fontWeight: 700, cursor: selectedWeek <= 1 ? 'not-allowed' : 'pointer' }}
        >‹</button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Semana {selectedWeek} de 4</div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{weekRange(cycleStart, selectedWeek)}</div>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '6px' }}>
            {[1, 2, 3, 4].map(w => {
              const isActive = w === selectedWeek
              const isReleased = releasedThroughWeek !== null && w <= releasedThroughWeek
              return (
                <button
                  key={w}
                  onClick={() => { onNavigate(w); onChipRelease(w as 1 | 2 | 3 | 4) }}
                  style={{
                    padding: '2px 7px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                    fontSize: '9px', fontWeight: 700, lineHeight: 1.4,
                    background: isActive ? 'var(--orange)' : isReleased ? 'var(--border-green)' : 'var(--bg-surface)',
                    color: isActive ? 'white' : isReleased ? 'var(--green-accent)' : 'var(--text-secondary)',
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
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '7px', color: selectedWeek >= 4 ? 'var(--text-disabled)' : 'var(--orange)', fontSize: '14px', fontWeight: 700, cursor: selectedWeek >= 4 ? 'not-allowed' : 'pointer' }}
        >›</button>
      </div>

      {/* Banner de liberação — só quando semana ativa está bloqueada */}
      {releasedThroughWeek !== null && selectedWeek > releasedThroughWeek && (
        <div style={{
          margin: '0 16px 8px',
          background: 'var(--orange-subtle)',
          border: '1px solid var(--orange-border)',
          borderRadius: '9px',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
          <div>
            <div style={{ color: 'var(--orange)', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
              Semana {selectedWeek} bloqueada
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
              Alunos não veem os treinos desta semana
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={() => onRelease(selectedWeek as 1 | 2 | 3 | 4)}
              disabled={releasing}
              style={{
                background: 'var(--orange)', color: 'var(--text-on-brand)', border: 'none',
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
                background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)', borderRadius: '6px',
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
                <div style={{ background: 'var(--bg-surface)', borderRadius: '8px', padding: '6px 4px', textAlign: 'center', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{DAY_NAMES[dow]}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '1px' }}>{date?.getDate() ?? ''}</div>
                </div>

                {entry ? (
                  <button
                    onClick={() => onCardClick(entry)}
                    style={{
                      background: isSelected ? 'var(--bg-card-orange)' : 'var(--bg-surface)',
                      border: `1px solid ${isSelected ? 'var(--orange)' : 'var(--border-orange)'}`,
                      borderRadius: '8px', padding: '7px 6px', cursor: 'pointer',
                      textAlign: 'left', width: '100%',
                    }}
                  >
                    {entry.training.tags && (
                      <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '2px', color: entry.training.tags.color, background: entry.training.tags.color + '18', padding: '1px 5px', borderRadius: '3px', display: 'inline-block' }}>
                        {entry.training.tags.name}
                      </div>
                    )}
                    <div style={{ fontSize: '8px', color: 'var(--orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                      {TRAINING_TYPE_LABELS[entry.training.type] ?? entry.training.type}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.3 }}>{entry.training.title}</div>
                    {entry.training.distance_m && (
                      <div style={{ fontSize: '8px', color: 'var(--text-secondary)', marginTop: '3px' }}>{(entry.training.distance_m / 1000).toFixed(1)}km</div>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => onSlotClick(selectedWeek, dow)}
                    style={{
                      border: `1px dashed ${isSelected ? 'var(--orange)' : 'var(--border-default)'}`,
                      borderRadius: '8px', minHeight: '52px', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: isSelected ? 'var(--orange)' : 'var(--text-tertiary)',
                      fontSize: '18px', cursor: 'pointer', background: isSelected ? 'var(--orange-subtle)' : 'transparent',
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
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
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
                    background: entry ? 'var(--bg-surface)' : 'var(--bg-input)',
                    border: `1px solid ${entry ? 'var(--border-orange)' : 'var(--border-default)'}`,
                    borderRadius: '7px', padding: '5px 4px', minHeight: '46px',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{ fontSize: '8px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' }}>{DAY_NAMES[dow]}</div>
                  {entry ? (
                    <div style={{ fontSize: '8px', color: 'var(--orange)', fontWeight: 600, lineHeight: 1.3 }}>
                      {entry.training.title.length > 14 ? entry.training.title.slice(0, 13) + '…' : entry.training.title}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '14px', textAlign: 'center' }}>+</div>
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
  allTrainings,
  allTags,
  allCustomTypes,
  allPrograms,
  mutating,
  mutationError,
  onModeChange,
  onAddTraining,
  onRemoveTraining,
  onCreateTraining,
  onClose,
  onCreateTag,
  onCreateType,
  onOpenManagePastas,
}: {
  cycleStart: string
  panelState: PanelState
  allTrainings: Training[]
  allTags: Tag[]
  allCustomTypes: TrainingCustomType[]
  allPrograms: TrainingProgram[]
  mutating: boolean
  mutationError: string | null
  onModeChange: (mode: PanelMode) => void
  onAddTraining: (trainingId: string) => void
  onRemoveTraining: () => void
  onCreateTraining: (input: NewTrainingInput) => void
  onClose: () => void
  onCreateTag: (name: string, color: string) => Promise<Tag | null>
  onCreateType: (name: string) => Promise<TrainingCustomType | null>
  onOpenManagePastas: () => void
}) {
  const { weekNumber, dayOfWeek, mode, existing } = panelState
  const date = cycleStart ? dayDate(cycleStart, weekNumber, dayOfWeek) : null
  const dayLabel = date ? `${DAY_NAMES[dayOfWeek]}, ${formatDay(date)}` : DAY_NAMES[dayOfWeek]

  const [search, setSearch] = useState('')
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)

  function filtered(list: Training[]) {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(t => t.title.toLowerCase().includes(q))
  }

  const filteredPrograms = search.trim()
    ? allPrograms.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : allPrograms

  const programTrainings = filtered(allTrainings.filter(t => t.program === selectedProgram))

  function openFolder(slug: string) {
    setSelectedProgram(slug)
    setSearch('')
  }

  function backToFolders() {
    setSelectedProgram(null)
    setSearch('')
  }

  const panelStyle: React.CSSProperties = {
    width: '220px',
    background: 'var(--bg-surface)',
    borderLeft: '1px solid var(--border-default)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {existing ? (
              <><span style={{ color: 'var(--orange)' }}>{TRAINING_TYPE_LABELS[existing.training.type] ?? existing.training.type}</span> — {DAY_NAMES[dayOfWeek]}</>
            ) : (
              <><span style={{ color: 'var(--orange)' }}>Adicionar treino</span> — {dayLabel}</>
            )}
          </div>
          {existing && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', fontWeight: 600 }}>{existing.training.title}</div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '14px', cursor: 'pointer', padding: '0', lineHeight: 1 }}>✕</button>
      </div>

      {mutationError && (
        <div style={{ margin: '8px 14px 0', padding: '7px 10px', background: 'var(--red-subtle)', border: '1px solid var(--red-border)', borderRadius: '7px', fontSize: '10px', color: 'var(--red-accent)' }}>
          {mutationError}
        </div>
      )}

      {/* View mode: existing entry */}
      {mode === 'view' && existing && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {existing.training.distance_m && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Distância: {(existing.training.distance_m / 1000).toFixed(1)} km</div>
          )}
          {existing.training.description && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{existing.training.description}</div>
          )}
          {existing.training.video_url && (
            <div style={{ marginTop: '4px' }}>
              <VideoPlayer videoUrl={existing.training.video_url} />
            </div>
          )}
          <button
            onClick={onRemoveTraining}
            disabled={mutating}
            style={{ marginTop: '8px', background: 'var(--red-subtle)', border: '1px solid var(--red-border)', borderRadius: '8px', padding: '8px', color: 'var(--red-accent)', fontSize: '11px', fontWeight: 600, cursor: mutating ? 'not-allowed' : 'pointer' }}
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
              placeholder={selectedProgram === null ? 'Buscar pasta…' : 'Buscar treino…'}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '7px 10px', fontSize: '11px', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          {selectedProgram !== null && (
            <div style={{ padding: '8px 14px 0' }}>
              <button
                onClick={backToFolders}
                style={{ background: 'none', border: 'none', color: 'var(--orange)', fontSize: '10px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                ← Pastas
              </button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
            {selectedProgram === null ? (
              filteredPrograms.length === 0 ? (
                <p style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Nenhuma pasta encontrada.</p>
              ) : (
                filteredPrograms.map(program => (
                  <button
                    key={program.id}
                    onClick={() => openFolder(program.slug)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                      padding: '9px 8px', borderRadius: '7px', background: 'var(--bg-surface)',
                      border: 'none', cursor: 'pointer', marginBottom: '4px', textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PROGRAM_COLOR_VAR_MAP[program.color]?.accent ?? 'var(--text-secondary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600 }}>{program.name}</span>
                  </button>
                ))
              )
            ) : programTrainings.length === 0 ? (
              <p style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Nenhum treino nesta pasta.</p>
            ) : (
              programTrainings.map(t => {
                const tag = allTags.find(tg => tg.id === t.tag_id)
                return <TrainingListItem key={t.id} training={t} mutating={mutating} onSelect={() => onAddTraining(t.id)} tagName={tag?.name} tagColor={tag?.color} />
              })
            )}
          </div>

          {selectedProgram === null && (
            <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border-default)' }}>
              <button
                onClick={onOpenManagePastas}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Gerenciar Pastas
              </button>
            </div>
          )}

          <div style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--border-default)' }}>
            <button
              onClick={() => onModeChange('create')}
              style={{ width: '100%', background: 'var(--orange-subtle)', border: '1px solid var(--orange-border)', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--orange)', cursor: 'pointer' }}
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
          allCustomTypes={allCustomTypes}
          onBack={() => onModeChange('search')}
          onSubmit={onCreateTraining}
          onCreateTag={onCreateTag}
          onCreateType={onCreateType}
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
        padding: '7px 8px', borderRadius: '7px', background: 'var(--bg-surface)',
        border: 'none', cursor: mutating ? 'not-allowed' : 'pointer', marginBottom: '3px', textAlign: 'left',
      }}
    >
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--orange)', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '10px', color: 'var(--text-primary)', fontWeight: 600 }}>{training.title}</div>
        <div style={{ fontSize: '8px', color: 'var(--text-secondary)', marginTop: '1px' }}>
          {TRAINING_TYPE_LABELS[training.type] ?? training.type}
          {tagName && <> · <span style={{ color: tagColor }}>{tagName}</span></>}
          {training.distance_m ? ` · ${(training.distance_m / 1000).toFixed(1)}km` : ''}
        </div>
      </div>
    </button>
  )
}

// ─── CreateTrainingForm ─────────────────────────────────────────────────────


function parsePace(value: string): number | undefined {
  const match = value.match(/^(\d+):(\d{2})$/)
  if (!match) return undefined
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function CreateTrainingForm({ mutating, allTags, allCustomTypes, onBack, onSubmit, onCreateTag, onCreateType }: {
  mutating: boolean
  allTags: Tag[]
  allCustomTypes: TrainingCustomType[]
  onBack: () => void
  onSubmit: (input: NewTrainingInput) => void
  onCreateTag: (name: string, color: string) => Promise<Tag | null>
  onCreateType: (name: string) => Promise<TrainingCustomType | null>
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<string>('corrida')
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

  const [showNewType, setShowNewType] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [creatingType, setCreatingType] = useState(false)
  const [typeError, setTypeError] = useState<string | null>(null)

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    setCreatingTag(true)
    setTagError(null)
    const tag = await onCreateTag(newTagName.trim(), newTagColor)
    setCreatingTag(false)
    if (!tag) { setTagError('Erro ao criar etiqueta'); return }
    setTagId(tag.id)
    setShowNewTag(false)
    setNewTagName('')
  }

  async function handleCreateType() {
    if (!newTypeName.trim()) return
    setCreatingType(true)
    setTypeError(null)
    const customType = await onCreateType(newTypeName.trim())
    setCreatingType(false)
    if (!customType) { setTypeError('Erro ao criar tipo'); return }
    setType(customType.name)
    setShowNewType(false)
    setNewTypeName('')
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
    width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    borderRadius: '7px', padding: '6px 8px', fontSize: '11px', color: 'var(--text-primary)', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.4px', marginBottom: '3px', display: 'block',
  }

  return (
    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--orange)', fontSize: '10px', fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', marginBottom: '2px' }}>
        ← Voltar à busca
      </button>
      <div>
        <label style={labelStyle}>Título *</label>
        <input autoFocus style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Intervalo 400m" />
      </div>
      <div>
        <label style={labelStyle}>Tipo *</label>
        {showNewType ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              style={inputStyle}
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              placeholder="Ex: Fartlek"
            />
            {typeError && (
              <div style={{ fontSize: '10px', color: 'var(--red-accent)', padding: '4px 6px', background: 'var(--red-subtle)', borderRadius: '5px', border: '1px solid var(--red-border)' }}>
                {typeError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => { setShowNewType(false); setTypeError(null) }} style={{ ...inputStyle, textAlign: 'center', cursor: 'pointer', flex: 1, padding: '6px' }}>Cancelar</button>
              <button type="button" onClick={handleCreateType} disabled={creatingType || !newTypeName.trim()} style={{ flex: 1, background: 'var(--orange)', color: 'var(--text-on-brand)', border: 'none', borderRadius: '7px', padding: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                {creatingType ? '...' : 'Criar'}
              </button>
            </div>
          </div>
        ) : (
          <select 
            style={{ ...inputStyle, color: 'var(--orange)', fontWeight: 600 }} 
            value={type} 
            onChange={e => {
              if (e.target.value === 'NEW') setShowNewType(true)
              else setType(e.target.value)
            }}
          >
            <optgroup label="Padrão">
              {TRAINING_TYPE_OPTIONS.map(t => <option key={t} value={t}>{TRAINING_TYPE_LABELS[t]}</option>)}
            </optgroup>
            {allCustomTypes.length > 0 && (
              <optgroup label="Personalizados">
                {allCustomTypes.map(ct => <option key={ct.id} value={ct.name}>{ct.name}</option>)}
              </optgroup>
            )}
            <option value="NEW">+ Criar novo tipo</option>
          </select>
        )}
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
                    width: 20, height: 20, borderRadius: '50%', border: newTagColor === c.hex ? '2px solid var(--text-on-brand)' : '2px solid transparent',
                    background: c.hex, cursor: 'pointer', padding: 0,
                  }}
                  title={c.name}
                />
              ))}
            </div>
            {tagError && (
              <div style={{ fontSize: '10px', color: 'var(--red-accent)', padding: '4px 6px', background: 'var(--red-subtle)', borderRadius: '5px', border: '1px solid var(--red-border)' }}>
                {tagError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => { setShowNewTag(false); setTagError(null) }} style={{ ...inputStyle, textAlign: 'center', cursor: 'pointer', flex: 1 }}>Cancelar</button>
              <button type="button" onClick={handleCreateTag} disabled={creatingTag || !newTagName.trim()} style={{ flex: 1, background: 'var(--orange)', color: 'var(--text-on-brand)', border: 'none', borderRadius: '7px', padding: '6px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                {creatingTag ? '...' : 'Criar'}
              </button>
            </div>
          </div>
        ) : (
          <select style={inputStyle} value={tagId} onChange={e => {
            if (e.target.value === 'NEW') setShowNewTag(true)
            else setTagId(e.target.value)
          }}>
            <option value="">Nenhuma etiqueta</option>
            {allTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            <option value="NEW">+ Criar nova etiqueta</option>
          </select>
        )}
      </div>
      <button
        onClick={handleSubmit}
        disabled={mutating || !title.trim()}
        style={{ background: mutating || !title.trim() ? 'var(--bg-surface)' : 'var(--orange)', color: mutating || !title.trim() ? 'var(--text-secondary)' : 'var(--text-on-brand)', borderRadius: '8px', padding: '9px', textAlign: 'center', fontSize: '11px', fontWeight: 700, cursor: mutating || !title.trim() ? 'not-allowed' : 'pointer', border: '1px solid var(--border-default)', marginTop: '4px' }}
      >
        {mutating ? 'Salvando…' : 'Salvar e adicionar ao dia'}
      </button>
    </div>
  )
}
