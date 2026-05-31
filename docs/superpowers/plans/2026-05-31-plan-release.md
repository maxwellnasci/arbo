# Controle de Liberação do Plano — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o professor libere semanas do plano do grupo uma a uma (ou tudo de uma vez), controlando quando os alunos veem os treinos.

**Architecture:** Coluna `released_through_week smallint DEFAULT 0` em `group_plans` armazena o estado de liberação (0–4). `useGroupPlanMutations` expõe `releaseThrough()`. `useWeeklyPlan` verifica se a semana atual está liberada antes de retornar trainings; se não, retorna `isLocked = true`. AdminTurmaDetail exibe chips de lock nos tabs + banner de liberação. AlunoDashboard renderiza tela de espera quando `isLocked`.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL), sonner (toasts), framer-motion (disponível mas não usado aqui — basta CSS animation)

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| Supabase Dashboard SQL | Migration: ADD COLUMN + backfill |
| `src/lib/database.types.ts` | Regenerar após migration |
| `src/hooks/useGroupPlanMutations.ts` | Adicionar `releaseThrough()` |
| `src/hooks/useWeeklyPlan.ts` | Adicionar lock check + `lastWeekSummary` |
| `src/pages/admin/AdminTurmaDetail.tsx` | Chips de lock nos tabs + banner contextual |
| `src/pages/aluno/AlunoDashboard.tsx` | Tela bloqueada (LockedScreen) |
| `src/pages/aluno/AlunoDashboard.module.css` | Classes CSS para LockedScreen |
| `src/App.tsx` | Adicionar `<Toaster />` do sonner |
| `CLAUDE.md` / `GEMINI.md` | Documentar `released_through_week` |

---

## Task 1: Schema migration

**Files:**
- Supabase Dashboard → SQL Editor
- `src/lib/database.types.ts` (regenerar)

- [ ] **Step 1.1: Aplicar migration no Supabase Dashboard**

Abrir https://supabase.com/dashboard/project/jhfkflnixzivuichmkie/sql/new e executar:

```sql
-- Adiciona coluna de controle de liberação
ALTER TABLE public.group_plans
  ADD COLUMN released_through_week smallint NOT NULL DEFAULT 0;

-- Backfill: planos existentes ficam totalmente liberados (mantém comportamento atual)
UPDATE public.group_plans SET released_through_week = 4;
```

- [ ] **Step 1.2: Regenerar tipos TypeScript**

```bash
npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts
```

Verificar que `group_plans.Row` agora inclui `released_through_week: number`.

> Atenção: o CLI pode imprimir um aviso de versão após o `} as const`. Se aparecer, remover as linhas de texto extras no final do arquivo.

- [ ] **Step 1.3: Verificar zero erros de TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem output (0 erros).

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(schema): adiciona released_through_week em group_plans"
```

---

## Task 2: `useGroupPlanMutations` — adicionar `releaseThrough`

**Files:**
- Modify: `src/hooks/useGroupPlanMutations.ts`

- [ ] **Step 2.1: Adicionar `releaseThrough` ao hook**

Abrir `src/hooks/useGroupPlanMutations.ts`. Adicionar o novo método antes do `return`, e incluí-lo no retorno:

```ts
// Após o bloco de createAndAddTraining (linha ~82), antes do return:

  const releaseThrough = useCallback(
    async (weekNumber: 1 | 2 | 3 | 4) => {
      if (!currentPlanId) throw new Error('Plano não encontrado')
      const { error } = await supabase
        .from('group_plans')
        .update({ released_through_week: weekNumber })
        .eq('id', currentPlanId)
      if (error) throw new Error(error.message)
    },
    [currentPlanId],
  )

  return { addTraining, removeTraining, createAndAddTraining, releaseThrough }
