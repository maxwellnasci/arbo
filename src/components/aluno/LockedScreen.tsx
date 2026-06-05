import { Lock } from 'lucide-react'
import type { LastWeekSummary } from '../../hooks/useWeeklyPlan'
import styles from './LockedScreen.module.css'

export default function LockedScreen({ lockedWeekNumber, lastWeekSummary }: {
  lockedWeekNumber: number
  lastWeekSummary: LastWeekSummary | null
}) {
  function formatPace(secondsPerKm: number | null): string | null {
    if (secondsPerKm == null) return null
    const min = Math.floor(secondsPerKm / 60)
    const sec = String(secondsPerKm % 60).padStart(2, '0')
    return `${min}:${sec}/km`
  }

  return (
    <div className={styles.container}>
      {/* Semana 2+: resumo da semana anterior (só se tiver check-ins) */}
      {lastWeekSummary !== null && lastWeekSummary.checkinCount > 0 && (
        <div className={styles.lastWeek}>
          <div className={styles.lastWeekTitle}>
            Semana {lockedWeekNumber - 1} concluída ✓
          </div>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{lastWeekSummary.checkinCount}</span>
              <span className={styles.metricLabel}>treinos</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{(lastWeekSummary.totalDistanceM / 1000).toFixed(0)}</span>
              <span className={styles.metricLabel}>km</span>
            </div>
            {lastWeekSummary.avgPaceSecondsPerKm !== null && (
              <div className={styles.metric}>
                <span className={styles.metricValue}>{formatPace(lastWeekSummary.avgPaceSecondsPerKm)}</span>
                <span className={styles.metricLabel}>pace médio</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hero Bloqueado Principal */}
      <div className={styles.lockedHero}>
        <Lock className={styles.lockIcon} size={48} />
        <p className={styles.lockedTitle}>
          Conteúdo <em>bloqueado.</em>
        </p>
        <p className={styles.lockedSubtitle}>
          {lastWeekSummary === null 
            ? "Seu professor está preparando o plano da primeira semana."
            : `Seu professor está preparando a semana ${lockedWeekNumber}. Em breve! 💪`}
        </p>
      </div>

      {/* Barra de progresso do ciclo S1–S4 */}
      <div className={styles.cycle}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} className={styles.cycleItem}>
            <div className={`${styles.cycleBar} ${
              n < lockedWeekNumber ? styles.cycleBarDone :
              n === lockedWeekNumber ? styles.cycleBarCurrent :
              styles.cycleBarFuture
            }`} />
            <span className={`${styles.cycleLabel} ${
              n < lockedWeekNumber ? styles.cycleLabelDone :
              n === lockedWeekNumber ? styles.cycleLabelCurrent :
              styles.cycleLabelFuture
            }`}>S{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
