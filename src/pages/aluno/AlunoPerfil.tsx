import { useAlunoPerfil } from '../../hooks/useAlunoPerfil';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import styles from './AlunoPerfil.module.css';

export default function AlunoPerfil({ studentId }: { studentId: string }) {
  const { perfil, isLoading } = useAlunoPerfil(studentId);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleStravaConnect = () => {
    // Integração futura via Edge Function / n8n
    alert('Integração com Strava via n8n será implementada em breve!');
  };

  if (isLoading) {
    return <div className={styles.loading}>Carregando perfil...</div>;
  }

  if (!perfil) {
    return <div className={styles.error}>Perfil não encontrado.</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.avatarWrapper}>
          {perfil.avatar_url ? (
            <img src={perfil.avatar_url} alt="Avatar" className={styles.avatarImg} />
          ) : (
            <div className={styles.avatarFallback}>
              {perfil.full_name?.charAt(0).toUpperCase() || 'A'}
            </div>
          )}
        </div>
        <h1 className={styles.name}>{perfil.full_name || 'Aluno'}</h1>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Seus Dados</h2>
        <div className={styles.infoCard}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Nível</span>
            <span className={styles.infoValue}>{perfil.level ? perfil.level.toUpperCase() : 'Não definido'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Equipe / Turma</span>
            <span className={styles.infoValue}>{perfil.groups?.name || 'Individual'}</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Conexões</h2>
        <div className={styles.stravaCard}>
          <div className={styles.stravaInfo}>
            <span className={styles.stravaTitle}>Strava</span>
            <span className={styles.stravaStatus}>
              {perfil.strava_connected ? '✅ Conectado' : 'Não conectado'}
            </span>
          </div>
          <button 
            className={styles.stravaButton} 
            onClick={handleStravaConnect}
            disabled={perfil.strava_connected}
          >
            {perfil.strava_connected ? 'Conectado' : 'Conectar Strava'}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <button className={styles.logoutButton} onClick={handleLogout}>
          Sair da Conta
        </button>
      </section>
    </div>
  );
}
