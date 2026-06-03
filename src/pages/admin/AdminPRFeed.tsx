import { useAdminPRs } from '../../hooks/useAdminPRs';
import { useNavigate } from 'react-router-dom';
import styles from './AdminPRFeed.module.css';

function formatTime(seconds: number): string {
  if (!seconds) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}:${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AdminPRFeed() {
  const { prs, isLoading } = useAdminPRs(5);
  const navigate = useNavigate();

  if (isLoading) {
    return <div className={styles.loading}>Carregando recordes...</div>;
  }

  if (prs.length === 0) {
    return <div className={styles.empty}>Nenhum recorde recente.</div>;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>🔥 Recordes Recentes</h3>
      <div className={styles.feed}>
        {prs.map(pr => (
          <div 
            key={pr.id} 
            className={styles.card}
            onClick={() => navigate(`/admin/alunos/${pr.student_id}`)}
          >
            <div className={styles.avatar}>
              {pr.profiles?.avatar_url ? (
                <img src={pr.profiles.avatar_url} alt="Avatar" />
              ) : (
                <div className={styles.avatarFallback}>
                  {pr.profiles?.full_name?.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
            </div>
            <div className={styles.info}>
              <div className={styles.header}>
                <span className={styles.name}>{pr.profiles?.full_name || 'Aluno Anônimo'}</span>
                <span className={styles.date}>
                  {new Date(pr.achieved_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              </div>
              <div className={styles.recordBadge}>
                Bateu PR de <span className={styles.highlight}>{pr.distance_category}</span> com o tempo de <span className={styles.highlight}>{formatTime(pr.time_seconds)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
