# AlunoDashboard com Dados Reais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder do AlunoDashboard por um dashboard funcional que exibe plano semanal, progresso e check-in em tempo real via Supabase.

**Architecture:** Hook `useWeeklyPlan` centraliza toda busca de dados (perfil + plano + treinos + checkins) com retry automático. Dashboard consome o hook e delega renderização para sub-componentes inline. CSS Modules exclusivo, zero inline styles (exceto `width` dinâmico da barra de progresso).

**Tech Stack:** React 19, TypeScript 6, Supabase JS v2, CSS Modules, Vite

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/hooks/useWeeklyPlan.ts` | Criar | Fetch, retry, estado, refresh |
| `src/pages/aluno/AlunoDashboard.module.css` | Criar | Todos os estilos do dashboard |
| `src/pages/aluno/AlunoDashboard.tsx` | Substituir | Composição dos estados e sub-componentes |
| `CLAUDE.md` | Modificar | Atualizar "Próximo passo" |
| `GEMINI.md` | Modificar | Atualizar "Próximo Passo" |

---

## Task 1: Hook `useWeeklyPlan`

**Files:**
- Create: `src/hooks/useWeeklyPlan.ts`

- [ ] **Step 1: Criar o arquivo com tipos e helpers**

```typescript
// src/hooks/useWeeklyPlan.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, Training, WeeklyPlan, WeeklyPlanTraining, Checkin } from '../lib/types'

export type DayTraining = {
  weeklyPlanTrainingId: string
  dayOfWeek: number
  training: Training
  checkin: Checkin | null
}

