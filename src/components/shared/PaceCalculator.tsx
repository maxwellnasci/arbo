import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Ruler, Activity } from 'lucide-react'
import styles from './PaceCalculator.module.css'

type Tab = 'pace' | 'tempo' | 'distancia'
type Mode = 'basico' | 'zonas'
type ZoneColor = 'green' | 'greenDark' | 'yellow' | 'orange' | 'red'

type Zone = {
  key: string
  label: string
  desc: string
  minFactor: number
  maxFactor: number
  color: ZoneColor
}

const ZONES: Zone[] = [
  { key: 'z1', label: 'Z1 — Regenerativo', desc: 'Muito fácil, dá pra conversar sem esforço', minFactor: 1.35, maxFactor: 1.40, color: 'green' },
  { key: 'z2', label: 'Z2 — Base Aeróbica', desc: 'Fácil, ritmo de corrida longa', minFactor: 1.15, maxFactor: 1.25, color: 'greenDark' },
  { key: 'z3', label: 'Z3 — Moderado', desc: 'Moderado, começa a ficar difícil conversar', minFactor: 1.05, maxFactor: 1.10, color: 'yellow' },
  { key: 'z4', label: 'Z4 — Limiar', desc: 'Forte, ritmo de prova de 10km', minFactor: 0.95, maxFactor: 1.05, color: 'orange' },
  { key: 'z5', label: 'Z5 — Máximo/VO2', desc: 'Máximo, intervalados curtos e intensos', minFactor: 0.85, maxFactor: 0.92, color: 'red' },
]

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function PaceCalculator({ isOpen, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('basico')
  const [activeTab, setActiveTab] = useState<Tab>('pace')
  const [showZones, setShowZones] = useState(false)

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

  // Zonas de treino
  const zoneRefPaceSecs = parseIntSafe(paceMin) * 60 + parseIntSafe(paceSec)
  const zoneColorClass: Record<ZoneColor, string> = {
    green: styles.zoneGreen,
    greenDark: styles.zoneGreenDark,
    yellow: styles.zoneYellow,
    orange: styles.zoneOrange,
    red: styles.zoneRed,
  }

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

            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${mode === 'basico' ? styles.modeBtnActive : ''}`}
                onClick={() => setMode('basico')}
              >
                Básico
              </button>
              <button
                className={`${styles.modeBtn} ${mode === 'zonas' ? styles.modeBtnActive : ''}`}
                onClick={() => setMode('zonas')}
              >
                Zonas
              </button>
            </div>

            {mode === 'zonas' ? (
              <div className={styles.content}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Pace de referência (min/km)</label>
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

                <button className={styles.calcZonesBtn} onClick={() => setShowZones(true)}>
                  Calcular Zonas
                </button>

                {showZones && zoneRefPaceSecs > 0 && (
                  <div className={styles.zonesList}>
                    {ZONES.map(zone => (
                      <div key={zone.key} className={`${styles.zoneCard} ${zoneColorClass[zone.color]}`}>
                        <div className={styles.zoneHeader}>
                          <span className={styles.zoneName}>{zone.label}</span>
                          <span className={styles.zoneRange}>
                            {formatPace(zoneRefPaceSecs * zone.minFactor)}–{formatPace(zoneRefPaceSecs * zone.maxFactor)} <small>/km</small>
                          </span>
                        </div>
                        <p className={styles.zoneDesc}>{zone.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
