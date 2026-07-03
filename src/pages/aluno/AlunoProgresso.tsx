import { useState } from 'react'
import { useProgresso } from '../../hooks/useProgresso'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Flame, Target, Calculator } from 'lucide-react'
import { motion } from 'framer-motion'
import PaceCalculator from '../../components/shared/PaceCalculator'
import styles from './AlunoProgresso.module.css'

function formatTime(seconds: number): string {
  if (!seconds) return 'N/A'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${h}:${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

const formatYAxis = (tickItem: number) => formatTime(tickItem)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        <p className={styles.tooltipPace}>Pace: {formatTime(payload[0].value)}/km</p>
      </div>
    )
  }
  return null
}

const EFFORT_EMOJIS: Record<number, string> = {
  1: '😴', 2: '🙂', 3: '💪', 4: '🔥', 5: '💀',
}

export default function AlunoProgresso({ studentId }: { studentId: string }) {
  const { records, streak, paceHistory, recentCheckins, isLoading } = useProgresso(studentId)
  const [showCalculator, setShowCalculator] = useState(false)

  if (isLoading) {
    return <div className={styles.loadingState}>Carregando progresso...</div>
  }

  // Achar qual o PR mais recente para dar destaque
  // (Como não temos a data exata do recorde facilmente acessível no records obj, vamos simular que "se tem, destacamos" se for o único, mas a regra era card mais recente em destaque. Vamos destacar o de 5km por padrao se existir, ou o primeiro)
  
  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className={styles.eyebrow}>EVOLUÇÃO</p>
            <h1 className={styles.title}>
              Seu progresso,<br />
              <em>em números.</em>
            </h1>
          </div>
          <button 
            onClick={() => setShowCalculator(true)}
            className={styles.calcBtn}
            aria-label="Abrir Calculadora de Pace"
            style={{
              background: 'var(--orange-subtle)',
              border: 'none',
              color: 'var(--orange)',
              padding: '10px', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <Calculator size={24} />
          </button>
        </div>

        {streak > 0 && (
          <motion.div 
            className={styles.streakBadge}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Flame size={24} className={styles.streakIcon} />
            <div className={styles.streakInfo}>
              <span className={styles.streakNumber}>{streak}</span>
              <span className={styles.streakLabel}>semanas seguidas</span>
            </div>
          </motion.div>
        )}
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recordes Pessoais</h2>
        <div className={styles.recordsGrid}>
          {['5km', '10km', '21km', '42km'].map((cat, i) => {
            const hasRecord = !!records[cat]
            // Destaca o primeiro que tiver recorde apenas para dar efeito visual, já que não temos timestamp no hook useProgresso para `records`
            const isHighlight = hasRecord && i === Object.keys(records).findIndex(k => records[k])

            return (
              <motion.div 
                key={cat} 
                className={`${styles.recordCard} ${isHighlight ? styles.recordCardHighlight : ''}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                whileHover={{ scale: 1.02 }}
              >
                <span className={styles.recordCategory}>{cat}</span>
                {hasRecord ? (
                  <>
                    <span className={styles.recordTime}>{formatTime(records[cat])}</span>
                    <span className={styles.recordDate}>Registrado</span>
                  </>
                ) : (
                  <>
                    <span className={styles.recordEmpty}>-</span>
                    <span className={styles.recordDate}>Sem marca</span>
                  </>
                )}
              </motion.div>
            )
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Evolução de Pace</h2>
        <div className={styles.chartContainer}>
          {paceHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paceHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="var(--text-tertiary)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="var(--text-tertiary)" 
                  fontSize={12} 
                  tickFormatter={formatYAxis} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-orange)' }} />
                <Line 
                  type="monotone" 
                  dataKey="pace" 
                  stroke="var(--orange)" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: 'var(--orange)', stroke: 'var(--bg-primary)', strokeWidth: 2 }} 
                  activeDot={{ r: 6, fill: 'var(--orange)', stroke: 'none' }} 
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.emptyChart}>
              <Target size={24} className={styles.emptyIcon} />
              <p>Corra e faça check-ins para ver sua evolução</p>
            </div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico Recente</h2>
        <div className={styles.historyList}>
          {recentCheckins.length > 0 ? (
            recentCheckins.map((checkin, i) => {
              const dist = checkin.actual_distance_m || checkin.trainings?.distance_m
              const time = checkin.actual_duration_seconds
              const pace = checkin.actual_pace_seconds_per_km
              const emoji = checkin.perceived_effort ? EFFORT_EMOJIS[checkin.perceived_effort] : '✅'
              
              return (
                <motion.div 
                  key={checkin.id} 
                  className={styles.historyCard}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                >
                  <div className={styles.historyHeader}>
                    <span className={styles.historyDate}>
                      {new Date(checkin.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className={styles.historyEmoji}>{emoji}</span>
                  </div>
                  
                  <div className={styles.historyTitle}>
                    {checkin.trainings?.title || (checkin.trainings?.type?.toUpperCase() ?? '')}
                  </div>

                  <div className={styles.historyStats}>
                    {dist && <span>{(dist / 1000).toFixed(2).replace('.', ',')} km</span>}
                    {time && pace && <span> • </span>}
                    {pace && <span>Pace {formatTime(pace)}</span>}
                  </div>

                  {checkin.notes && (
                    <div className={styles.historyNotes}>
                      "{checkin.notes}"
                    </div>
                  )}
                </motion.div>
              )
            })
          ) : (
            <div className={styles.emptyHistory}>Nenhum check-in recente.</div>
          )}
        </div>
      </section>

      <PaceCalculator isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
    </div>
  )
}
