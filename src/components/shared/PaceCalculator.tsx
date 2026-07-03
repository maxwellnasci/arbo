import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Ruler, Activity } from 'lucide-react'
import styles from './PaceCalculator.module.css'

type Tab = 'pace' | 'tempo' | 'distancia'
type Mode = 'basico' | 'avancado'
type ZoneColor = 'green' | 'greenDark' | 'yellow' | 'orange' | 'red' | 'purple'

type Zone = {
  key: string
  label: string
  desc: string
  minFactor: number
  maxFactor: number
  color: ZoneColor
}

type AdvancedZone = Zone & {
  hr: string
  workout: string
}

const BASIC_ZONES: Zone[] = [
  { key: 'b1', label: 'Leve', desc: 'Dá pra conversar sem esforço. Ideal pra recuperar e rodar longo.', minFactor: 1.20, maxFactor: 1.40, color: 'green' },
  { key: 'b2', label: 'Moderado', desc: 'Já sente o esforço, mas consegue sustentar. Seu ritmo de treino.', minFactor: 1.00, maxFactor: 1.12, color: 'yellow' },
  { key: 'b3', label: 'Forte', desc: 'Esforço alto, ritmo de prova. Só aguenta por pouco tempo.', minFactor: 0.85, maxFactor: 0.98, color: 'orange' },
]

const ADVANCED_ZONES: AdvancedZone[] = [
  { key: 'a1', label: 'Z1 — Regenerativo', desc: 'Muito fácil, dá pra conversar sem esforço.', minFactor: 1.30, maxFactor: 1.40, color: 'green', hr: '60–70% FCmáx', workout: 'Rodagem leve de recuperação, 20–40 min' },
  { key: 'a2', label: 'Z2 — Base Aeróbica', desc: 'Fácil, ritmo de corrida longa.', minFactor: 1.15, maxFactor: 1.25, color: 'greenDark', hr: '70–80% FCmáx', workout: 'Rodagem longa, constrói resistência de base' },
  { key: 'a3', label: 'Z3 — Moderado', desc: 'Moderado, ritmo de maratona.', minFactor: 1.05, maxFactor: 1.12, color: 'yellow', hr: '80–87% FCmáx', workout: 'Tempo run de 20–40 min em ritmo constante' },
  { key: 'a4', label: 'Z4 — Limiar', desc: 'Forte, ritmo de prova de 10km.', minFactor: 0.95, maxFactor: 1.05, color: 'orange', hr: '87–92% FCmáx', workout: 'Tiros de 8–15 min com pausa curta' },
  { key: 'a5', label: 'Z5 — VO2max', desc: 'Muito forte, intervalados intensos.', minFactor: 0.85, maxFactor: 0.94, color: 'red', hr: '92–97% FCmáx', workout: 'Intervalados de 3–5 min (ex: 1000m) com descanso igual' },
  { key: 'a6', label: 'Z6 — Anaeróbico', desc: 'Máximo, tiros curtos e explosivos.', minFactor: 0.70, maxFactor: 0.85, color: 'purple', hr: 'Acima de 97% FCmáx', workout: 'Tiros de 15–30s, foco em potência e técnica' },
]

