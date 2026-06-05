import { useAlunoPerfil } from '../../hooks/useAlunoPerfil'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { LogOut, Activity } from 'lucide-react'
import { motion } from 'framer-motion'
import styles from './AlunoPerfil.module.css'

export default function AlunoPerfil({ studentId }: { studentId: string }) {
  const { perfil, isLoading } = useAlunoPerfil(studentId)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleStravaConnect = () => {
    // Integração futura via Edge Function / n8n
    alert('Integração com Strava via n8n será implementada em breve!')
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
            <span className={styles.stravaTitle}>Conectar Strava</span>
            <span className={styles.stravaSubtitle}>Em breve</span>
          </div>
          <button 
            className={styles.stravaBtn}
            onClick={handleStravaConnect}
            disabled={perfil.strava_connected}
          >
            {perfil.strava_connected ? 'Conectado' : 'Conectar'}
          </button>
        </motion.div>
      </section>

      <section className={styles.section}>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={18} />
          Sair da Conta
        </button>
      </section>
    </div>
  )
}
