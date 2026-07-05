import { useState } from 'react'
import { useAlunoPerfil } from '../../hooks/useAlunoPerfil'
import { useStravaConnection } from '../../hooks/useStravaConnection'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, Activity, RefreshCw, Footprints, Bot, BarChart3, Lightbulb, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import styles from './AlunoPerfil.module.css'

const ACTIVITIES_PREVIEW_COUNT = 5

function formatPace(secondsPerKm: number | null) {
  if (!secondsPerKm) return '--:--'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatActivityDate(iso: string) {
  const date = new Date(iso)
  const weekday = format(date, 'EEEE', { locale: ptBR }).replace('-feira', '')
  const dayMonth = format(date, 'd MMM', { locale: ptBR })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dayMonth}`
}

function formatConnectedDate(iso: string) {
  return format(new Date(iso), "d 'de' MMM 'de' yyyy", { locale: ptBR })
}

export default function AlunoPerfil({ studentId, isPreview }: { studentId: string, isPreview?: boolean }) {
  const { perfil, isLoading } = useAlunoPerfil(studentId)
  const {
    isConnected,
    connectedAt,
    activities,
    isLoading: isStravaLoading,
    isLoadingActivities,
    isSyncing,
    latestAnalysis,
    isAnalyzing,
    syncActivities,
    disconnect,
  } = useStravaConnection()
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [showAllActivities, setShowAllActivities] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleStravaConnect = () => {
    const state = crypto.randomUUID()
    sessionStorage.setItem('arbo_strava_state', state)
    window.location.href = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-auth?state=${state}`
  }

  const handleSync = async () => {
    const ok = await syncActivities()
    if (ok) toast.success('Atividades sincronizadas!')
    else toast.error('Erro ao sincronizar com o Strava.')
  }

  const handleDisconnect = async () => {
    setShowDisconnectConfirm(false)
    const ok = await disconnect()
    if (ok) toast.success('Strava desconectado.')
    else toast.error('Erro ao desconectar do Strava.')
  }

  if (isLoading) {
    return <div className={styles.loading}>Carregando perfil...</div>
  }

  if (!perfil) {
    return <div className={styles.error}>Perfil não encontrado.</div>
  }

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <motion.div 
          className={styles.avatarWrapper}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {perfil.avatar_url ? (
            <img src={perfil.avatar_url} alt="Avatar" className={styles.avatarImg} />
          ) : (
            <div className={styles.avatarFallback}>
              {perfil.full_name?.substring(0, 2).toUpperCase() || 'A'}
            </div>
          )}
        </motion.div>
        <h1 className={styles.name}>{perfil.full_name || 'Aluno'}</h1>
        
        <div className={styles.pills}>
          {perfil.level && (
            <span className={styles.levelPill}>{perfil.level.toUpperCase()}</span>
          )}
          {perfil.groups?.name && (
            <span className={styles.groupPill}>{perfil.groups.name}</span>
          )}
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Informações</h2>
        <div className={styles.infoCard}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Nível de Experiência</span>
            <span className={styles.infoValue}>{perfil.level ? perfil.level.toUpperCase() : 'Não definido'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Equipe / Turma</span>
            <span className={styles.infoValue}>{perfil.groups?.name || 'Plano Individual'}</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Aplicativos</h2>
        <motion.div
          className={styles.stravaCard}
          whileHover={{ scale: 1.005 }}
        >
          <div className={styles.stravaCardHeader}>
            <div className={styles.stravaIconWrapper}>
              <Activity className={styles.stravaIcon} size={22} />
            </div>
            <div className={styles.stravaContent}>
              <div className={styles.stravaTitleRow}>
                <span className={styles.stravaTitle}>Strava</span>
                {!isStravaLoading && (
                  <span className={isConnected ? styles.statusBadgeConnected : styles.statusBadgeDisconnected}>
                    {isConnected ? 'Conectado' : 'Desconectado'}
                  </span>
                )}
              </div>
              <span className={styles.stravaSubtitle}>
                {isStravaLoading
                  ? 'Verificando...'
                  : isConnected
                    ? connectedAt ? `Desde ${formatConnectedDate(connectedAt)}` : 'Sincronizando suas corridas'
                    : 'Conecte para sincronizar corridas automaticamente'}
              </span>
            </div>
          </div>

          {!isStravaLoading && !isConnected && (
            <button className={styles.stravaConnectBtn} onClick={handleStravaConnect}>
              Conectar com Strava
            </button>
          )}
        </motion.div>

        {isConnected && (
          <>
            <div className={styles.stravaActions}>
              <button className={styles.syncBtn} onClick={handleSync} disabled={isSyncing}>
                <RefreshCw size={14} className={isSyncing ? styles.spinning : undefined} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar atividades'}
              </button>
              <button className={styles.disconnectBtn} onClick={() => setShowDisconnectConfirm(true)}>
                Desconectar
              </button>
            </div>

            {isLoadingActivities ? (
              <div className={styles.activitiesEmpty}>
                <span>Carregando atividades...</span>
              </div>
            ) : activities.length > 0 ? (
              <>
                <div className={styles.activitiesList}>
                  {(showAllActivities ? activities : activities.slice(0, ACTIVITIES_PREVIEW_COUNT)).map(activity => (
                    <div key={activity.id} className={styles.activityRow}>
                      <div className={styles.activityIconWrapper}>
                        <Footprints size={16} />
                      </div>
                      <div className={styles.activityInfo}>
                        <span className={styles.activityName}>{activity.name}</span>
                        <span className={styles.activityMeta}>
                          {formatActivityDate(activity.date)} · {activity.distanceKm} km · {formatPace(activity.paceSecondsPerKm)} /km · {formatDuration(activity.durationSeconds)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {activities.length > ACTIVITIES_PREVIEW_COUNT && (
                  <button className={styles.seeMoreBtn} onClick={() => setShowAllActivities(v => !v)}>
                    {showAllActivities ? 'Ver menos' : `Ver mais (${activities.length - ACTIVITIES_PREVIEW_COUNT})`}
                  </button>
                )}
              </>
            ) : (
              <div className={styles.activitiesEmpty}>
                <Footprints size={20} />
                <span>Nenhuma atividade sincronizada ainda.</span>
              </div>
            )}

            {(isAnalyzing || latestAnalysis) && (
              <div className={styles.analysisCard}>
                <div className={styles.analysisHeader}>
                  <Bot size={16} />
                  <span>Análise do seu último treino</span>
                </div>
                {isAnalyzing && !latestAnalysis ? (
                  <span className={styles.analysisLoading}>Analisando sua última corrida...</span>
                ) : latestAnalysis && (
                  <div className={styles.analysisBody}>
                    <div className={styles.analysisRow}>
                      <BarChart3 size={14} />
                      <span>{latestAnalysis.summary}</span>
                    </div>
                    <div className={styles.analysisRow}>
                      <Lightbulb size={14} />
                      <span>{latestAnalysis.analysis}</span>
                    </div>
                    <div className={styles.analysisRow}>
                      <Target size={14} />
                      <span>{latestAnalysis.tip}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <ConfirmModal
        isOpen={showDisconnectConfirm}
        title="Desconectar Strava?"
        description="Suas atividades sincronizadas continuam salvas, mas o app para de buscar novas atividades até você conectar de novo."
        confirmText="Desconectar"
        type="warning"
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnectConfirm(false)}
      />

      {!isPreview && (
        <section className={styles.section}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={18} />
            Sair da Conta
          </button>
        </section>
      )}
    </div>
  )
}