```

O `return` anterior era `return { addTraining, removeTraining, createAndAddTraining }` — substituir pela linha acima.

- [ ] **Step 2.2: Verificar lint e TypeScript**

```bash
npm run lint && npx tsc --noEmit
```

Esperado: sem output de erros.

- [ ] **Step 2.3: Commit**

```bash
git add src/hooks/useGroupPlanMutations.ts
git commit -m "feat(mutations): adiciona releaseThrough ao useGroupPlanMutations"
```

---

## Task 3: `useWeeklyPlan` — estado de lock

**Files:**
- Modify: `src/hooks/useWeeklyPlan.ts`

Esta é a maior mudança. Seguir os passos em ordem.

- [ ] **Step 3.1: Adicionar o tipo `LastWeekSummary` e exportá-lo**

Logo após os imports existentes (linha ~6), adicionar:

```ts
export type LastWeekSummary = {
  checkinCount: number
  totalDistanceM: number
  avgPaceSecondsPerKm: number | null
}
```

- [ ] **Step 3.2: Adicionar helper `subtractOneWeek`**

Após a função `getGroupPlanWeekNumber` (linha ~79), adicionar:

```ts
function subtractOneWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function computeLastWeekSummary(checkins: { actual_distance_m: number | null; actual_duration_seconds: number | null }[]): LastWeekSummary {
  const checkinCount = checkins.length
  const totalDistanceM = checkins.reduce((sum, c) => sum + (c.actual_distance_m ?? 0), 0)
  const withPace = checkins.filter(c => (c.actual_distance_m ?? 0) > 0 && (c.actual_duration_seconds ?? 0) > 0)
  const avgPaceSecondsPerKm = withPace.length > 0
    ? Math.round(withPace.reduce((sum, c) => sum + (c.actual_duration_seconds! / (c.actual_distance_m! / 1000)), 0) / withPace.length)
    : null
  return { checkinCount, totalDistanceM, avgPaceSecondsPerKm }
}
```

- [ ] **Step 3.3: Atualizar o tipo de retorno de `fetchWithRetry`**

Localizar a assinatura de `fetchWithRetry` (linha ~85) e substituir o `Promise<{...}>` por:

```ts
async function fetchWithRetry(userId: string, signal: { cancelled: boolean }, attempt = 0): Promise<{
  profile: Profile | null
  plan: WeeklyPlan | null
  rawTrainings: RawPlanTraining[]
  checkins: Checkin[]
  isLocked: boolean
  lockedWeekNumber: number
  lastWeekSummary: LastWeekSummary | null
}>
```

- [ ] **Step 3.4: Atualizar os `return` antecipados do caminho individual (plano semanal)**

No bloco onde `planRes.data` existe (plano individual, linha ~153), o return final é:
```ts
return {
  profile: profileRes.data,
  plan: planRes.data,
  rawTrainings: (trainingsRes.data ?? []) as unknown as RawPlanTraining[],
  checkins: checkinsRes.data ?? [],
}
```

Substituir por:
```ts
return {
  profile: profileRes.data,
  plan: planRes.data,
  rawTrainings: (trainingsRes.data ?? []) as unknown as RawPlanTraining[],
  checkins: checkinsRes.data ?? [],
  isLocked: false,
  lockedWeekNumber: 0,
  lastWeekSummary: null,
}
```

- [ ] **Step 3.5: Atualizar o fallback para plano de grupo — adicionar lock check**

Localizar o bloco do fallback do plano de grupo, que começa após `if (!planRes.data)`. Dentro desse bloco, há returns antecipados e um return final. Substituir o bloco inteiro por:

```ts
if (!planRes.data) {
  // Fallback: busca plano de grupo se o aluno pertence a uma turma
  const groupId = profileRes.data?.group_id
  if (!groupId) {
    return { profile: profileRes.data, plan: null, rawTrainings: [], checkins: [], isLocked: false, lockedWeekNumber: 0, lastWeekSummary: null }
  }

  const { data: groupPlan } = await supabase
    .from('group_plans')
    .select('id, starts_at, released_through_week')
    .eq('group_id', groupId)
    .lte('starts_at', weekStart)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!groupPlan) {
    return { profile: profileRes.data, plan: null, rawTrainings: [], checkins: [], isLocked: false, lockedWeekNumber: 0, lastWeekSummary: null }
  }

  // Verificar que a semana cai dentro do ciclo de 4 semanas (28 dias)
  const cycleEnd = new Date(groupPlan.starts_at)
  cycleEnd.setDate(cycleEnd.getDate() + 28)
  if (new Date(weekStart) >= cycleEnd) {
    return { profile: profileRes.data, plan: null, rawTrainings: [], checkins: [], isLocked: false, lockedWeekNumber: 0, lastWeekSummary: null }
  }

  const weekNumber = getGroupPlanWeekNumber(groupPlan.starts_at, weekStart)

  // Verificar se a semana está liberada
  if (weekNumber > (groupPlan.released_through_week ?? 0)) {
    let lastWeekSummary: LastWeekSummary | null = null
    if (weekNumber > 1) {
      const previousMonday = subtractOneWeek(weekStart)
      const { data: prevCheckins } = await supabase
        .from('checkins')
        .select('actual_distance_m, actual_duration_seconds')
        .eq('student_id', userId)
        .eq('week_start', previousMonday)
      lastWeekSummary = computeLastWeekSummary(prevCheckins ?? [])
    }
    return {
      profile: profileRes.data,
      plan: null,
      rawTrainings: [],
      checkins: [],
      isLocked: true,
      lockedWeekNumber: weekNumber,
      lastWeekSummary,
    }
  }

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
    isLocked: false,
    lockedWeekNumber: 0,
    lastWeekSummary: null,
  }
}
```

- [ ] **Step 3.6: Atualizar `State`, `Action`, `reducer` e `initialState`**

Substituir o tipo `State`:
```ts
type State = {
  profile: Profile | null
  plan: WeeklyPlan | null
  trainings: DayTraining[]
  checkins: Checkin[]
  isLocked: boolean
  lockedWeekNumber: number
  lastWeekSummary: LastWeekSummary | null
  isLoading: boolean
  error: string | null
  tick: number
}
```

Substituir o tipo `Action` (o case `SUCCESS`):
```ts
type Action =
  | { type: 'REFRESH' }
  | { type: 'SUCCESS'; profile: Profile | null; plan: WeeklyPlan | null; trainings: DayTraining[]; checkins: Checkin[]; isLocked: boolean; lockedWeekNumber: number; lastWeekSummary: LastWeekSummary | null }
  | { type: 'ERROR'; message: string }
  | { type: 'DONE' }