const ZONE_COLOR_CLASS: Record<ZoneColor, string> = {
  green: styles.zoneGreen,
  greenDark: styles.zoneGreenDark,
  yellow: styles.zoneYellow,
  orange: styles.zoneOrange,
  red: styles.zoneRed,
  purple: styles.zonePurple,
}

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function PaceCalculator({ isOpen, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('basico')
  const [activeTab, setActiveTab] = useState<Tab>('pace')

  // Inputs
  const [distanceKm, setDistanceKm] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')
  const [paceMin, setPaceMin] = useState('')
  const [paceSec, setPaceSec] = useState('')

  // Avançado — distância + tempo geram o pace de referência
  const [advDistanceKm, setAdvDistanceKm] = useState('')
  const [advHours, setAdvHours] = useState('')
  const [advMinutes, setAdvMinutes] = useState('')
  const [advSeconds, setAdvSeconds] = useState('')
  const [advPaceSecs, setAdvPaceSecs] = useState(0)
  const [advError, setAdvError] = useState<string | null>(null)

  // Avançado — "descubra a zona de um treino específico"
  const [checkKm, setCheckKm] = useState('')
  const [checkHours, setCheckHours] = useState('')
  const [checkMinutes, setCheckMinutes] = useState('')
  const [checkSeconds, setCheckSeconds] = useState('')

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

  // Modo Avançado — distância + tempo geram o pace de referência ao clicar "Calcular Zonas"
  const handleCalcZones = () => {
    const dist = parseNum(advDistanceKm)
    const totalSecs = parseIntSafe(advHours) * 3600 + parseIntSafe(advMinutes) * 60 + parseIntSafe(advSeconds)

    if (dist <= 0 || totalSecs <= 0) {
      setAdvError('Preencha distância e tempo')
      setAdvPaceSecs(0)
      return
    }

    const pace = totalSecs / dist
    if (!isFinite(pace) || pace <= 0) {
      setAdvError('Pace calculado inválido')
      setAdvPaceSecs(0)
      return
    }

    setAdvError(null)
    setAdvPaceSecs(pace)
  }

  const renderZoneRange = (pace: number, zone: Zone) =>
    `${formatPace(pace * zone.minFactor)}–${formatPace(pace * zone.maxFactor)}`

  // Avançado — descobrir a zona de um treino específico (km + tempo)
  const checkTotalSecs = parseIntSafe(checkHours) * 3600 + parseIntSafe(checkMinutes) * 60 + parseIntSafe(checkSeconds)
  const checkDistKm = parseNum(checkKm)
  const checkPaceSecs = checkDistKm > 0 && checkTotalSecs > 0 ? checkTotalSecs / checkDistKm : 0

  const findZoneForPace = (paceSecs: number, refPace: number): AdvancedZone | null => {
    if (paceSecs <= 0 || refPace <= 0) return null
    const exact = ADVANCED_ZONES.find(z => paceSecs >= refPace * z.minFactor && paceSecs <= refPace * z.maxFactor)
    if (exact) return exact
    // fora das faixas (zona de transição) — retorna a zona com o centro mais próximo
    let closest = ADVANCED_ZONES[0]
    let closestDist = Infinity
    for (const z of ADVANCED_ZONES) {
      const center = refPace * ((z.minFactor + z.maxFactor) / 2)
      const dist = Math.abs(paceSecs - center)
      if (dist < closestDist) {
        closestDist = dist
        closest = z
      }
    }
    return closest
  }

  const matchedZone = findZoneForPace(checkPaceSecs, advPaceSecs)

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
            <div className={styles.modalHeader}>
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
                  className={`${styles.modeBtn} ${mode === 'avancado' ? styles.modeBtnActive : ''}`}
                  onClick={() => setMode('avancado')}
                >
                  Avançado
                </button>
              </div>
            </div>

            <div className={styles.body}>
              {mode === 'avancado' ? (
                <div className={styles.content}>
                  <p className={styles.helperText}>
                    Informe a distância e o tempo de uma prova ou treino recente (ex: seu tempo de 10km) pra calcular seu
                    pace de referência. As 6 zonas mostram em qual ritmo treinar cada estímulo — pergunte ao seu professor
                    qual delas focar essa semana.
                  </p>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Distância (km)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      className={styles.input}
                      placeholder="Ex: 10"
                      value={advDistanceKm}
                      onChange={e => setAdvDistanceKm(e.target.value)}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Tempo (hh:mm:ss)</label>
                    <div className={styles.timeInputs}>
                      <input
                        type="number"
                        inputMode="numeric"
                        className={styles.input}
                        placeholder="h"
                        value={advHours}
                        onChange={e => setAdvHours(e.target.value)}
                      />
                      <span className={styles.timeColon}>:</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        className={styles.input}
                        placeholder="m"
                        value={advMinutes}
                        onChange={e => setAdvMinutes(e.target.value)}
                      />
                      <span className={styles.timeColon}>:</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        className={styles.input}
                        placeholder="s"
                        value={advSeconds}
                        onChange={e => setAdvSeconds(e.target.value)}
                      />
                    </div>
                  </div>

                  <button type="button" className={styles.calcBtn} onClick={handleCalcZones}>
                    Calcular Zonas
                  </button>

                  {advError && <p className={styles.errorText}>{advError}</p>}

                  {advPaceSecs > 0 && (
                    <div className={styles.resultBox}>
                      <span className={styles.resultLabel}>Seu pace é</span>
                      <span className={styles.resultValue}>
                        {formatPace(advPaceSecs)} <small className={styles.resultSmall}>min/km</small>
                      </span>
                    </div>
                  )}

                  {advPaceSecs > 0 && (
                    <div className={styles.zonesList}>
                      {ADVANCED_ZONES.map(zone => (
                        <div key={zone.key} className={`${styles.zoneCard} ${ZONE_COLOR_CLASS[zone.color]}`}>
                          <div className={styles.zoneHeader}>
                            <span className={styles.zoneName}>{zone.label}</span>
                            <span className={styles.zoneRange}>
                              {renderZoneRange(advPaceSecs, zone)} <small>/km</small>
                            </span>
                          </div>
                          <p className={styles.zoneDesc}>{zone.desc}</p>
                          <span className={styles.zoneHr}>{zone.hr}</span>
                          <p className={styles.zoneWorkout}><strong>Treino:</strong> {zone.workout}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {advPaceSecs > 0 && (
                    <div className={styles.zonesBox}>
                      <h4 className={styles.tableTitle}>Descubra a zona de um treino específico</h4>
                      <div className={styles.content}>
                        <div className={styles.fieldGroup}>
                          <label className={styles.label}>Distância (km)</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            className={styles.input}
                            placeholder="Ex: 8"
                            value={checkKm}
                            onChange={e => setCheckKm(e.target.value)}
                          />
                        </div>

                        <div className={styles.fieldGroup}>
                          <label className={styles.label}>Tempo (hh:mm:ss)</label>
                          <div className={styles.timeInputs}>
                            <input
                              type="number"
                              inputMode="numeric"
                              className={styles.input}
                              placeholder="h"
                              value={checkHours}
                              onChange={e => setCheckHours(e.target.value)}
                            />
                            <span className={styles.timeColon}>:</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              className={styles.input}
                              placeholder="m"
                              value={checkMinutes}
                              onChange={e => setCheckMinutes(e.target.value)}
                            />
                            <span className={styles.timeColon}>:</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              className={styles.input}
                              placeholder="s"
                              value={checkSeconds}
                              onChange={e => setCheckSeconds(e.target.value)}
                            />
                          </div>
                        </div>

                        {checkPaceSecs > 0 && matchedZone && (
                          <div className={`${styles.zoneCard} ${styles.zoneCardHighlight} ${ZONE_COLOR_CLASS[matchedZone.color]}`}>
                            <span className={styles.resultLabel}>Esse treino foi na</span>
                            <div className={styles.zoneHeader}>
                              <span className={styles.zoneName}>{matchedZone.label}</span>
                              <span className={styles.zoneRange}>
                                {formatPace(checkPaceSecs)} <small>/km</small>
                              </span>
                            </div>
                            <p className={styles.zoneDesc}>{matchedZone.desc}</p>
                          </div>
                        )}
                      </div>
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
                        <div className={styles.zonesBox}>
                          <h4 className={styles.tableTitle}>Zonas de treino</h4>
                          <div className={styles.zonesList}>
                            {BASIC_ZONES.map(zone => (
                              <div key={zone.key} className={`${styles.zoneCard} ${ZONE_COLOR_CLASS[zone.color]}`}>
                                <div className={styles.zoneHeader}>
                                  <span className={styles.zoneName}>{zone.label}</span>
                                  <span className={styles.zoneRange}>
                                    {renderZoneRange(refPaceSecs, zone)} <small>/km</small>
                                  </span>
                                </div>
                                <p className={styles.zoneDesc}>{zone.desc}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
