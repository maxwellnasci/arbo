# /admin/turmas/:id — Plano Mensal da Turma

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a tela `/admin/turmas/:id` com grid do plano mensal (4 semanas), toggle mês/semana, painel lateral para adicionar/criar treinos, e fallback no aluno para exibir o plano da turma.

**Architecture:** Duas novas tabelas (`group_plans` + `group_plan_trainings`), dois novos hooks (`useAdminTurmaDetail`, `useGroupPlanMutations`), uma nova página (`AdminTurmaDetail`), e fallback em `useWeeklyPlan` para plano de grupo quando o aluno não tem plano individual. Tudo inline styles, consistente com o padrão do admin existente.

**Tech Stack:** React 19, TypeScript, Supabase (supabase-js), react-router-dom v6

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| Supabase Dashboard SQL | Executar | Schema + RLS + GRANTs + trigger |
| `src/lib/database.types.ts` | Regenerar | Tipos do banco atualizados |
| `src/lib/types.ts` | Modificar | Adicionar `GroupPlan`, `GroupPlanTraining` |
| `src/hooks/useAdminTurmaDetail.ts` | Criar | Fetch grupo + plano do ciclo atual + trainings |
| `src/hooks/useGroupPlanMutations.ts` | Criar | add / remove / createAndAdd training |
| `src/pages/admin/AdminTurmaDetail.tsx` | Criar | Página completa com WeekGrid, MonthView, SidePanel |
| `src/pages/admin/AdminTurmas.tsx` | Modificar | TurmaRow vira link clicável |
| `src/App.tsx` | Modificar | Rota `turmas/:id` |
| `src/hooks/useWeeklyPlan.ts` | Modificar | Fallback para plano de grupo |

---

## Task 1: Schema no Supabase

**Files:**
- Execute: SQL no Supabase Dashboard → SQL Editor

- [ ] **Step 1: Abrir o SQL Editor do Supabase**

Acesse: https://supabase.com/dashboard/project/jhfkflnixzivuichmkie/sql/new

- [ ] **Step 2: Executar o SQL**

```sql
-- Tabela de planos de grupo
CREATE TABLE group_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  starts_at   date NOT NULL,
  notes       text,
  created_by  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, starts_at)
);

-- Tabela de treinos por dia/semana dentro do ciclo
CREATE TABLE group_plan_trainings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_plan_id   uuid NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
  week_number     smallint NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  training_id     uuid NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  sort_order      smallint NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE group_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_plan_trainings ENABLE ROW LEVEL SECURITY;

-- Policies: group_plans
CREATE POLICY "admin_all_group_plans" ON group_plans
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "aluno_select_group_plans" ON group_plans
  FOR SELECT TO authenticated
  USING (
    group_id = (SELECT group_id FROM profiles WHERE id = auth.uid())
  );

-- Policies: group_plan_trainings
CREATE POLICY "admin_all_group_plan_trainings" ON group_plan_trainings
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "aluno_select_group_plan_trainings" ON group_plan_trainings
  FOR SELECT TO authenticated
  USING (
    group_plan_id IN (
      SELECT id FROM group_plans
      WHERE group_id = (SELECT group_id FROM profiles WHERE id = auth.uid())
    )
  );

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON group_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON group_plan_trainings TO authenticated;

-- Trigger updated_at para group_plans
CREATE OR REPLACE FUNCTION update_group_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_group_plans_updated_at
  BEFORE UPDATE ON group_plans
  FOR EACH ROW EXECUTE FUNCTION update_group_plans_updated_at();
```

- [ ] **Step 3: Verificar que não há erros no SQL Editor**

Esperado: "Success. No rows returned"

- [ ] **Step 4: Regenerar tipos TypeScript**

```bash
npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts
```

Esperado: arquivo atualizado com as duas novas tabelas nas seções `Tables` e `TablesInsert`.

- [ ] **Step 5: Confirmar zero erros de tipo**

```bash
npx tsc --noEmit
```

Esperado: nenhuma saída (zero erros).

- [ ] **Step 6: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat: add group_plans and group_plan_trainings schema"
```

---

## Task 2: Tipos TypeScript

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Adicionar os dois novos tipos ao final do arquivo**

Abrir `src/lib/types.ts`. Ele termina em:
```ts
export type UserLevel        = Database['public']['Enums']['user_level']
```

Acrescentar:
```ts
export type GroupPlan         = Database['public']['Tables']['group_plans']['Row']
export type GroupPlanTraining = Database['public']['Tables']['group_plan_trainings']['Row']
```

- [ ] **Step 2: Confirmar zero erros**

```bash
npx tsc --noEmit
```

Esperado: nenhuma saída.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add GroupPlan and GroupPlanTraining types"
```

---

## Task 3: Hook `useAdminTurmaDetail`

**Files:**
- Create: `src/hooks/useAdminTurmaDetail.ts`

