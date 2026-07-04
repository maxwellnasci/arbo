import { useState } from 'react'
import { useAlunoPerfil } from '../../hooks/useAlunoPerfil'
import { useStravaConnection } from '../../hooks/useStravaConnection'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, Activity, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import styles from './AlunoPerfil.module.css'

function formatPace(secondsPerKm: number | null) {
  if (!secondsPerKm) return '--:--'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatActivityDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function AlunoPerfil({ studentId, isPreview }: { studentId: string, isPreview?: boolean }) {
  const { perfil, isLoading } = useAlunoPerfil(studentId)
  const {
    isConnected,
    activities,
    isLoading: isStravaLoading,
    isSyncing,
    syncActivities,
    disconnect,
  } = useStravaConnection()
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
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
          whileHover={{ scale: 1.01 }}
        >
          <div className={styles.stravaIconWrapper}>
            <Activity className={styles.stravaIcon} size={24} />
          </div>
          <div className={styles.stravaContent}>
            <span className={styles.stravaTitle}>Strava</span>
            <span className={styles.stravaSubtitle}>
              {isStravaLoading ? 'Verificando...' : isConnected ? 'Conectado' : 'Não conectado'}
            </span>
          </div>
          {!isStravaLoading && (
            isConnected ? (
              <button className={styles.stravaBtn} onClick={() => setShowDisconnectConfirm(true)}>
                Desconectar
              </button>
            ) : (
              <button className={styles.stravaBtn} onClick={handleStravaConnect}>
                Conectar
              </button>
            )
          )}
        </motion.div>

        {isConnected && (
          <>
            <button className={styles.syncBtn} onClick={handleSync} disabled={isSyncing}>
              <RefreshCw size={14} className={isSyncing ? styles.spinning : undefined} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar atividades'}
            </button>

            {activities.length > 0 && (
              <div className={styles.activitiesList}>
                {activities.map(activity => (
                  <div key={activity.id} className={styles.activityRow}>
                    <div className={styles.activityInfo}>
                      <span className={styles.activityName}>{activity.name}</span>
                      <span className={styles.activityMeta}>
                        {activity.distanceKm} km · {formatPace(activity.paceSecondsPerKm)} /km
                      </span>
                    </div>
                    <span className={styles.activityDate}>{formatActivityDate(activity.date)}</span>
                  </div>
                ))}
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
