import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAdminAlunoDetail } from '../../hooks/useAdminAlunoDetail'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { MessageSquare, RefreshCw, ChevronLeft } from 'lucide-react'
import styles from './AdminAlunoDetail.module.css'
import AdminChatPanel from '../../components/admin/AdminChatPanel'

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

export default function AdminAlunoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, group, checkins, records, anamnesis, allGroups, metrics, isLoading, error, changeGroup } = useAdminAlunoDetail(id)
  
  const [activeTab, setActiveTab] = useState<'checkins' | 'records' | 'anamnesis'>('checkins')
  const [isChangingGroup, setIsChangingGroup] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  if (isLoading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Carregando dados do aluno...</p>
  }

  if (error || !profile) {
    return (
      <div>
        <button onClick={() => navigate('/admin/alunos')} className={styles.btn} style={{ marginBottom: 16, border: 'none', background: 'transparent' }}>
          <ChevronLeft size={18} /> Voltar
        </button>
        <p style={{ color: '#ff6b6b' }}>{error || 'Aluno não encontrado.'}</p>
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
          <h1 className={styles.name}>{profile.full_name || '(sem nome)'}</h1>
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
              <RefreshCw size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#a1a1aa' }} />
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

      <AdminChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        studentId={id || ''}
        studentName={profile.full_name || 'Aluno'}
      />
    </motion.div>
  )
}