```

No `reducer`, substituir o case `'SUCCESS'`:
```ts
case 'SUCCESS':
  return {
    ...state,
    profile: action.profile,
    plan: action.plan,
    trainings: action.trainings,
    checkins: action.checkins,
    isLocked: action.isLocked,
    lockedWeekNumber: action.lockedWeekNumber,
    lastWeekSummary: action.lastWeekSummary,
    error: null,
  }
```

Substituir `initialState`:
```ts
const initialState: State = {
  profile: null,
  plan: null,
  trainings: [],
  checkins: [],
  isLocked: false,
  lockedWeekNumber: 0,
  lastWeekSummary: null,
  isLoading: false,
  error: null,
  tick: 0,
}
```

- [ ] **Step 3.7: Atualizar o dispatch `SUCCESS` no `useEffect`**

Dentro de `.then(({ profile, plan, rawTrainings, checkins })` → adicionar os novos campos ao dispatch e ao destructuring:

```ts
.then(({ profile, plan, rawTrainings, checkins, isLocked, lockedWeekNumber, lastWeekSummary }) => {
  if (sig.cancelled) return
  dispatch({
    type: 'SUCCESS',
    profile,
    plan,
    trainings: rawTrainings
      .map(wpt => {
        const training = wpt.trainings
        if (!training) return null
        return {
          weeklyPlanTrainingId: wpt.id,
          dayOfWeek: wpt.day_of_week,
          training,
          checkin: checkins.find(c => c.training_id === wpt.training_id) ?? null,
        }
      })
      .filter((x): x is DayTraining => x !== null),
    checkins,
    isLocked,
    lockedWeekNumber,
    lastWeekSummary,
  })
})
```

- [ ] **Step 3.8: Atualizar `UseWeeklyPlanResult` e o return do hook**

Substituir o tipo `UseWeeklyPlanResult`:
```ts
export type UseWeeklyPlanResult = {
  profile: Profile | null
  plan: WeeklyPlan | null
  trainings: DayTraining[]
  checkins: Checkin[]
  isLocked: boolean
  lockedWeekNumber: number
  lastWeekSummary: LastWeekSummary | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}
```

Substituir o return final de `useWeeklyPlan`:
```ts
const { profile, plan, trainings, checkins, isLocked, lockedWeekNumber, lastWeekSummary, isLoading, error } = state
return { profile, plan, trainings, checkins, isLocked, lockedWeekNumber, lastWeekSummary, isLoading, error, refresh }
```

- [ ] **Step 3.9: Verificar lint e TypeScript**

```bash
npm run lint && npx tsc --noEmit
```

Esperado: sem output de erros.

- [ ] **Step 3.10: Commit**

```bash
git add src/hooks/useWeeklyPlan.ts
git commit -m "feat(weekly-plan): adiciona estado de lock e lastWeekSummary"
```

---

## Task 4: `AdminTurmaDetail` — chips de lock + banner

**Files:**
- Modify: `src/pages/admin/AdminTurmaDetail.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 4.1: Adicionar Toaster ao App.tsx**

Em `src/App.tsx`, adicionar o import e o componente:

```ts
// Adicionar ao bloco de imports:
import { Toaster } from 'sonner'
```

Substituir o return de `App`:
```tsx
export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="bottom-center" richColors />
    </>
  )
}
```

- [ ] **Step 4.2: Adicionar imports em `AdminTurmaDetail.tsx`**

Na linha 1 do arquivo, adicionar `toast` ao import do sonner:
```ts
import { toast } from 'sonner'
```

- [ ] **Step 4.3: Adicionar `releaseThrough` na destructuring e estado `releasing`**

Localizar a linha que desestrutura `useGroupPlanMutations` (linha ~74):
```ts
const { addTraining, removeTraining, createAndAddTraining } =
  useGroupPlanMutations(id ?? '', cycleStart, plan?.id ?? null)
```

Substituir por:
```ts
const { addTraining, removeTraining, createAndAddTraining, releaseThrough } =
  useGroupPlanMutations(id ?? '', cycleStart, plan?.id ?? null)
```

Logo após, após os `useState` existentes (linha ~83), adicionar:
```ts
const [releasing, setReleasing] = useState(false)
```

- [ ] **Step 4.4: Adicionar a função `handleRelease`**

Após a função `handleCreateTraining` (linha ~150), adicionar:

```ts
async function handleRelease(weekNumber: 1 | 2 | 3 | 4) {
  if (!plan || weekNumber <= plan.released_through_week) return
  setReleasing(true)
  try {
    await releaseThrough(weekNumber)
    refresh()
    const msg = weekNumber === 4
      ? 'Todas as semanas liberadas para os alunos'
      : `Semana ${weekNumber} liberada para os alunos`
    toast.success(msg)
  } catch (e) {
    toast.error((e as Error)?.message ?? 'Erro ao liberar semana')
  } finally {
    setReleasing(false)
  }
}
```

- [ ] **Step 4.5: Passar novas props para `WeekView` no JSX**

Localizar o trecho que renderiza `<WeekView` (linha ~221):
```tsx
<WeekView
  cycleStart={cycleStart}
  selectedWeek={effectiveWeek}
  trainings={trainings}
  panelEntry={panel?.existing ?? null}
  onNavigate={setSelectedWeek}
  onSlotClick={openSlot}
  onCardClick={openCard}
/>
```

Substituir por:
```tsx
<WeekView
  cycleStart={cycleStart}
  selectedWeek={effectiveWeek}
  trainings={trainings}
  panelEntry={panel?.existing ?? null}
  releasedThroughWeek={plan?.released_through_week ?? null}
  releasing={releasing}
  onNavigate={setSelectedWeek}
  onSlotClick={openSlot}
  onCardClick={openCard}
  onRelease={handleRelease}
/>
```

- [ ] **Step 4.6: Atualizar a assinatura e props de `WeekView`**

Localizar a definição do componente `WeekView` (linha ~265). Substituir a assinatura completa:

```tsx
function WeekView({
  cycleStart,
  selectedWeek,
  trainings,
  panelEntry,
  releasedThroughWeek,
  releasing,
  onNavigate,
  onSlotClick,
  onCardClick,
  onRelease,
}: {
  cycleStart: string
  selectedWeek: number
  trainings: GroupDayTraining[]
  panelEntry: GroupDayTraining | null
  releasedThroughWeek: number | null
  releasing: boolean
  onNavigate: (week: number) => void
  onSlotClick: (weekNumber: number, dayOfWeek: number) => void
  onCardClick: (entry: GroupDayTraining) => void
  onRelease: (week: 1 | 2 | 3 | 4) => void
})
```

- [ ] **Step 4.7: Substituir os dots de semana por chips com status de lock**

Dentro de `WeekView`, localizar o bloco dos dots (linhas ~298–312):
```tsx
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
```

Substituir por:
```tsx
<div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '6px' }}>
  {[1, 2, 3, 4].map(w => {
    const isActive = w === selectedWeek
    const isReleased = releasedThroughWeek !== null && w <= releasedThroughWeek
    return (
      <button
        key={w}
        onClick={() => onNavigate(w)}
        style={{
          padding: '2px 7px', borderRadius: '5px', border: 'none', cursor: 'pointer',
          fontSize: '9px', fontWeight: 700, lineHeight: 1.4,
          background: isActive ? '#E8521A' : isReleased ? '#4caf5022' : '#1e1e1e',
          color: isActive ? '#fff' : isReleased ? '#4caf50' : '#3a3a3a',
        }}
      >
        S{w} {releasedThroughWeek !== null ? (isReleased ? '✓' : '🔒') : ''}
      </button>
    )
  })}
</div>
```

- [ ] **Step 4.8: Adicionar o banner de liberação dentro de `WeekView`**

Dentro de `WeekView`, após o bloco de week navigation (fechamento do `</div>` do nav, linha ~320), e antes do bloco `{/* Day grid */}`, adicionar:

```tsx
{/* Banner de liberação — só quando semana ativa está bloqueada */}
{releasedThroughWeek !== null && selectedWeek > releasedThroughWeek && (
  <div style={{
    margin: '0 16px 8px',
    background: '#E8521A0f',
    border: '1px solid #E8521A33',
    borderRadius: '9px',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  }}>
    <div>
      <div style={{ color: '#E8521A', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
        Semana {selectedWeek} bloqueada
      </div>
      <div style={{ color: '#666', fontSize: '10px' }}>
        Alunos não veem os treinos desta semana
      </div>
    </div>
    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
      <button
        onClick={() => onRelease(selectedWeek as 1 | 2 | 3 | 4)}
        disabled={releasing}
        style={{
          background: '#E8521A', color: '#fff', border: 'none',
          borderRadius: '6px', padding: '6px 12px', fontSize: '10px',
          fontWeight: 700, cursor: releasing ? 'not-allowed' : 'pointer',
          opacity: releasing ? 0.6 : 1,
        }}
      >
        {releasing ? '...' : `Liberar S${selectedWeek}`}
      </button>
      <button
        onClick={() => onRelease(4)}
        disabled={releasing}
        style={{
          background: '#1e1e1e', color: '#666',
          border: '1px solid #2a2a2a', borderRadius: '6px',
          padding: '6px 10px', fontSize: '10px',
          cursor: releasing ? 'not-allowed' : 'pointer',
          opacity: releasing ? 0.6 : 1,
        }}
      >
        Liberar tudo
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4.9: Verificar lint e TypeScript**

```bash
npm run lint && npx tsc --noEmit
```

Esperado: sem output de erros.

- [ ] **Step 4.10: Commit**

```bash
git add src/pages/admin/AdminTurmaDetail.tsx src/App.tsx
git commit -m "feat(admin): chips de lock nas semanas + banner de liberação"
```

---

## Task 5: `AlunoDashboard` — tela bloqueada

**Files:**
- Modify: `src/pages/aluno/AlunoDashboard.tsx`
- Modify: `src/pages/aluno/AlunoDashboard.module.css`

- [ ] **Step 5.1: Atualizar o import de `useWeeklyPlan`**

Na linha 4 do `AlunoDashboard.tsx`, adicionar os novos tipos ao import:
```ts
import { useWeeklyPlan, type DayTraining, type LastWeekSummary } from '../../hooks/useWeeklyPlan'
```

- [ ] **Step 5.2: Atualizar a destructuring do hook no componente principal**

Localizar linha ~572:
```ts
const { profile, plan, trainings, isLoading, error, refresh } = useWeeklyPlan(user?.id)
```

Substituir por:
```ts
const { profile, plan, trainings, isLocked, lockedWeekNumber, lastWeekSummary, isLoading, error, refresh } = useWeeklyPlan(user?.id)
```

- [ ] **Step 5.3: Adicionar o componente `LockedScreen`**

Adicionar antes do componente `AlunoDashboard` (antes da linha `export default function AlunoDashboard()`), após `EmptyState`:

```tsx
// ── Locked Screen ─────────────────────────────────────────────────────────────

function LockedScreen({ lockedWeekNumber, lastWeekSummary }: {
  lockedWeekNumber: number
  lastWeekSummary: LastWeekSummary | null
}) {
  return (
    <div className={styles.trainingList}>
      {/* Semana 2+: resumo da semana anterior (só se tiver check-ins) */}
      {lastWeekSummary !== null && lastWeekSummary.checkinCount > 0 && (
        <div className={styles.lockedLastWeek}>
          <div className={styles.lockedLastWeekTitle}>
            Semana {lockedWeekNumber - 1} concluída ✓
          </div>
          <div className={styles.lockedMetrics}>
            <div className={styles.lockedMetric}>
              <span className={styles.lockedMetricValue}>{lastWeekSummary.checkinCount}</span>
              <span className={styles.lockedMetricLabel}>treinos</span>
            </div>
            <div className={styles.lockedMetric}>
              <span className={styles.lockedMetricValue}>{(lastWeekSummary.totalDistanceM / 1000).toFixed(0)}</span>
              <span className={styles.lockedMetricLabel}>km</span>
            </div>
            {lastWeekSummary.avgPaceSecondsPerKm !== null && (
              <div className={styles.lockedMetric}>
                <span className={styles.lockedMetricValue}>{formatPace(lastWeekSummary.avgPaceSecondsPerKm)}</span>
                <span className={styles.lockedMetricLabel}>pace médio</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Semana 1 bloqueada — boas-vindas */}
      {lastWeekSummary === null && (
        <div className={styles.lockedWelcome}>
          <div className={styles.lockedWelcomeIcon}>🏃</div>
          <p className={styles.lockedWelcomeTitle}>Pronto para correr?</p>
          <p className={styles.lockedWelcomeText}>
            Seu professor está preparando o plano da primeira semana.
          </p>
        </div>
      )}

      {/* Card "a caminho" */}
      <div className={styles.lockedComing}>
        <span className={styles.lockedComingIcon}>⏳</span>
        <div>
          <p className={styles.lockedComingTitle}>Semana {lockedWeekNumber} a caminho</p>
          <p className={styles.lockedComingText}>Seu professor está preparando os treinos. Em breve! 💪</p>
        </div>
      </div>

      {/* Barra de progresso do ciclo S1–S4 */}
      <div className={styles.lockedCycle}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} className={styles.lockedCycleItem}>
            <div className={`${styles.lockedCycleBar} ${
              n < lockedWeekNumber ? styles.lockedCycleBarDone :
              n === lockedWeekNumber ? styles.lockedCycleBarCurrent :
              styles.lockedCycleBarFuture
            }`} />
            <span className={`${styles.lockedCycleLabel} ${
              n < lockedWeekNumber ? styles.lockedCycleLabelDone :
              n === lockedWeekNumber ? styles.lockedCycleLabelCurrent :
              styles.lockedCycleLabelFuture
            }`}>S{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5.4: Adicionar as classes CSS ao módulo**

Abrir `src/pages/aluno/AlunoDashboard.module.css` e adicionar no final do arquivo:

```css
/* ── Locked Screen ─────────────────────────────────────────────────────────── */

.lockedLastWeek {
  background: #0d1f0d;
  border: 1px solid #4caf5033;
  border-radius: 12px;
  padding: 14px;
}

.lockedLastWeekTitle {
  color: #4caf50;
  font-size: 12px;
  font-weight: 700;
  margin: 0 0 10px;
}

.lockedMetrics {
  display: flex;
  gap: 8px;
}

.lockedMetric {
  flex: 1;
  background: #111;
  border-radius: 8px;
  padding: 8px;
  text-align: center;
}

.lockedMetricValue {
  display: block;
  color: #E8521A;
  font-size: 16px;
  font-weight: 800;
}

.lockedMetricLabel {
  display: block;
  color: #555;
  font-size: 9px;
  font-weight: 600;
  margin-top: 2px;
}

.lockedWelcome {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
}

.lockedWelcomeIcon {
  font-size: 32px;
  display: block;
  margin-bottom: 10px;
}

.lockedWelcomeTitle {
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  margin: 0 0 6px;
}

.lockedWelcomeText {
  color: #666;
  font-size: 10px;
  line-height: 1.6;
  margin: 0;
}

.lockedComing {
  background: linear-gradient(135deg, #E8521A18, #E8521A08);
  border: 1px solid #E8521A33;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.lockedComingIcon {
  font-size: 28px;
  flex-shrink: 0;
  animation: lockedPulse 2s ease-in-out infinite;
}

@keyframes lockedPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

.lockedComingTitle {
  color: #E8521A;
  font-size: 12px;
  font-weight: 800;
  margin: 0 0 3px;
}

.lockedComingText {
  color: #666;
  font-size: 10px;
  line-height: 1.5;
  margin: 0;
}

.lockedCycle {
  display: flex;
  gap: 4px;
}

.lockedCycleItem {
  flex: 1;
  text-align: center;
}

.lockedCycleBar {
  height: 4px;
  border-radius: 2px;
  margin-bottom: 4px;
}

.lockedCycleBarDone    { background: #4caf50; }
.lockedCycleBarCurrent { background: #E8521A55; animation: lockedPulse 2s ease-in-out infinite; }
.lockedCycleBarFuture  { background: #2a2a2a; }

.lockedCycleLabel {
  font-size: 8px;
  font-weight: 700;
}

.lockedCycleLabelDone    { color: #4caf50; }
.lockedCycleLabelCurrent { color: #E8521A; }
.lockedCycleLabelFuture  { color: #444; }
```

- [ ] **Step 5.5: Adicionar o render condicional no `AlunoDashboard`**

Localizar o bloco de render dos treinos (linha ~644):
```tsx
{/* Treinos */}
{!plan ? (
  <EmptyState />
) : (
  <div className={styles.trainingList}>
    ...
  </div>
)}
```

Substituir por:
```tsx
{/* Treinos */}
{isLocked ? (
  <LockedScreen
    lockedWeekNumber={lockedWeekNumber}
    lastWeekSummary={lastWeekSummary}
  />
) : !plan ? (
  <EmptyState />
) : (
  <div className={styles.trainingList}>
    {sorted.map(dt => (
      <TrainingCard
        key={dt.weeklyPlanTrainingId}
        dayTraining={dt}
        planId={plan.id}
        userId={user.id}
        isToday={dt.dayOfWeek === todayDow}
        onCheckinSuccess={refresh}
      />
    ))}
  </div>
)}
```

- [ ] **Step 5.6: Verificar lint e TypeScript**

```bash
npm run lint && npx tsc --noEmit
```

Esperado: sem output de erros.

- [ ] **Step 5.7: Commit**

```bash
git add src/pages/aluno/AlunoDashboard.tsx src/pages/aluno/AlunoDashboard.module.css
git commit -m "feat(aluno): tela bloqueada quando semana ainda não foi liberada"
```

---

## Task 6: Docs + validação final + push

**Files:**
- Modify: `CLAUDE.md`
- Modify: `GEMINI.md`

- [ ] **Step 6.1: Atualizar CLAUDE.md**

Em `CLAUDE.md`, localizar a entrada de `group_plans` na tabela de GRANTs e adicionar nota sobre `released_through_week`. Na seção de plano de grupo, substituir:

> `group_plans` (id, group_id, starts_at, notes, created_by)

por:

> `group_plans` (id, group_id, starts_at, notes, created_by, **released_through_week smallint DEFAULT 0** — 0=bloqueado, 1–4=semanas liberadas até N, unidirecional)

Também atualizar a seção "Estado atual" adicionando a feature como concluída.

- [ ] **Step 6.2: Atualizar GEMINI.md**

Fazer a mesma atualização em `GEMINI.md` (mesma informação de `released_through_week`).

- [ ] **Step 6.3: Validação final**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

Esperado:
- `npm run lint` → sem output (0 erros)
- `npx tsc --noEmit` → sem output (0 erros)  
- `npm run build` → `✓ built in X.XXs`

- [ ] **Step 6.4: Commit final e push**

```bash
git add CLAUDE.md GEMINI.md
git commit -m "docs: documenta released_through_week e atualiza estado do projeto"
git push
```

---

## Checklist de verificação manual (após implementação)

- [ ] Admin: abrir `/admin/turmas/:id` — chips S1–S4 mostram `🔒` quando `released_through_week = 0`
- [ ] Admin: clicar "Liberar S1" → chip S1 passa para `✓`, banner some, toast verde aparece
- [ ] Admin: clicar "Liberar tudo" → todos os chips passam para `✓`
- [ ] Aluno: com plano bloqueado → ver tela "a caminho" (não trainings)
- [ ] Aluno: com plano liberado → ver trainings normalmente
- [ ] Planos existentes (released_through_week = 4 via backfill) → aluno continua vendo trainings
