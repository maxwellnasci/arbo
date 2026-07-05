import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAdminAlunoDetail } from '../../hooks/useAdminAlunoDetail'
import { useAdminStravaActivities } from '../../hooks/useAdminStravaActivities'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { MessageSquare, RefreshCw, ChevronLeft, Trash2, Pencil, Footprints, Bot, BarChart3, Lightbulb, Target } from 'lucide-react'
import styles from './AdminAlunoDetail.module.css'
import AdminChatPanel from '../../components/admin/AdminChatPanel'
import { supabase } from '../../lib/supabase'

const levelLabel: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

const effortEmoji: Record<number, string> = { 1: '😴', 2: '😌', 3: '😊', 4: '😤', 5: '🥵' }
const typeLabel: Record<string, string> = {
  corrida: 'Corrida', hiit: 'HIIT', recovery: 'Recuperação',
  forca: 'Força', mobilidade: 'Mobilidade',
}
const DISTANCES = ['1km', '5km', '10km', '21km', '42km'] as const

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

function formatTimeRecord(seconds: number | null): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatStravaDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AdminAlunoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, group, checkins, records, anamnesis, allGroups, metrics, isLoading, error, changeGroup, updateName, email } = useAdminAlunoDetail(id)
  const {
    activities: stravaActivities,
    isLoading: isStravaLoading,
    error: stravaError,
    notConnected: stravaNotConnected,
    latestAnalysis: stravaLatestAnalysis,
    sync: syncStravaActivities,
  } = useAdminStravaActivities(id)

  const [activeTab, setActiveTab] = useState<'checkins' | 'records' | 'anamnesis'>('checkins')
  const [isChangingGroup, setIsChangingGroup] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [isEditingName, setIsEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)

  async function handleSaveName() {
    if (!id || !newName.trim()) return
    setIsSavingName(true)
    try {
      await updateName(newName.trim())
      setIsEditingName(false)
      toast.success('Nome atualizado!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar nome.')
    } finally {
      setIsSavingName(false)
    }
  }

  async function handleDeleteAluno() {
    if (!id) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: id }),
        },
      )
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Erro ao excluir aluno.')
      }
      toast.success('Aluno removido')
      navigate('/admin/alunos')
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Erro ao excluir aluno')
      setIsDeleting(false)
    }
  }

  const handleSyncStrava = async () => {
    const ok = await syncStravaActivities()
    if (ok) toast.success('Atividades do Strava sincronizadas!')
  }

  if (isLoading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Carregando dados do aluno...</p>
  }

  if (error || !profile) {
    return (
      <div>
        <button onClick={() => navigate('/admin/alunos')} className={styles.btn} style={{ marginBottom: 16, border: 'none', background: 'transparent' }}>
          <ChevronLeft size={18} /> Voltar
        </button>
        <p style={{ color: 'var(--red-accent)' }}>{error || 'Aluno não encontrado.'}</p>
      </div>
    )
  }

  const initials = (profile.full_name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  const memberSince = profile.created_at 
    ? format(new Date(profile.created_at), "MMM yyyy", { locale: ptBR })
    : '—'

  const handleGroupChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setIsChangingGroup(true)
    try {
      await changeGroup(val === 'null' ? null : val)
      toast.success('Turma atualizada!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar turma.')
    } finally {
      setIsChangingGroup(false)
    }
  }

  return (
    <motion.div className={styles.page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: -8 }}>
        <button onClick={() => navigate('/admin/alunos')} style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14 }}>
          <ChevronLeft size={18} /> Alunos
        </button>
      </div>

      {/* Header Profile */}
      <div className={styles.header}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.info}>
          {isEditingName ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                style={{ 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border-color)', 
                  color: 'var(--text-primary)', 
                  padding: '6px 12px', 
                  borderRadius: 'var(--border-radius-sm)', 
                  outline: 'none',
                  fontSize: '18px',
                  fontWeight: 700,
                  width: '100%',
                  maxWidth: '300px'
                }}
                disabled={isSavingName}
                autoFocus
              />
              <button 
                onClick={handleSaveName}
                disabled={isSavingName}
                style={{ 
                  background: 'var(--orange)', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '6px 12px', 
                  borderRadius: 'var(--border-radius-sm)', 
                  cursor: 'pointer', 
                  fontWeight: 600, 
                  fontSize: 13 
                }}
              >
                Salvar
              </button>
              <button 
                onClick={() => setIsEditingName(false)}
                disabled={isSavingName}
                style={{ 
                  background: 'transparent', 
                  color: 'var(--text-secondary)', 
                  border: 'none', 
                  padding: '6px 12px', 
                  cursor: 'pointer', 
                  fontWeight: 600, 
                  fontSize: 13 
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <h1 className={styles.name} style={{ marginBottom: 0 }}>
                {profile.full_name || 'Novo Aluno (sem nome)'}
              </h1>
              <button 
                onClick={() => { setNewName(profile.full_name || ''); setIsEditingName(true) }} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  cursor: 'pointer', 
                  display: 'flex',
                  padding: 4
                }}
                title="Editar Nome"
              >
                <Pencil size={16} />
              </button>
            </div>
          )}
          {email && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600 }}>Email:</span> {email}
            </div>
          )}
          <div className={styles.subtitle}>
            <span>{profile.level ? levelLabel[profile.level] ?? profile.level : 'Nível não definido'}</span>
            <span>·</span>
            <span className={styles.badge}>{group?.name || 'Sem turma'}</span>
            <span>·</span>
            <span>Membro desde {memberSince}</span>
          </div>
          <div className={styles.actions}>
            <div style={{ position: 'relative' }}>
              <select 
                value={profile.group_id || 'null'} 
                onChange={handleGroupChange}
                disabled={isChangingGroup}
                className={styles.btn}
                style={{ appearance: 'none', paddingRight: 32, cursor: isChangingGroup ? 'not-allowed' : 'pointer' }}
              >
                <option value="null">Sem turma</option>
                {allGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <RefreshCw size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} />
            </div>
            <button className={styles.btn} onClick={() => setIsChatOpen(true)}>
              <MessageSquare size={16} /> Mensagem
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className={styles.metrics}>
        <motion.div className={styles.metricCard} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className={styles.metricValue}>{metrics.totalCheckins}</div>
          <div className={styles.metricLabel}>Check-ins Total</div>
        </motion.div>
        <motion.div className={styles.metricCard} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className={styles.metricValue}>{metrics.totalRecords}</div>
          <div className={styles.metricLabel}>Recordes Pessoais</div>
        </motion.div>
        <motion.div className={styles.metricCard} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className={styles.metricValue} style={{ color: 'var(--orange)' }}>{formatPace(metrics.bestPace).replace('/km', '')}</div>
          <div className={styles.metricLabel}>Melhor Pace</div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div>
        <div className={styles.tabs}>
          {(['checkins', 'records', 'anamnesis'] as const).map(t => (
            <button 
              key={t}
              onClick={() => setActiveTab(t)}
              className={`${styles.tabBtn} ${activeTab === t ? styles.tabBtnActive : ''}`}
            >
              {t === 'checkins' ? 'Check-ins' : t === 'records' ? 'Recordes' : 'Anamnese'}
              {activeTab === t && <motion.div layoutId="tabIndicator" className={styles.tabIndicator} />}
            </button>
          ))}
        </div>

        {/* Tab Content: Checkins */}
        {activeTab === 'checkins' && (
          <div className={styles.checkinList}>
            {checkins.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 32 }}>Nenhum check-in registrado.</p>
            ) : (
              checkins.map(c => {
                const isPR = records.some(r => r.checkin_id === c.id || (r.student_id === c.student_id && r.created_at?.slice(0, 10) === c.created_at?.slice(0, 10)))
                const tType = c.trainings?.type ? (typeLabel[c.trainings.type] ?? c.trainings.type) : 'Treino'
                
                return (
                  <div key={c.id} className={styles.checkinCard}>
                    <div className={styles.checkinHeader}>
                      <div className={styles.checkinTitle}>
                        🏃 {tType} {c.trainings?.title ? `— ${c.trainings.title}` : ''}
                      </div>
                      {isPR && <span className={styles.prBadge}>🏆 PR</span>}
                    </div>
                    <div className={styles.checkinMeta}>
                      <span>{c.created_at ? format(new Date(c.created_at), "dd MMM yyyy", { locale: ptBR }) : '—'}</span>
                      {c.actual_distance_m && <span>{formatDistance(c.actual_distance_m)}</span>}
                      {c.actual_pace_seconds_per_km && <span>Pace: {formatPace(c.actual_pace_seconds_per_km)}</span>}
                      {c.actual_duration_seconds && <span>Duração: {formatDuration(c.actual_duration_seconds)}</span>}
                      {c.perceived_effort && <span>Esforço: {effortEmoji[c.perceived_effort]} {c.perceived_effort}/5</span>}
                    </div>
                    {c.notes && <div className={styles.checkinNotes}>"{c.notes}"</div>}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Tab Content: Records */}
        {activeTab === 'records' && (
          <div className={styles.recordGrid}>
            {DISTANCES.map(cat => {
              const rec = records.find(r => r.distance_category === cat)
              return (
                <div key={cat} className={styles.recordCard}>
                  <div className={styles.recordDist}>{cat}</div>
                  <div className={styles.recordTime} style={{ color: rec ? 'var(--orange)' : 'var(--text-tertiary)' }}>
                    {rec ? formatTimeRecord(rec.time_seconds) : '—'}
                  </div>
                  <div className={styles.recordDate}>
                    {rec?.created_at ? format(new Date(rec.created_at), "dd MMM yyyy", { locale: ptBR }) : 'Sem recorde'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tab Content: Anamnesis */}
        {activeTab === 'anamnesis' && (
          <div className={styles.anamnesisList}>
            {!anamnesis ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 16 }}>Anamnese não preenchida.</p>
            ) : (
              <>
                <div className={styles.anamnesisRow}>
                  <span className={styles.anamnesisLabel}>Peso</span>
                  <span className={styles.anamnesisValue}>{anamnesis.weight_kg ? `${anamnesis.weight_kg} kg` : '—'}</span>
                </div>
                <div className={styles.anamnesisRow}>
                  <span className={styles.anamnesisLabel}>Altura</span>
                  <span className={styles.anamnesisValue}>{anamnesis.height_cm ? `${anamnesis.height_cm} cm` : '—'}</span>
                </div>
                <div className={styles.anamnesisRow}>
                  <span className={styles.anamnesisLabel}>Freq. Semanal</span>
                  <span className={styles.anamnesisValue}>{anamnesis.weekly_frequency ? `${anamnesis.weekly_frequency}x` : '—'}</span>
                </div>
                <div className={styles.anamnesisRow}>
                  <span className={styles.anamnesisLabel}>Exp. (anos)</span>
                  <span className={styles.anamnesisValue}>{anamnesis.experience_years || '—'}</span>
                </div>
                <div className={styles.anamnesisRow}>
                  <span className={styles.anamnesisLabel}>FC Máx</span>
                  <span className={styles.anamnesisValue}>{anamnesis.max_heart_rate ? `${anamnesis.max_heart_rate} bpm` : '—'}</span>
                </div>
                <div className={styles.anamnesisRow}>
                  <span className={styles.anamnesisLabel}>Limitações</span>
                  <span className={styles.anamnesisValue}>{anamnesis.physical_limitations || 'Nenhuma'}</span>
                </div>
                <div className={styles.anamnesisRow}>
                  <span className={styles.anamnesisLabel}>Objetivos</span>
                  <span className={styles.anamnesisValue}>{anamnesis.objectives?.join(', ') || '—'}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Atividades Strava */}
      <div className={styles.stravaSection}>
        <div className={styles.stravaSectionHeader}>
          <h3 className={styles.stravaSectionTitle}>
            <Footprints size={16} /> Atividades Strava
          </h3>
          {!stravaNotConnected && (
            <button className={styles.stravaSyncBtn} onClick={handleSyncStrava} disabled={isStravaLoading}>
              <RefreshCw size={14} className={isStravaLoading ? styles.spinning : undefined} />
              {isStravaLoading ? 'Sincronizando...' : 'Sincronizar atividades'}
            </button>
          )}
        </div>

        {stravaNotConnected ? (
          <p className={styles.stravaEmptyState}>Aluno não conectou o Strava ainda.</p>
        ) : stravaError ? (
          <p style={{ color: 'var(--red-accent)', fontSize: 13 }}>{stravaError}</p>
        ) : isStravaLoading && stravaActivities.length === 0 ? (
          <p className={styles.stravaEmptyState}>Verificando conexão com o Strava...</p>
        ) : stravaActivities.length === 0 ? (
          <p className={styles.stravaEmptyState}>Nenhuma atividade sincronizada ainda.</p>
        ) : (
          <div className={styles.stravaActivityList}>
            {stravaActivities.map(activity => (
              <div key={activity.id} className={styles.stravaActivityCard}>
                <div className={styles.stravaActivityHeader}>
                  <span className={styles.stravaActivityName}>{activity.name}</span>
                  <span className={styles.stravaActivityDate}>
                    {format(new Date(activity.date), "dd MMM yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className={styles.stravaActivityMeta}>
                  <span>{activity.distanceKm} km</span>
                  <span>Pace: {formatPace(activity.paceSecondsPerKm)}</span>
                  <span>Duração: {formatStravaDuration(activity.durationSeconds)}</span>
                </div>
                <textarea
                  className={styles.stravaFeedbackInput}
                  placeholder="Feedback do professor sobre esta atividade..."
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}

        {stravaLatestAnalysis && (
          <div className={styles.analysisCard}>
            <div className={styles.analysisHeader}>
              <Bot size={16} />
              <span>Última análise automática</span>
            </div>
            <div className={styles.analysisBody}>
              <div className={styles.analysisRow}>
                <BarChart3 size={14} />
                <span>{stravaLatestAnalysis.summary}</span>
              </div>
              <div className={styles.analysisRow}>
                <Lightbulb size={14} />
                <span>{stravaLatestAnalysis.analysis}</span>
              </div>
              <div className={styles.analysisRow}>
                <Target size={14} />
                <span>{stravaLatestAnalysis.tip}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid rgba(220, 38, 38, 0.2)',
        borderRadius: '16px',
        padding: '24px',
        marginTop: '8px',
      }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>
          Zona de perigo
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5 }}>
          Excluir o aluno remove permanentemente todos os dados do sistema.
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
          Excluir aluno
        </button>
      </div>

      <AdminChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        studentId={id || ''}
        studentName={profile.full_name || 'Aluno'}
      />

      {/* Delete confirmation modal */}
      {showDeleteModal && (
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
            maxWidth: '400px',
            width: '100%',
          }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>
              Excluir aluno?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, margin: '0 0 24px' }}>
              Esta ação é irreversível. Todos os dados do aluno serão removidos.
            </p>
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
                onClick={() => { setShowDeleteModal(false); setDeleteError(null) }}
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
                onClick={handleDeleteAluno}
                disabled={isDeleting}
                style={{
                  flex: 1, background: 'var(--red-accent)', color: 'var(--text-on-brand)',
                  border: 'none', borderRadius: '12px',
                  padding: '12px', fontWeight: 700, fontSize: '14px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