- [ ] **Step 1: Criar o arquivo com todo o conteúdo**

```ts
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Group, GroupPlan, Training } from '../lib/types'

export type GroupDayTraining = {
  id: string
  weekNumber: number
  dayOfWeek: number
  training: Training
}

export type UseAdminTurmaDetailResult = {
  group: Group | null
  plan: GroupPlan | null
  trainings: GroupDayTraining[]
  cycleStart: string          // YYYY-MM-DD, início do bloco de 4 semanas atual
  defaultWeekNumber: number   // 1–4, semana atual dentro do ciclo
  isLoading: boolean
  error: string | null
  refresh: () => void
}

type RawGPT = {
  id: string
  week_number: number
  day_of_week: number
  trainings: Training
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCurrentCycle(startsAt: string): { cycleStart: string; weekNumber: number } {
  const origin = new Date(startsAt)
  const today = new Date()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksElapsed = Math.max(0, Math.floor((today.getTime() - origin.getTime()) / msPerWeek))
  const cycleIndex = Math.floor(weeksElapsed / 4)
  const cycleStartDate = new Date(origin.getTime() + cycleIndex * 4 * msPerWeek)
  return {
    cycleStart: toDateString(cycleStartDate),
    weekNumber: (weeksElapsed % 4) + 1,
  }
}

export function useAdminTurmaDetail(groupId: string): UseAdminTurmaDetailResult {
  const [group, setGroup] = useState<Group | null>(null)
  const [plan, setPlan] = useState<GroupPlan | null>(null)
  const [trainings, setTrainings] = useState<GroupDayTraining[]>([])
  const [cycleStart, setCycleStart] = useState('')
  const [defaultWeekNumber, setDefaultWeekNumber] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    async function load() {
      const { data: groupData, error: groupErr } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (cancelled) return
      if (groupErr) { setError(groupErr.message); setIsLoading(false); return }

      setGroup(groupData)

      const startsAt = groupData.starts_at ?? toDateString(new Date())
      const { cycleStart: cs, weekNumber: wn } = getCurrentCycle(startsAt)
      setCycleStart(cs)
      setDefaultWeekNumber(wn)

      const { data: planData, error: planErr } = await supabase
        .from('group_plans')
        .select('*')
        .eq('group_id', groupId)
        .eq('starts_at', cs)
        .maybeSingle()

      if (cancelled) return
      if (planErr) { setError(planErr.message); setIsLoading(false); return }

      setPlan(planData)

      if (!planData) { setTrainings([]); setIsLoading(false); return }

      const { data: gptData, error: gptErr } = await supabase
        .from('group_plan_trainings')
        .select('*, trainings(*)')
        .eq('group_plan_id', planData.id)
        .order('week_number')
        .order('day_of_week')

      if (cancelled) return
      if (gptErr) { setError(gptErr.message); setIsLoading(false); return }

      setTrainings(
        ((gptData ?? []) as unknown as RawGPT[])
          .filter(r => r.trainings)
          .map(r => ({
            id: r.id,
            weekNumber: r.week_number,
            dayOfWeek: r.day_of_week,
            training: r.trainings,
          }))
      )
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [groupId, tick])

  return { group, plan, trainings, cycleStart, defaultWeekNumber, isLoading, error, refresh }
}
```

- [ ] **Step 2: Confirmar zero erros**

```bash
npx tsc --noEmit
```

Esperado: nenhuma saída.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdminTurmaDetail.ts
git commit -m "feat: add useAdminTurmaDetail hook"
```

---

## Task 4: Hook `useGroupPlanMutations`

**Files:**
- Create: `src/hooks/useGroupPlanMutations.ts`

- [ ] **Step 1: Criar o arquivo com todo o conteúdo**

```ts
import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { TrainingType } from '../lib/types'

export type NewTrainingInput = {
  title: string
  type: TrainingType
  distance_m?: number
  target_pace_seconds_per_km?: number
  sets?: number
  description?: string
}