export type UseWeeklyPlanResult = {
  profile: Profile | null
  plan: WeeklyPlan | null
  trainings: DayTraining[]
  checkins: Checkin[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

type RawPlanTraining = WeeklyPlanTraining & { trainings: Training }

function getMonday(): string {
  const d = new Date()
  const day = d.getDay() // 0=Dom, 1=Seg, ..., 6=Sáb
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

- [ ] **Step 2: Adicionar `fetchWithRetry` logo após os helpers**

```typescript
async function fetchWithRetry(userId: string, attempt = 0): Promise<{
  profile: Profile | null
  plan: WeeklyPlan | null
  rawTrainings: RawPlanTraining[]
  checkins: Checkin[]
}> {
  try {
    const weekStart = getMonday()

    const [profileRes, planRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase
        .from('weekly_plans')
        .select('*')
        .eq('student_id', userId)
        .eq('week_start', weekStart)
        .maybeSingle(),
    ])

    if (profileRes.error) throw profileRes.error
    if (planRes.error) throw planRes.error

    if (!planRes.data) {
      return { profile: profileRes.data, plan: null, rawTrainings: [], checkins: [] }
    }

    const planId = planRes.data.id

    const [trainingsRes, checkinsRes] = await Promise.all([
      supabase
        .from('weekly_plan_trainings')
        .select('*, trainings(*)')
        .eq('plan_id', planId)
        .order('day_of_week'),
      supabase
        .from('checkins')
        .select('*')
        .eq('student_id', userId)
        .eq('plan_id', planId),
    ])

    if (trainingsRes.error) throw trainingsRes.error
    if (checkinsRes.error) throw checkinsRes.error

    return {
      profile: profileRes.data,
      plan: planRes.data,
      rawTrainings: (trainingsRes.data ?? []) as RawPlanTraining[],
      checkins: checkinsRes.data ?? [],
    }
  } catch (err) {
    if (attempt < 2) {
      await sleep(1000 * Math.pow(2, attempt)) // 1s, 2s
      return fetchWithRetry(userId, attempt + 1)
    }
    throw err
  }
}
```

- [ ] **Step 3: Adicionar o hook `useWeeklyPlan` ao final do arquivo**

```typescript
export function useWeeklyPlan(userId: string | undefined): UseWeeklyPlanResult {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [trainings, setTrainings] = useState<DayTraining[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetchWithRetry(userId)
      .then(({ profile, plan, rawTrainings, checkins }) => {
        if (cancelled) return
        setProfile(profile)
        setPlan(plan)
        setCheckins(checkins)
        setTrainings(
          rawTrainings.map(wpt => ({
            weeklyPlanTrainingId: wpt.id,
            dayOfWeek: wpt.day_of_week,
            training: wpt.trainings,
            checkin: checkins.find(c => c.training_id === wpt.training_id) ?? null,
          }))
        )
      })
      .catch(err => {
        if (cancelled) return
        setError((err as Error)?.message ?? 'Erro ao carregar dados.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [userId, tick])

  return { profile, plan, trainings, checkins, isLoading, error, refresh }
}
```

- [ ] **Step 4: Verificar compilação do hook**

```bash
cd /home/max/arbo && npx tsc --noEmit
```

Esperado: 0 erros. Se houver erro de tipo no cast `RawPlanTraining`, verificar se `WeeklyPlanTraining` está exportado em `types.ts` — está.

- [ ] **Step 5: Commit**

```bash
git init  # se ainda não for repo git
git add src/hooks/useWeeklyPlan.ts
git commit -m "feat: add useWeeklyPlan hook with retry logic"
```

---

## Task 2: CSS Module do Dashboard

**Files:**
- Create: `src/pages/aluno/AlunoDashboard.module.css`

- [ ] **Step 1: Criar o arquivo CSS completo**

```css
/* src/pages/aluno/AlunoDashboard.module.css */

/* ── Layout ───────────────────────────────────── */
.page {
  min-height: 100svh;
  background-color: #111111;
  padding: 24px 16px;
  font-family: sans-serif;
}

.container {
  max-width: 640px;
  margin: 0 auto;
}

/* ── Header ───────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  gap: 16px;
}

.greeting {
  color: #ffffff;
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 8px;
  line-height: 1.2;
}

.levelBadge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.levelIniciante   { background: #2a2a2a; color: #888888; }
.levelIntermediario { background: #1e3a5f; color: #60a5fa; }
.levelAvancado    { background: #3a1a0a; color: #E8521A; }

.logoutBtn {
  background: transparent;
  border: 1.5px solid #333333;
  color: #888888;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
}

.logoutBtn:hover {
  border-color: #555555;
  color: #aaaaaa;
}

/* ── Progress ─────────────────────────────────── */
.progressSection {
  margin-bottom: 24px;
}

.progressLabel {
  color: #888888;
  font-size: 14px;
  margin: 0 0 8px;
}

.progressBar {
  height: 6px;
  background: #2a2a2a;
  border-radius: 4px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: #E8521A;
  border-radius: 4px;
  transition: width 0.4s ease;
}

/* ── Training cards ───────────────────────────── */
.trainingList {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card {
  background: #1a1a1a;
  border-radius: 14px;
  padding: 16px 20px;
  border: 1.5px solid #2a2a2a;
}

.cardToday {
  border-left: 3px solid #E8521A;
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dayName {
  color: #888888;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.typeBadge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Badge por tipo de treino */
.typeCorrida    { background: #3a1a0a; color: #E8521A; }
.typeHiit       { background: #3a0a0a; color: #E84545; }
.typeRecovery   { background: #0a2a1a; color: #22C55E; }
.typeForca      { background: #1a0a3a; color: #A855F7; }
.typeMobilidade { background: #0a1a3a; color: #3B82F6; }
.typeDefault    { background: #2a2a2a; color: #888888; }

.trainingTitle {
  color: #ffffff;
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 8px;
}

.trainingMeta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.metaItem {
  color: #888888;
  font-size: 13px;
}

.metaValue {
  color: #cccccc;
  font-weight: 600;
}

.checkinBtn {
  background: #E8521A;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: background 0.15s;
}

.checkinBtn:hover {
  background: #d4481a;
}

.doneBadge {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #22C55E;
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
}

/* ── Estados (loading / error / empty) ────────── */
.stateCard {
  background: #1a1a1a;
  border-radius: 14px;
  padding: 48px 24px;
  text-align: center;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #2a2a2a;
  border-top-color: #E8521A;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loadingText {
  color: #888888;
  font-size: 14px;
  margin: 0;
}

.errorText {
  color: #f87171;
  font-size: 15px;
  margin: 0 0 16px;
}

.retryBtn {
  background: transparent;
  border: 1.5px solid #E8521A;
  color: #E8521A;
  border-radius: 8px;
  padding: 9px 20px;
  font-size: 14px;
  cursor: pointer;
}

.emptyText {
  color: #555555;
  font-size: 15px;
  margin: 0;
}

/* ── Modal de check-in ────────────────────────── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #1a1a1a;
  border-radius: 16px 16px 0 0;
  padding: 24px 20px 32px;
  width: 100%;
  max-width: 480px;
}

.modalHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.modalTitle {
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.modalSubtitle {
  color: #888888;
  font-size: 13px;
  margin: 0 0 20px;
}

.closeBtn {
  background: transparent;
  border: none;
  color: #888888;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
}

.formGroup {
  margin-bottom: 16px;
}

.label {
  display: block;
  color: #888888;
  font-size: 13px;
  margin-bottom: 6px;
}

.input {
  width: 100%;
  background: #111111;
  border: 1.5px solid #333333;
  border-radius: 8px;
  color: #ffffff;
  padding: 10px 12px;
  font-size: 15px;
  box-sizing: border-box;
  font-family: inherit;
}

.input:focus {
  outline: none;
  border-color: #E8521A;
}

.textarea {
  width: 100%;
  background: #111111;
  border: 1.5px solid #333333;
  border-radius: 8px;
  color: #ffffff;
  padding: 10px 12px;
  font-size: 15px;
  resize: vertical;
  min-height: 80px;
  box-sizing: border-box;
  font-family: inherit;
}

.textarea:focus {
  outline: none;
  border-color: #E8521A;
}

.modalError {
  color: #f87171;
  font-size: 13px;
  margin: 0 0 12px;
}

.submitBtn {
  background: #E8521A;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: background 0.15s;
}

.submitBtn:hover:not(:disabled) {
  background: #d4481a;
}

.submitBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Responsivo ───────────────────────────────── */
@media (min-width: 640px) {
  .overlay {
    align-items: center;
    padding: 24px;
  }

  .modal {
    border-radius: 16px;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/aluno/AlunoDashboard.module.css
git commit -m "feat: add AlunoDashboard CSS module"
```

---

## Task 3: Componente `AlunoDashboard` completo

**Files:**
- Modify: `src/pages/aluno/AlunoDashboard.tsx` (substituição total)

- [ ] **Step 1: Escrever helpers e constantes no topo do arquivo**

```typescript
// src/pages/aluno/AlunoDashboard.tsx
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLogout } from '../../hooks/useLogout'
import { useWeeklyPlan, type DayTraining } from '../../hooks/useWeeklyPlan'
import { supabase } from '../../lib/supabase'
import type { TrainingType, UserLevel } from '../../lib/types'
import styles from './AlunoDashboard.module.css'

const DAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
}

const TYPE_CLASS: Record<TrainingType, string> = {
  corrida:    styles.typeCorrida,
  hiit:       styles.typeHiit,
  recovery:   styles.typeRecovery,
  forca:      styles.typeForca,
  mobilidade: styles.typeMobilidade,
}

const LEVEL_LABEL: Record<UserLevel, string> = {
  iniciante:     'Iniciante',
  intermediario: 'Intermediário',
  avancado:      'Avançado',
}

const LEVEL_CLASS: Record<UserLevel, string> = {
  iniciante:     styles.levelIniciante,
  intermediario: styles.levelIntermediario,
  avancado:      styles.levelAvancado,
}

function getGreeting(name: string | null | undefined, email: string | undefined): string {
  const hour = new Date().getHours()
  const period = hour >= 5 && hour < 12 ? 'Bom dia'
    : hour >= 12 && hour < 18 ? 'Boa tarde'
    : 'Boa noite'
  return `${period}, ${name ?? email ?? 'atleta'}!`
}

function formatDistance(meters: number | null): string | null {
  if (!meters) return null
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

function formatPace(secondsPerKm: number | null): string | null {
  if (!secondsPerKm) return null
  const min = Math.floor(secondsPerKm / 60)
  const sec = String(secondsPerKm % 60).padStart(2, '0')
  return `${min}:${sec} /km`
}
```

- [ ] **Step 2: Escrever o sub-componente `CheckinModal`**

Adicionar imediatamente após as funções helper:

```typescript
type CheckinModalProps = {
  dayTraining: DayTraining
  planId: string
  userId: string
  onClose: () => void
  onSuccess: () => void
}

function CheckinModal({ dayTraining, planId, userId, onClose, onSuccess }: CheckinModalProps) {
  const [distance, setDistance] = useState('')
  const [minutes, setMinutes] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const distM = distance ? parseInt(distance, 10) : null
    const durSec = minutes ? Math.round(parseFloat(minutes) * 60) : null
    const pace = distM && durSec ? Math.round(durSec / (distM / 1000)) : null

    const { error: err } = await supabase.from('checkins').insert({
      student_id: userId,
      training_id: dayTraining.training.id,
      plan_id: planId,
      actual_distance_m: distM,
      actual_duration_seconds: durSec,
      actual_pace_seconds_per_km: pace,
      notes: notes.trim() || null,
    })

    setSubmitting(false)

    if (err) {
      setError(err.message)
      return
    }

    onSuccess()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Check-in</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <p className={styles.modalSubtitle}>{dayTraining.training.title}</p>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Distância percorrida (m) — opcional</label>
            <input
              type="number"
              className={styles.input}
              value={distance}
              onChange={e => setDistance(e.target.value)}
              min={0}
              placeholder="ex: 5000"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Tempo total (minutos) — opcional</label>
            <input
              type="number"
              className={styles.input}
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              min={0}
              step="0.1"
              placeholder="ex: 30"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Observações — opcional</label>
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Como foi o treino?"
            />
          </div>
          {error && <p className={styles.modalError}>{error}</p>}
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? 'Salvando...' : 'Registrar treino'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Escrever o sub-componente `TrainingCard`**

```typescript
type TrainingCardProps = {
  dayTraining: DayTraining
  planId: string
  userId: string
  isToday: boolean
  onCheckinSuccess: () => void
}

function TrainingCard({ dayTraining, planId, userId, isToday, onCheckinSuccess }: TrainingCardProps) {
  const [showModal, setShowModal] = useState(false)
  const { training, checkin, dayOfWeek } = dayTraining

  return (
    <>
      <div className={`${styles.card}${isToday ? ` ${styles.cardToday}` : ''}`}>
        <div className={styles.cardHeader}>
          <span className={styles.dayName}>{DAY_NAMES[dayOfWeek] ?? `Dia ${dayOfWeek}`}</span>
          <span className={`${styles.typeBadge} ${TYPE_CLASS[training.type] ?? styles.typeDefault}`}>
            {training.type}
          </span>
        </div>

        <h3 className={styles.trainingTitle}>{training.title}</h3>

        <div className={styles.trainingMeta}>
          {training.distance_m != null && (
            <span className={styles.metaItem}>
              Distância: <span className={styles.metaValue}>{formatDistance(training.distance_m)}</span>
            </span>
          )}
          {training.target_pace_seconds_per_km != null && (
            <span className={styles.metaItem}>
              Pace: <span className={styles.metaValue}>{formatPace(training.target_pace_seconds_per_km)}</span>
            </span>
          )}
          {training.duration_minutes != null && (
            <span className={styles.metaItem}>
              Duração: <span className={styles.metaValue}>{training.duration_minutes} min</span>
            </span>
          )}
        </div>

        {checkin ? (
          <div className={styles.doneBadge}>Concluído ✓</div>
        ) : (
          <button className={styles.checkinBtn} onClick={() => setShowModal(true)}>
            Fazer check-in
          </button>
        )}
      </div>

      {showModal && (
        <CheckinModal
          dayTraining={dayTraining}
          planId={planId}
          userId={userId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            onCheckinSuccess()
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Escrever o componente principal `AlunoDashboard`**

```typescript
export default function AlunoDashboard() {
  const { user } = useAuth()
  const logout = useLogout()
  const { profile, plan, trainings, isLoading, error, refresh } = useWeeklyPlan(user?.id)

  const todayDow = new Date().getDay()
  const completed = trainings.filter(t => t.checkin !== null).length
  const total = trainings.length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.stateCard}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Carregando...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.stateCard}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={refresh}>Tentar novamente</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.greeting}>
              {getGreeting(profile?.full_name, user?.email)}
            </h1>
            {profile?.level && (
              <span className={`${styles.levelBadge} ${LEVEL_CLASS[profile.level] ?? styles.levelIniciante}`}>
                {LEVEL_LABEL[profile.level] ?? profile.level}
              </span>
            )}
          </div>
          <button className={styles.logoutBtn} onClick={logout}>Sair</button>
        </header>

        {/* Sem plano */}
        {!plan ? (
          <div className={styles.stateCard}>
            <p className={styles.emptyText}>Nenhum treino programado para esta semana.</p>
          </div>
        ) : (
          <>
            {/* Progresso */}
            <section className={styles.progressSection}>
              <p className={styles.progressLabel}>{completed} de {total} treinos realizados</p>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
              </div>
            </section>

            {/* Cards */}
            <div className={styles.trainingList}>
              {trainings.map(dt => (
                <TrainingCard
                  key={dt.weeklyPlanTrainingId}
                  dayTraining={dt}
                  planId={plan.id}
                  userId={user!.id}
                  isToday={dt.dayOfWeek === todayDow}
                  onCheckinSuccess={refresh}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/aluno/AlunoDashboard.tsx
git commit -m "feat: implement AlunoDashboard with real Supabase data"
```

---

## Task 4: Validação TypeScript + Lint

**Files:** nenhum — só execução

- [ ] **Step 1: Rodar TypeScript**

```bash
cd /home/max/arbo && npx tsc --noEmit
```

Esperado: nenhuma linha de saída (0 erros).

Erros comuns e correções:
- `Property 'trainings' does not exist on type 'WeeklyPlanTraining'` → confirmar cast `as RawPlanTraining[]` no hook
- `Type 'string' is not assignable to type 'UserLevel'` → verificar que `profile.level` é `UserLevel | null`

- [ ] **Step 2: Rodar ESLint**

```bash
cd /home/max/arbo && npm run lint
```

Esperado: nenhuma linha de erro. Avisos de `react-refresh/only-export-components` para sub-componentes podem aparecer — se aparecerem, mover `CheckinModal` e `TrainingCard` para arquivos separados ou suprimir com `// eslint-disable-next-line`.

- [ ] **Step 3: Commit de correções (se necessário)**

```bash
git add -p
git commit -m "fix: resolve TypeScript and lint errors in dashboard"
```

---

## Task 5: Teste no Navegador

**Files:** nenhum

- [ ] **Step 1: Iniciar servidor**

```bash
cd /home/max/arbo && npm run dev
```

Abrir `http://localhost:5173` (ou a porta exibida no terminal). Fazer login com a conta do aluno de teste.

- [ ] **Step 2: Verificar checklist visual**

- [ ] Header exibe saudação dinâmica (bom dia/tarde/noite) com nome ou email
- [ ] Badge de nível aparece abaixo da saudação
- [ ] "0 de 3 treinos realizados" com barra de progresso vazia
- [ ] 3 cards aparecem: Segunda (Corrida), Quarta (HIIT), Sábado (Recovery)
- [ ] Treino do dia atual tem borda laranja à esquerda (se hoje for seg/qua/sáb)
- [ ] Badges coloridos por tipo: corrida=laranja, hiit=vermelho, recovery=verde
- [ ] Distância e pace formatados (ex: "5,0 km", "6:00 /km")

- [ ] **Step 3: Testar check-in**

1. Clicar "Fazer check-in" no card de Corrida leve 5km
2. Modal abre com título do treino
3. Preencher: Distância = 5000, Tempo = 31, Observações = "Treino ok"
4. Clicar "Registrar treino"
5. Modal fecha, card atualiza para "Concluído ✓" em verde
6. Progresso atualiza para "1 de 3 treinos realizados"

- [ ] **Step 4: Verificar no Supabase que o check-in foi salvo**

```sql
SELECT * FROM checkins ORDER BY created_at DESC LIMIT 1;
```

Esperado: linha com `student_id`, `training_id`, `actual_distance_m = 5000`, `actual_duration_seconds = 1860`, `actual_pace_seconds_per_km = 372`.

- [ ] **Step 5: Testar responsividade**

No DevTools, simular iPhone SE (375×667). Verificar:
- Cards ocupam largura total
- Modal abre colado ao fundo (bottom sheet)
- Botões têm altura suficiente para toque (≥44px)

---

## Task 6: Atualizar Documentação

**Files:**
- Modify: `CLAUDE.md`
- Modify: `GEMINI.md`

- [ ] **Step 1: Atualizar `CLAUDE.md`**

Substituir a seção `## Próximo passo`:

```markdown
## Implementado

- `AlunoDashboard` com dados reais: saudação, badge de nível, barra de progresso semanal, cards de treino por dia, check-in modal.
- Hook `useWeeklyPlan` — busca perfil + plano + treinos + checkins em paralelo, retry automático (3× backoff exponencial).

## Próximo passo

- Implementar painel de gestão de alunos no `AdminDashboard`.
- Adicionar tela de histórico de check-ins e recordes pessoais do aluno.
```

- [ ] **Step 2: Atualizar `GEMINI.md`**

Substituir a seção `## Próximo Passo`:

```markdown
## Implementado

- **AlunoDashboard** com dados reais do Supabase: saudação dinâmica, badge de nível, progresso semanal, cards de treino com check-in modal.
- **`useWeeklyPlan` hook** — fetch paralelo de perfil + plano + treinos + checkins, retry exponencial.

## Próximo Passo

- Implementar painel admin para gestão de alunos.
- Adicionar histórico de check-ins e recordes pessoais.
```

- [ ] **Step 3: Commit final**

```bash
git add CLAUDE.md GEMINI.md
git commit -m "docs: update roadmap after AlunoDashboard implementation"
```

---

## Self-Review

**Spec coverage:**
- ✓ Header com saudação + badge nível + logout → Task 3 Step 4
- ✓ Barra de progresso X/Y → Task 3 Step 4
- ✓ Card por treino com dia, tipo, distância, pace → Task 3 Step 3
- ✓ Badge colorido por tipo → Task 2 + Task 3 Step 1
- ✓ Destaque do treino do dia → Task 3 Step 3 (`isToday`)
- ✓ Botão check-in / badge Concluído → Task 3 Step 3
- ✓ Modal com campos + cálculo de pace → Task 3 Step 2
- ✓ Salva em `checkins` + refresh → Task 3 Step 2
- ✓ CSS Modules sem inline (exceto `width` dinâmico do progress) → Task 2
- ✓ States: loading, error, sem plano, dados → Task 3 Step 4
- ✓ Retry automático → Task 1 Step 2
- ✓ tsc + lint → Task 4
- ✓ Teste browser → Task 5
- ✓ CLAUDE.md + GEMINI.md → Task 6

**Placeholder scan:** nenhum TBD/TODO encontrado.

**Type consistency:** `DayTraining` definido em Task 1, usado em Tasks 3.2 e 3.3. `TrainingType` e `UserLevel` importados de `../lib/types`. `RawPlanTraining` definido e usado apenas em Task 1. Consistente.
