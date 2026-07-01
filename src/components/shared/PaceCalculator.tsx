import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Ruler, Activity } from 'lucide-react'
import styles from './PaceCalculator.module.css'

type Tab = 'pace' | 'tempo' | 'distancia'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function PaceCalculator({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('pace')

  // Inputs
  const [distanceKm, setDistanceKm] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')
  const [paceMin, setPaceMin] = useState('')
  const [paceSec, setPaceSec] = useState('')

  // Parsing helpers
  const parseNum = (val: string) => {
    const n = parseFloat(val.replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  const parseIntSafe = (val: string) => {
    const n = parseInt(val, 10)
    return isNaN(n) ? 0 : n
  }

  // Formatting helpers
  const formatTime = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '00:00:00'
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = Math.floor(totalSeconds % 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const formatPace = (totalSecondsPerKm: number) => {
    if (totalSecondsPerKm <= 0) return '0:00'
    const m = Math.floor(totalSecondsPerKm / 60)
    const s = Math.floor(totalSecondsPerKm % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Calculations
  const calcPace = () => {
    const d = parseNum(distanceKm)
    const totalSecs = parseIntSafe(hours) * 3600 + parseIntSafe(minutes) * 60 + parseIntSafe(seconds)
    if (d <= 0 || totalSecs <= 0) return { paceSecs: 0, display: '--:--' }
    const p = totalSecs / d
    return { paceSecs: p, display: formatPace(p) }
  }

  const calcTime = () => {
    const d = parseNum(distanceKm)
    const p = parseIntSafe(paceMin) * 60 + parseIntSafe(paceSec)
    if (d <= 0 || p <= 0) return '--:--:--'
    return formatTime(d * p)
  }

  const calcDistance = () => {
    const totalSecs = parseIntSafe(hours) * 3600 + parseIntSafe(minutes) * 60 + parseIntSafe(seconds)
    const p = parseIntSafe(paceMin) * 60 + parseIntSafe(paceSec)
    if (totalSecs <= 0 || p <= 0) return '--'
    return (totalSecs / p).toFixed(2)
  }

  const calculatedPaceForTable = () => {
    if (activeTab === 'pace') {
      return calcPace().paceSecs
    }
    const p = parseIntSafe(paceMin) * 60 + parseIntSafe(paceSec)
    return p > 0 ? p : 0
  }

  const refPaceSecs = calculatedPaceForTable()
  const speedKmh = refPaceSecs > 0 ? (3600 / refPaceSecs).toFixed(1) : '--'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={styles.overlay} onClick={onClose}>
          <motion.div
            className={styles.modal}
            onClick={e => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div className={styles.handle} />
            
            <div className={styles.header}>
              <h2 className={styles.title}>Calculadora</h2>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
                <X size={24} />
              </button>
            </div>

            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'pace' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('pace')}
              >
                <Activity size={16} /> Pace
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'tempo' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('tempo')}
              >
                <Clock size={16} /> Tempo
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'distancia' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('distancia')}
              >
                <Ruler size={16} /> Distância
              </button>
            </div>

            <div className={styles.content}>
              {/* INPUTS ROW 1 */}
              {activeTab !== 'distancia' && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Distância (km)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    className={styles.input}
                    placeholder="Ex: 5"
                    value={distanceKm}
                    onChange={e => setDistanceKm(e.target.value)}
                  />
                </div>
              )}

              {activeTab !== 'tempo' && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Tempo (hh:mm:ss)</label>
                  <div className={styles.timeInputs}>
                    <input
                      type="number"
                      inputMode="numeric"
                      className={styles.input}
                      placeholder="h"
                      value={hours}
                      onChange={e => setHours(e.target.value)}
                    />
                    <span className={styles.timeColon}>:</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className={styles.input}
                      placeholder="m"
                      value={minutes}
                      onChange={e => setMinutes(e.target.value)}
                    />
                    <span className={styles.timeColon}>:</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className={styles.input}
                      placeholder="s"
                      value={seconds}
                      onChange={e => setSeconds(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {activeTab !== 'pace' && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Pace alvo (min/km)</label>
                  <div className={styles.timeInputs} style={{ width: '60%' }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      className={styles.input}
                      placeholder="m"
                      value={paceMin}
                      onChange={e => setPaceMin(e.target.value)}
                    />
                    <span className={styles.timeColon}>:</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className={styles.input}
                      placeholder="s"
                      value={paceSec}
                      onChange={e => setPaceSec(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* RESULTS */}
              <div className={styles.resultBox}>
                <span className={styles.resultLabel}>
                  {activeTab === 'pace' ? 'Seu Pace é' : activeTab === 'tempo' ? 'Tempo Estimado' : 'Distância Estimada'}
                </span>
                <span className={styles.resultValue}>
                  {activeTab === 'pace' && (
                    <>{calcPace().display} <small className={styles.resultSmall}>min/km</small></>
                  )}
                  {activeTab === 'tempo' && (
                    <>{calcTime()}</>
                  )}
                  {activeTab === 'distancia' && (
                    <>{calcDistance()} <small className={styles.resultSmall}>km</small></>
                  )}
                </span>
              </div>
              
              {/* EXTRAS */}
              <div className={styles.extras}>
                <div className={styles.speedBox}>
                  <span className={styles.speedLabel}>Velocidade Equivalente</span>
                  <span className={styles.speedValue}>{speedKmh} km/h</span>
                </div>
                
                {refPaceSecs > 0 && (
                  <div className={styles.tableBox}>
                    <h4 className={styles.tableTitle}>Tempos de prova neste pace</h4>
                    <div className={styles.tableGrid}>
                      <div className={styles.tableRow}>
                        <span>5 km</span>
                        <strong>{formatTime(5 * refPaceSecs)}</strong>
                      </div>
                      <div className={styles.tableRow}>
                        <span>10 km</span>
                        <strong>{formatTime(10 * refPaceSecs)}</strong>
                      </div>
                      <div className={styles.tableRow}>
                        <span>Meia (21k)</span>
                        <strong>{formatTime(21.0975 * refPaceSecs)}</strong>
                      </div>
                      <div className={styles.tableRow}>
                        <span>Maratona (42k)</span>
                        <strong>{formatTime(42.195 * refPaceSecs)}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