async function ensureGroupPlan(
  groupId: string,
  cycleStart: string,
  createdBy: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('group_plans')
    .select('id')
    .eq('group_id', groupId)
    .eq('starts_at', cycleStart)
    .maybeSingle()

  if (existing) return existing.id

  const { data, error } = await supabase
    .from('group_plans')
    .insert({ group_id: groupId, starts_at: cycleStart, created_by: createdBy })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

export function useGroupPlanMutations(
  groupId: string,
  cycleStart: string,
  currentPlanId: string | null,
) {
  const { user } = useAuth()

  const addTraining = useCallback(
    async (weekNumber: number, dayOfWeek: number, trainingId: string) => {
      if (!user) throw new Error('Não autenticado')
      const planId = currentPlanId ?? await ensureGroupPlan(groupId, cycleStart, user.id)
      const { error } = await supabase
        .from('group_plan_trainings')
        .insert({ group_plan_id: planId, week_number: weekNumber, day_of_week: dayOfWeek, training_id: trainingId })
      if (error) throw new Error(error.message)
    },
    [groupId, cycleStart, currentPlanId, user],
  )

  const removeTraining = useCallback(async (groupPlanTrainingId: string) => {
    const { error } = await supabase
      .from('group_plan_trainings')
      .delete()
      .eq('id', groupPlanTrainingId)
    if (error) throw new Error(error.message)
  }, [])

  const createAndAddTraining = useCallback(
    async (weekNumber: number, dayOfWeek: number, input: NewTrainingInput) => {
      if (!user) throw new Error('Não autenticado')
      const { data: newTraining, error: tErr } = await supabase
        .from('trainings')
        .insert({ ...input, created_by: user.id })
        .select('id')
        .single()
      if (tErr) throw new Error(tErr.message)

      const planId = currentPlanId ?? await ensureGroupPlan(groupId, cycleStart, user.id)
      const { error: gptErr } = await supabase
        .from('group_plan_trainings')
        .insert({ group_plan_id: planId, week_number: weekNumber, day_of_week: dayOfWeek, training_id: newTraining.id })
      if (gptErr) throw new Error(gptErr.message)
    },
    [groupId, cycleStart, currentPlanId, user],
  )

  return { addTraining, removeTraining, createAndAddTraining }
}
```

- [ ] **Step 2: Confirmar zero erros**

```bash
npx tsc --noEmit
```

Esperado: nenhuma saída.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGroupPlanMutations.ts
git commit -m "feat: add useGroupPlanMutations hook"
```

---

## Task 5: Página `AdminTurmaDetail`

**Files:**
- Create: `src/pages/admin/AdminTurmaDetail.tsx`

Esta task cria o arquivo completo com todos os sub-componentes numa passagem só.

- [ ] **Step 1: Criar o arquivo com todo o conteúdo**

```tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAdminTurmaDetail, type GroupDayTraining } from '../../hooks/useAdminTurmaDetail'
import { useGroupPlanMutations, type NewTrainingInput } from '../../hooks/useGroupPlanMutations'
import type { Training, TrainingType } from '../../lib/types'

// ─── Labels ────────────────────────────────────────────────────────────────

const goalLabel: Record<string, string> = {
  '5k': '5K', '10k': '10K', '21k': '21K',
  evoluir_10k: 'Evolução 10K', evoluir_21k: 'Evolução 21K',
}
const frequencyLabel: Record<string, string> = { '2x': '2×/sem', '3x': '3×/sem' }
const typeLabel: Record<string, string> = {
  corrida: 'Corrida', hiit: 'HIIT', recovery: 'Recuperação',
  forca: 'Força', mobilidade: 'Mobilidade',
}
const DAY_NAMES = ['', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MONTH_NAMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

// ─── Helpers ────────────────────────────────────────────────────────────────

function addDays(base: string, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function formatDay(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

function weekRange(cycleStart: string, weekNumber: number): string {
  const start = addDays(cycleStart, (weekNumber - 1) * 7)
  const end = addDays(cycleStart, (weekNumber - 1) * 7 + 6)
  return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]}`
}

function dayDate(cycleStart: string, weekNumber: number, dayOfWeek: number): Date {
  return addDays(cycleStart, (weekNumber - 1) * 7 + (dayOfWeek - 1))
}

// ─── Panel state ────────────────────────────────────────────────────────────

type PanelMode = 'search' | 'create' | 'view'

