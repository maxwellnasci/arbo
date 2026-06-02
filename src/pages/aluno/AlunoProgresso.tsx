import { useProgresso } from '../../hooks/useProgresso';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import styles from './AlunoProgresso.module.css';

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

const formatYAxis = (tickItem: number) => formatTime(tickItem);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        <p className={styles.tooltipPace}>Pace: {formatTime(payload[0].value)}/km</p>
      </div>
    );
  }
  return null;
};

export default function AlunoProgresso({ studentId }: { studentId: string }) {
  const { records, streak, paceHistory, recentCheckins, isLoading } = useProgresso(studentId);

  if (isLoading) {
    return <div className={styles.loadingState}>Carregando progresso...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Seu Progresso</h1>
        {streak > 0 && (
          <div className={styles.streakBadge}>
            🔥 {streak} {streak === 1 ? 'Semana Seguida' : 'Semanas Seguidas'}
          </div>
        )}
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recordes Pessoais</h2>
        <div className={styles.recordsGrid}>
          {['5km', '10km', '21km', '42km'].map((cat) => (
            <div key={cat} className={styles.recordCard}>
              <span className={styles.recordCategory}>{cat}</span>
              <span className={records[cat] ? styles.recordTime : styles.recordEmpty}>
                {formatTime(records[cat])}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Evolução de Pace</h2>
        <div className={styles.chartContainer}>
          {paceHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paceHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="#71717a" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={12} 
                  tickFormatter={formatYAxis} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="pace" 
                  stroke="#E8521A" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#09090b', stroke: '#E8521A', strokeWidth: 2 }} 
                  activeDot={{ r: 6, fill: '#E8521A' }} 
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.emptyChart}>Corra e faça check-ins para ver sua evolução</div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico Recente</h2>
        <div className={styles.historyList}>
          {recentCheckins.length > 0 ? (
            recentCheckins.map((checkin) => {
              const dist = checkin.actual_distance_m || checkin.trainings?.distance_m;
              const time = checkin.actual_duration_seconds;
              return (
                <div key={checkin.id} className={styles.historyItem}>
                  <div className={styles.historyIcon}>✅</div>
                  <div className={styles.historyDetails}>
                    <div className={styles.historyType}>
                      {checkin.trainings?.type.toUpperCase()}
                    </div>
                    <div className={styles.historyStats}>
                      {dist ? `${(dist / 1000).toFixed(2)} km` : 'N/D'} • {time ? formatTime(time) : 'N/D'}
                    </div>
                  </div>
                  <div className={styles.historyDate}>
                    {new Date(checkin.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.emptyHistory}>Nenhum check-in recente.</div>
          )}
        </div>
      </section>
    </div>
  );
}