type PanelState = {
  weekNumber: number
  dayOfWeek: number
  mode: PanelMode
  existing: GroupDayTraining | null
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function AdminTurmaDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { group, plan, trainings, cycleStart, defaultWeekNumber, isLoading, error, refresh } =
    useAdminTurmaDetail(id ?? '')
  const { addTraining, removeTraining, createAndAddTraining } =
    useGroupPlanMutations(id ?? '', cycleStart, plan?.id ?? null)

  const [view, setView] = useState<'week' | 'month'>('week')
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [panel, setPanel] = useState<PanelState | null>(null)
  const [mutating, setMutating] = useState(false)

  useEffect(() => {
    if (defaultWeekNumber > 0) setSelectedWeek(defaultWeekNumber)
  }, [defaultWeekNumber])

  function openSlot(weekNumber: number, dayOfWeek: number) {
    setPanel({ weekNumber, dayOfWeek, mode: 'search', existing: null })
  }

  function openCard(entry: GroupDayTraining) {
    setPanel({ weekNumber: entry.weekNumber, dayOfWeek: entry.dayOfWeek, mode: 'view', existing: entry })
  }

  async function handleAddTraining(trainingId: string) {
    if (!panel) return
    setMutating(true)
    try {
      await addTraining(panel.weekNumber, panel.dayOfWeek, trainingId)
      refresh()
      setPanel(null)
    } finally {
      setMutating(false)
    }
  }

  async function handleRemoveTraining() {
    if (!panel?.existing) return
    setMutating(true)
    try {
      await removeTraining(panel.existing.id)
      refresh()
      setPanel(null)
    } finally {
      setMutating(false)
    }
  }

  async function handleCreateTraining(input: NewTrainingInput) {
    if (!panel) return
    setMutating(true)
    try {
      await createAndAddTraining(panel.weekNumber, panel.dayOfWeek, input)
      refresh()
      setPanel(null)
    } finally {
      setMutating(false)
    }
  }

  function switchToWeekFromMonth(weekNumber: number, dayOfWeek: number) {
    setView('week')
    setSelectedWeek(weekNumber)
    setPanel({ weekNumber, dayOfWeek, mode: 'search', existing: null })
  }

  const hasPanelOpen = panel !== null

  if (!id) return null

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/admin/turmas')}
            style={{ background: 'none', border: 'none', color: '#E8521A', fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: 0 }}
          >
            ← Turmas
          </button>
          {group && (
            <>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>{group.name}</h1>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ background: '#E8521A22', color: '#E8521A', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px' }}>
                  {goalLabel[group.goal] ?? group.goal}
                </span>
                <span style={{ background: '#2a2a2a', color: '#888', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px' }}>
                  {frequencyLabel[group.frequency] ?? group.frequency}
                </span>
                <span style={{ background: group.is_active ? '#4caf5022' : '#2a2a2a', color: group.is_active ? '#4caf50' : '#555', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px' }}>
                  {group.is_active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', background: '#1e1e1e', borderRadius: '8px', padding: '3px', border: '1px solid #2a2a2a' }}>
          {(['month', 'week'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '5px 16px', borderRadius: '6px', border: 'none',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                background: view === v ? '#E8521A' : 'transparent',
                color: view === v ? '#fff' : '#555',
              }}
            >
              {v === 'month' ? 'Mês' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', gap: '0', background: '#1c1c1e', borderRadius: '12px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>

          {/* Main grid area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {view === 'week' ? (
              <WeekView
                cycleStart={cycleStart}
                selectedWeek={selectedWeek}
                trainings={trainings}
                panelEntry={panel?.existing ?? null}
                onNavigate={setSelectedWeek}
                onSlotClick={openSlot}
                onCardClick={openCard}
              />
            ) : (
              <MonthView
                cycleStart={cycleStart}
                trainings={trainings}
                onCellClick={switchToWeekFromMonth}
              />
            )}
          </div>

          {/* Side panel */}
          {hasPanelOpen && panel && (
            <SidePanel
              cycleStart={cycleStart}
              panelState={panel}
              cycleTrainings={trainings}
              mutating={mutating}
              onModeChange={mode => setPanel(p => p ? { ...p, mode } : null)}
              onAddTraining={handleAddTraining}
              onRemoveTraining={handleRemoveTraining}
              onCreateTraining={handleCreateTraining}
              onClose={() => setPanel(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── WeekView ───────────────────────────────────────────────────────────────

function WeekView({
  cycleStart,
  selectedWeek,
  trainings,
  panelEntry,
  onNavigate,
  onSlotClick,
  onCardClick,
}: {
  cycleStart: string
  selectedWeek: number
  trainings: GroupDayTraining[]
  panelEntry: GroupDayTraining | null
  onNavigate: (week: number) => void
  onSlotClick: (weekNumber: number, dayOfWeek: number) => void
  onCardClick: (entry: GroupDayTraining) => void
}) {
  const weekTrainings = trainings.filter(t => t.weekNumber === selectedWeek)
  const trainingByDay = new Map(weekTrainings.map(t => [t.dayOfWeek, t]))

  return (
    <div>
      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
        <button
          onClick={() => onNavigate(selectedWeek - 1)}
          disabled={selectedWeek <= 1}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '7px', color: selectedWeek <= 1 ? '#333' : '#E8521A', fontSize: '14px', fontWeight: 700, cursor: selectedWeek <= 1 ? 'not-allowed' : 'pointer' }}
        >‹</button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Semana {selectedWeek} de 4</div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{weekRange(cycleStart, selectedWeek)}</div>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '6px' }}>
            {[1, 2, 3, 4].map(w => {
              const hasTreino = trainings.some(t => t.weekNumber === w)
              return (
                <button
                  key={w}
                  onClick={() => onNavigate(w)}
                  style={{
                    width: 7, height: 7, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                    background: w === selectedWeek ? '#E8521A' : hasTreino ? '#E8521A66' : '#2a2a2a',
                  }}
                />
              )
            })}
          </div>
        </div>

        <button
          onClick={() => onNavigate(selectedWeek + 1)}
          disabled={selectedWeek >= 4}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '7px', color: selectedWeek >= 4 ? '#333' : '#E8521A', fontSize: '14px', fontWeight: 700, cursor: selectedWeek >= 4 ? 'not-allowed' : 'pointer' }}
        >›</button>
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', padding: '6px 16px 16px' }}>
        {[1, 2, 3, 4, 5, 6].map(dow => {
          const date = dayDate(cycleStart, selectedWeek, dow)
          const entry = trainingByDay.get(dow) ?? null
          const isSelected = panelEntry?.weekNumber === selectedWeek && panelEntry?.dayOfWeek === dow

          return (
            <div key={dow} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '6px 4px', textAlign: 'center', border: '1px solid #222' }}>
                <div style={{ fontSize: '9px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{DAY_NAMES[dow]}</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ccc', marginTop: '1px' }}>{date.getDate()}</div>
              </div>

              {entry ? (
                <button
                  onClick={() => onCardClick(entry)}
                  style={{
                    background: isSelected ? '#1d1311' : '#1a1a1a',
                    border: `1px solid ${isSelected ? '#E8521A' : '#E8521A33'}`,
                    borderRadius: '8px', padding: '7px 6px', cursor: 'pointer',
                    textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{ fontSize: '8px', color: '#E8521A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                    {typeLabel[entry.training.type] ?? entry.training.type}
                  </div>
                  <div style={{ fontSize: '10px', color: '#ddd', fontWeight: 600, lineHeight: 1.3 }}>{entry.training.title}</div>
                  {entry.training.distance_m && (
                    <div style={{ fontSize: '8px', color: '#555', marginTop: '3px' }}>{(entry.training.distance_m / 1000).toFixed(1)}km</div>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => onSlotClick(selectedWeek, dow)}
                  style={{
                    border: `1px dashed ${isSelected ? '#E8521A' : '#252525'}`,
                    borderRadius: '8px', minHeight: '52px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: isSelected ? '#E8521A' : '#303030',
                    fontSize: '18px', cursor: 'pointer', background: isSelected ? '#E8521A0a' : 'transparent',
                    width: '100%',
                  }}
                >+</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MonthView ──────────────────────────────────────────────────────────────

function MonthView({
  cycleStart,
  trainings,
  onCellClick,
}: {
  cycleStart: string
  trainings: GroupDayTraining[]
  onCellClick: (weekNumber: number, dayOfWeek: number) => void
}) {
  return (
    <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1, 2, 3, 4].map(wn => (
        <div key={wn}>
          <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
            Semana {wn} · {weekRange(cycleStart, wn)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
            {[1, 2, 3, 4, 5, 6].map(dow => {
              const entry = trainings.find(t => t.weekNumber === wn && t.dayOfWeek === dow)
              return (
                <button
                  key={dow}
                  onClick={() => onCellClick(wn, dow)}
                  style={{
                    background: entry ? '#1a1a1a' : '#161616',
                    border: `1px solid ${entry ? '#E8521A22' : '#1e1e1e'}`,
                    borderRadius: '7px', padding: '5px 4px', minHeight: '46px',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{ fontSize: '8px', color: '#444', fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' }}>{DAY_NAMES[dow]}</div>
                  {entry ? (
                    <div style={{ fontSize: '8px', color: '#E8521A', fontWeight: 600, lineHeight: 1.3 }}>
                      {entry.training.title.length > 14 ? entry.training.title.slice(0, 13) + '…' : entry.training.title}
                    </div>
                  ) : (
                    <div style={{ color: '#252525', fontSize: '14px', textAlign: 'center' }}>+</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── SidePanel ──────────────────────────────────────────────────────────────

function SidePanel({
  cycleStart,
  panelState,
  cycleTrainings,
  mutating,
  onModeChange,
  onAddTraining,
  onRemoveTraining,
  onCreateTraining,
  onClose,
}: {
  cycleStart: string
  panelState: PanelState
  cycleTrainings: GroupDayTraining[]
  mutating: boolean
  onModeChange: (mode: PanelMode) => void
  onAddTraining: (trainingId: string) => void
  onRemoveTraining: () => void
  onCreateTraining: (input: NewTrainingInput) => void
  onClose: () => void
}) {
  const { weekNumber, dayOfWeek, mode, existing } = panelState
  const date = dayDate(cycleStart, weekNumber, dayOfWeek)
  const dayLabel = `${DAY_NAMES[dayOfWeek]}, ${formatDay(date)}`

  const [allTrainings, setAllTrainings] = useState<Training[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('trainings').select('*').order('title').then(({ data }) => {
      if (data) setAllTrainings(data)
    })
  }, [])

  const cycleTrainingIds = new Set(cycleTrainings.map(t => t.training.id))
  const inCycle = allTrainings.filter(t => cycleTrainingIds.has(t.id))
  const others = allTrainings.filter(t => !cycleTrainingIds.has(t.id))

  function filtered(list: Training[]) {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(t => t.title.toLowerCase().includes(q))
  }

  const panelStyle: React.CSSProperties = {
    width: '220px',
    background: '#161616',
    borderLeft: '1px solid #1e1e1e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>
            {existing ? (
              <><span style={{ color: '#E8521A' }}>{typeLabel[existing.training.type] ?? existing.training.type}</span> — {DAY_NAMES[dayOfWeek]}</>
            ) : (
              <><span style={{ color: '#E8521A' }}>Adicionar treino</span> — {dayLabel}</>
            )}
          </div>
          {existing && (
            <div style={{ fontSize: '12px', color: '#ccc', marginTop: '3px', fontWeight: 600 }}>{existing.training.title}</div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#444', fontSize: '14px', cursor: 'pointer', padding: '0', lineHeight: 1 }}>✕</button>
      </div>

      {/* View mode: existing entry */}
      {mode === 'view' && existing && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {existing.training.distance_m && (
            <div style={{ fontSize: '11px', color: '#888' }}>Distância: {(existing.training.distance_m / 1000).toFixed(1)} km</div>
          )}
          {existing.training.description && (
            <div style={{ fontSize: '11px', color: '#666', lineHeight: 1.4 }}>{existing.training.description}</div>
          )}
          <button
            onClick={onRemoveTraining}
            disabled={mutating}
            style={{ marginTop: '8px', background: '#ff3b3011', border: '1px solid #ff3b3044', borderRadius: '8px', padding: '8px', color: '#ff6b6b', fontSize: '11px', fontWeight: 600, cursor: mutating ? 'not-allowed' : 'pointer' }}
          >
            {mutating ? 'Removendo…' : 'Remover deste dia'}
          </button>
        </div>
      )}

      {/* Search mode */}
      {mode === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px 0' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar treino…"
              style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '7px 10px', fontSize: '11px', color: '#ccc', outline: 'none' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
            {filtered(inCycle).length > 0 && (
              <>
                <div style={{ fontSize: '9px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Usados neste ciclo</div>
                {filtered(inCycle).map(t => (
                  <TrainingListItem key={t.id} training={t} mutating={mutating} onSelect={() => onAddTraining(t.id)} />
                ))}
              </>
            )}
            {filtered(others).length > 0 && (
              <>
                <div style={{ fontSize: '9px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '8px 0 5px' }}>Outros treinos</div>
                {filtered(others).map(t => (
                  <TrainingListItem key={t.id} training={t} mutating={mutating} onSelect={() => onAddTraining(t.id)} />
                ))}
              </>
            )}
          </div>
          <div style={{ padding: '8px 14px 12px', borderTop: '1px solid #1e1e1e' }}>
            <button
              onClick={() => onModeChange('create')}
              style={{ width: '100%', background: '#E8521A11', border: '1px solid #E8521A33', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: '#E8521A', cursor: 'pointer' }}
            >
              + Criar novo treino
            </button>
          </div>
        </div>
      )}

      {/* Create mode */}
      {mode === 'create' && (
        <CreateTrainingForm
          mutating={mutating}
          onBack={() => onModeChange('search')}
          onSubmit={onCreateTraining}
        />
      )}
    </div>
  )
}

// ─── TrainingListItem ────────────────────────────────────────────────────────

function TrainingListItem({ training, mutating, onSelect }: { training: Training; mutating: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      disabled={mutating}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
        padding: '7px 8px', borderRadius: '7px', background: '#1a1a1a',
        border: 'none', cursor: mutating ? 'not-allowed' : 'pointer', marginBottom: '3px', textAlign: 'left',
      }}
    >
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#E8521A', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '10px', color: '#ccc', fontWeight: 600 }}>{training.title}</div>
        <div style={{ fontSize: '8px', color: '#555', marginTop: '1px' }}>
          {typeLabel[training.type] ?? training.type}
          {training.distance_m ? ` · ${(training.distance_m / 1000).toFixed(1)}km` : ''}
        </div>
      </div>
    </button>
  )
}

// ─── CreateTrainingForm ─────────────────────────────────────────────────────

const TRAINING_TYPES: TrainingType[] = ['corrida', 'hiit', 'recovery', 'forca', 'mobilidade']

function parsePace(value: string): number | undefined {
  const match = value.match(/^(\d+):(\d{2})$/)
  if (!match) return undefined
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function CreateTrainingForm({ mutating, onBack, onSubmit }: {
  mutating: boolean
  onBack: () => void
  onSubmit: (input: NewTrainingInput) => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TrainingType>('corrida')
  const [distanceKm, setDistanceKm] = useState('')
  const [pace, setPace] = useState('')
  const [sets, setSets] = useState('')
  const [description, setDescription] = useState('')

  function handleSubmit() {
    if (!title.trim()) return
    const input: NewTrainingInput = { title: title.trim(), type }
    const distNum = parseFloat(distanceKm)
    if (!isNaN(distNum) && distNum > 0) input.distance_m = Math.round(distNum * 1000)
    const paceSeconds = parsePace(pace)
    if (paceSeconds) input.target_pace_seconds_per_km = paceSeconds
    const setsNum = parseInt(sets)
    if (!isNaN(setsNum) && setsNum > 0) input.sets = setsNum
    if (description.trim()) input.description = description.trim()
    onSubmit(input)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a',
    borderRadius: '7px', padding: '6px 8px', fontSize: '11px', color: '#ccc', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '9px', color: '#555', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.4px', marginBottom: '3px', display: 'block',
  }

  return (
    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#E8521A', fontSize: '10px', fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', marginBottom: '2px' }}>
        ← Voltar à busca
      </button>
      <div>
        <label style={labelStyle}>Título *</label>
        <input autoFocus style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Intervalo 400m" />
      </div>
      <div>
        <label style={labelStyle}>Tipo *</label>
        <select style={{ ...inputStyle, color: '#E8521A', fontWeight: 600 }} value={type} onChange={e => setType(e.target.value as TrainingType)}>
          {TRAINING_TYPES.map(t => <option key={t} value={t}>{typeLabel[t]}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Distância (km)</label>
          <input style={inputStyle} value={distanceKm} onChange={e => setDistanceKm(e.target.value)} placeholder="ex: 8" type="number" min="0" step="0.1" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Pace alvo</label>
          <input style={inputStyle} value={pace} onChange={e => setPace(e.target.value)} placeholder="5:30" />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Séries</label>
        <input style={inputStyle} value={sets} onChange={e => setSets(e.target.value)} placeholder="ex: 8" type="number" min="1" />
      </div>
      <div>
        <label style={labelStyle}>Descrição</label>
        <textarea
          style={{ ...inputStyle, resize: 'none', minHeight: '56px' }}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Instruções do treino…"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={mutating || !title.trim()}
        style={{ background: mutating || !title.trim() ? '#333' : '#E8521A', color: '#fff', borderRadius: '8px', padding: '9px', textAlign: 'center', fontSize: '11px', fontWeight: 700, cursor: mutating || !title.trim() ? 'not-allowed' : 'pointer', border: 'none', marginTop: '4px' }}
      >
        {mutating ? 'Salvando…' : 'Salvar e adicionar ao dia'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Confirmar zero erros**

```bash
npx tsc --noEmit
```

Esperado: nenhuma saída.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AdminTurmaDetail.tsx
git commit -m "feat: add AdminTurmaDetail page with week/month grid and side panel"
```

---

## Task 6: Wiring — rota e link na lista de turmas

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/admin/AdminTurmas.tsx`

- [ ] **Step 1: Adicionar o import e a rota em `src/App.tsx`**

Adicionar import após o import de `AdminTurmas`:
```ts
import AdminTurmaDetail from './pages/admin/AdminTurmaDetail'
```

Adicionar rota dentro do array `children` do AdminLayout, após a linha `{ path: 'turmas', element: <AdminTurmas /> }`:
```ts
{ path: 'turmas/:id', element: <AdminTurmaDetail /> },
```

O bloco de rotas do admin fica assim:
```ts
{
  path: '/admin',
  element: <AdminLayout />,
  children: [
    { index: true, element: <AdminHome /> },
    { path: 'alunos', element: <AdminAlunos /> },
    { path: 'feedbacks', element: <AdminFeedbacks /> },
    { path: 'convites', element: <AdminConvites /> },
    { path: 'turmas', element: <AdminTurmas /> },
    { path: 'turmas/:id', element: <AdminTurmaDetail /> },
  ]
}
```

- [ ] **Step 2: Tornar `TurmaRow` clicável em `src/pages/admin/AdminTurmas.tsx`**

Adicionar import no topo do arquivo:
```ts
import { useNavigate } from 'react-router-dom'
```

Modificar o componente `TurmaRow` para usar `useNavigate`:

```tsx
function TurmaRow({ turma }: { turma: GroupWithCount }) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/admin/turmas/${turma.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/admin/turmas/${turma.id}`)}
      style={{
        background: '#1c1c1e',
        borderRadius: '10px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid #2a2a2a',
        gap: '12px',
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {turma.name}
        </p>
        <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
          {goalLabel[turma.goal] ?? turma.goal}
          {' · '}
          {frequencyLabel[turma.frequency] ?? turma.frequency}
          {' · '}
          {planTypeLabel[turma.plan_type] ?? turma.plan_type}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <span style={{ color: '#aaa', fontSize: '12px' }}>
          {turma.studentCount} {turma.studentCount === 1 ? 'aluno' : 'alunos'}
        </span>
        <span
          style={{
            color: turma.is_active ? '#4caf50' : '#555',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <span aria-hidden="true">●</span>{' '}{turma.is_active ? 'Ativa' : 'Inativa'}
        </span>
        <span style={{ color: '#444', fontSize: '14px' }}>›</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Confirmar zero erros**

```bash
npx tsc --noEmit
```

Esperado: nenhuma saída.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/admin/AdminTurmas.tsx
git commit -m "feat: wire turmas/:id route and make TurmaRow clickable"
```

---

## Task 7: Fallback no `useWeeklyPlan` para plano de grupo

**Files:**
- Modify: `src/hooks/useWeeklyPlan.ts`

- [ ] **Step 1: Adicionar a função helper de cálculo de semana**

Após a função `getMonday()` existente, adicionar:
```ts
function getGroupPlanWeekNumber(cycleStartStr: string, weekStartStr: string): number {
  const cycleStart = new Date(cycleStartStr)
  const weekStart = new Date(weekStartStr)
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return Math.floor((weekStart.getTime() - cycleStart.getTime()) / msPerWeek) + 1
}
```

- [ ] **Step 2: Modificar a função `fetchWithRetry` para incluir fallback**

Localizar o bloco dentro de `fetchWithRetry` que retorna cedo quando `planRes.data` é null:
```ts
if (!planRes.data) {
  return { profile: profileRes.data, plan: null, rawTrainings: [], checkins: [] }
}
```

Substituir esse bloco por:
```ts
if (!planRes.data) {
  // Fallback: busca plano de grupo se o aluno pertence a uma turma
  const groupId = profileRes.data?.group_id
  if (!groupId) {
    return { profile: profileRes.data, plan: null, rawTrainings: [], checkins: [] }
  }

  const { data: groupPlan } = await supabase
    .from('group_plans')
    .select('id, starts_at')
    .eq('group_id', groupId)
    .lte('starts_at', weekStart)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!groupPlan) {
    return { profile: profileRes.data, plan: null, rawTrainings: [], checkins: [] }
  }

  // Verificar que a semana cai dentro do ciclo de 4 semanas (28 dias)
  const cycleEnd = new Date(groupPlan.starts_at)
  cycleEnd.setDate(cycleEnd.getDate() + 28)
  if (new Date(weekStart) >= cycleEnd) {
    return { profile: profileRes.data, plan: null, rawTrainings: [], checkins: [] }
  }

  const weekNumber = getGroupPlanWeekNumber(groupPlan.starts_at, weekStart)

  const { data: gptData, error: gptError } = await supabase
    .from('group_plan_trainings')
    .select('*, trainings(*)')
    .eq('group_plan_id', groupPlan.id)
    .eq('week_number', weekNumber)
    .order('day_of_week')

  if (gptError) throw gptError

  return {
    profile: profileRes.data,
    plan: null,
    rawTrainings: (gptData ?? []) as unknown as RawPlanTraining[],
    checkins: [],
  }
}
```

Nota: Os dados de `group_plan_trainings` têm `day_of_week` (1–6), enquanto `weekly_plan_trainings` tem o mesmo campo. O mapeamento para `DayTraining` já usa `wpt.day_of_week`, então funciona sem alteração no reducer.

- [ ] **Step 3: Confirmar zero erros**

```bash
npx tsc --noEmit
```

Esperado: nenhuma saída. O cast `as unknown as RawPlanTraining[]` é intencional — o mesmo padrão já usado no hook para os trainings individuais.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWeeklyPlan.ts
git commit -m "feat: fallback to group plan in useWeeklyPlan when no individual plan"
```

---

## Task 8: Validação final

**Files:**
- Nenhum (apenas verificação)

- [ ] **Step 1: Build de produção sem erros**

```bash
npm run build
```

Esperado: `✓ built in X.XXs` sem erros de TypeScript ou warnings críticos.

- [ ] **Step 2: Iniciar servidor de dev e testar o fluxo completo**

```bash
npm run dev
```

Abrir http://localhost:5173/admin/turmas

Verificar:
- [ ] Lista de turmas carrega normalmente
- [ ] Clicar numa turma navega para `/admin/turmas/:id`
- [ ] Página exibe nome, badges e toggle mês/semana
- [ ] Vista semana mostra grid de 6 colunas com navegação ‹ 1 de 4 ›
- [ ] Clicar "+" abre painel lateral à direita
- [ ] Lista de treinos carrega no painel (pode estar vazia se banco não tiver treinos)
- [ ] Botão "+ Criar novo treino" abre formulário inline
- [ ] Preencher título + tipo e salvar cria o treino e fecha o painel
- [ ] Card do treino aparece no slot correto
- [ ] Clicar no card existente abre painel com botão "Remover deste dia"
- [ ] Toggle "Mês" exibe visão compacta das 4 semanas
- [ ] Clicar célula no mês volta para vista semana e abre painel

- [ ] **Step 3: Commit final se houver ajustes**

```bash
git add -p   # revisar o que mudou
git commit -m "fix: address issues found during smoke test"
```
