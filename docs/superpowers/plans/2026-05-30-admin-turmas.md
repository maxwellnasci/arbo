# Admin Turmas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `/admin/turmas` — lista de turmas com nome, objetivo, frequência, tipo de plano, status e contagem de alunos.

**Architecture:** Hook `useAdminTurmas` faz duas queries paralelas (`groups` + contagem de alunos via `profiles.group_id`) e monta `GroupWithCount[]`. Componente `AdminTurmas` + subcomponente `TurmaRow` seguem o mesmo padrão visual de `AdminAlunos`. Routing, sidebar e stat card em `AdminHome` são atualizados na mesma entrega.

**Tech Stack:** React 19, TypeScript, Supabase JS client, React Router v6, inline styles (padrão do projeto)

---

## Pré-requisito: Migração de schema (MANUAL — executar antes de qualquer código)

O usuário deve rodar este SQL no **Supabase Dashboard → SQL Editor** e depois regenerar os tipos:

```sql
ALTER TABLE public.profiles
ADD COLUMN group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;
```

Depois:

```bash
npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts
```

Remover linhas de aviso do CLI que poluam o arquivo (ver padrão da sessão anterior — aviso vai para stdout).

```bash
npx tsc --noEmit
```

Esperado: 0 erros. Verificar que `profiles.Row` agora inclui `group_id: string | null`.

---

## Mapa de arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/hooks/useAdminTurmas.ts` |
| Criar | `src/pages/admin/AdminTurmas.tsx` |
| Modificar | `src/App.tsx` |
| Modificar | `src/pages/admin/AdminSidebar.tsx` |
| Modificar | `src/pages/admin/AdminHome.tsx` |

---

## Task 1: Hook `useAdminTurmas`

**Files:**
- Create: `src/hooks/useAdminTurmas.ts`

- [ ] **Step 1: Criar o hook**

Criar `src/hooks/useAdminTurmas.ts` com o seguinte conteúdo:

```ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group } from '../lib/types'

export type GroupWithCount = Group & { studentCount: number }

export function useAdminTurmas() {
  const [turmas, setTurmas] = useState<GroupWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchTurmas() {
      const [
        { data: groups, error: groupsError },
        { data: members, error: membersError },
      ] = await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase
          .from('profiles')
          .select('group_id')
          .eq('role', 'aluno')
          .not('group_id', 'is', null),
      ])

      if (cancelled) return

      if (groupsError || membersError) {
        setError(groupsError?.message ?? membersError?.message ?? 'Erro desconhecido')
        setIsLoading(false)
        return
      }

      const countMap = new Map<string, number>()
      for (const m of members ?? []) {
        if (m.group_id) {
          countMap.set(m.group_id, (countMap.get(m.group_id) ?? 0) + 1)
        }
      }

      const result: GroupWithCount[] = (groups ?? []).map(g => ({
        ...g,
        studentCount: countMap.get(g.id) ?? 0,
      }))

      setTurmas(result)
      setIsLoading(false)
    }

    fetchTurmas()
    return () => { cancelled = true }
  }, [])

  return { turmas, isLoading, error }
}
```

- [ ] **Step 2: Validar tipos**

```bash
npx tsc --noEmit
```

Esperado: 0 erros. Se `group_id` não estiver nos tipos, a migração do pré-requisito não foi rodada — parar e executar antes de continuar.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdminTurmas.ts
git commit -m "feat: add useAdminTurmas hook with student count"
```

---

## Task 2: Componente `AdminTurmas`

**Files:**
- Create: `src/pages/admin/AdminTurmas.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/pages/admin/AdminTurmas.tsx`:

```tsx
import { useAdminTurmas, type GroupWithCount } from '../../hooks/useAdminTurmas'

const goalLabel: Record<string, string> = {
  '5k': '5K',
  '10k': '10K',
  '21k': '21K',
  evoluir_10k: 'Evolução 10K',
  evoluir_21k: 'Evolução 21K',
}

const frequencyLabel: Record<string, string> = {
  '2x': '2×/sem',
  '3x': '3×/sem',
}

const planTypeLabel: Record<string, string> = {
  grupo: 'Grupo',
  individual: 'Individual',
}

export default function AdminTurmas() {
  const { turmas, isLoading, error } = useAdminTurmas()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Turmas</h1>
        <button
          disabled
          style={{
            background: '#E8521A',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 600,
            opacity: 0.4,
            cursor: 'not-allowed',
          }}
        >
          + Nova Turma
        </button>
      </div>

      {error && <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : turmas.length === 0 ? (
        <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#555' }}>Nenhuma turma cadastrada ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {turmas.map((turma: GroupWithCount) => (
            <TurmaRow key={turma.id} turma={turma} />
          ))}
        </div>
      )}
    </div>
  )
}

function TurmaRow({ turma }: { turma: GroupWithCount }) {
  return (
    <div
      style={{
        background: '#1c1c1e',
        borderRadius: '10px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid #2a2a2a',
        gap: '12px',
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
          ● {turma.is_active ? 'Ativa' : 'Inativa'}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Validar tipos**

```bash
npx tsc --noEmit
```

Esperado: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AdminTurmas.tsx
git commit -m "feat: add AdminTurmas page component"
```

---

## Task 3: Roteamento, sidebar e fix no AdminHome

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/admin/AdminSidebar.tsx`
- Modify: `src/pages/admin/AdminHome.tsx`

- [ ] **Step 1: Adicionar rota em `App.tsx`**

Adicionar import e rota. O arquivo atual tem:

```tsx
import AdminConvites from './pages/admin/AdminConvites'
```

Adicionar após essa linha:

```tsx
import AdminTurmas from './pages/admin/AdminTurmas'
```

No bloco de rotas, o array `children` do `/admin` está assim:

```tsx
children: [
  { index: true, element: <AdminHome /> },
  { path: 'alunos', element: <AdminAlunos /> },
  { path: 'feedbacks', element: <AdminFeedbacks /> },
  { path: 'convites', element: <AdminConvites /> },
]
```

Adicionar a rota de turmas:

```tsx
children: [
  { index: true, element: <AdminHome /> },
  { path: 'alunos', element: <AdminAlunos /> },
  { path: 'feedbacks', element: <AdminFeedbacks /> },
  { path: 'convites', element: <AdminConvites /> },
  { path: 'turmas', element: <AdminTurmas /> },
]
```

- [ ] **Step 2: Ativar link de Turmas em `AdminSidebar.tsx`**

Localizar a linha atual com o item desabilitado:

```ts
{ to: '/admin/turmas', label: 'Turmas (em breve)', disabled: true },
```

Substituir por:

```ts
{ to: '/admin/turmas', label: 'Turmas', exact: false },
```

(O campo `disabled` ausente é tratado como `false` pelo código de renderização existente.)

- [ ] **Step 3: Corrigir stat card "Turmas ativas" em `AdminHome.tsx`**

**3a.** Atualizar o tipo `Stats` (linha ~8) de:

```ts
type Stats = {
  totalAlunos: number
  feedbacksThisWeek: number
  prsThisWeek: number
}
```

Para:

```ts
type Stats = {
  totalAlunos: number
  feedbacksThisWeek: number
  prsThisWeek: number
  turmasAtivas: number
}
```

**3b.** Atualizar o estado inicial (linha ~16):

```ts
const [stats, setStats] = useState<Stats>({ totalAlunos: 0, feedbacksThisWeek: 0, prsThisWeek: 0, turmasAtivas: 0 })
```

**3c.** Atualizar o `Promise.all` em `fetchStats`. Substituir o bloco atual:

```ts
const [
  { count: totalAlunos },
  { count: feedbacksThisWeek },
  { data: prs },
] = await Promise.all([
  supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('id', user!.id),
  supabase.from('checkins').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
  supabase.from('records').select('*, profiles(*)').gte('created_at', weekAgoIso).order('created_at', { ascending: false }).limit(5),
])

setStats({
  totalAlunos: totalAlunos ?? 0,
  feedbacksThisWeek: feedbacksThisWeek ?? 0,
  prsThisWeek: prs?.length ?? 0,
})
```

Por:

```ts
const [
  { count: totalAlunos },
  { count: feedbacksThisWeek },
  { data: prs },
  { count: turmasAtivas },
] = await Promise.all([
  supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'aluno'),
  supabase.from('checkins').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
  supabase.from('records').select('*, profiles(*)').gte('created_at', weekAgoIso).order('created_at', { ascending: false }).limit(5),
  supabase.from('groups').select('id', { count: 'exact', head: true }).eq('is_active', true),
])

setStats({
  totalAlunos: totalAlunos ?? 0,
  feedbacksThisWeek: feedbacksThisWeek ?? 0,
  prsThisWeek: prs?.length ?? 0,
  turmasAtivas: turmasAtivas ?? 0,
})
```

Note: a query de `totalAlunos` muda de `.neq('id', user!.id)` para `.eq('role', 'aluno')` — alinhado com o fix aplicado em `useAdminAlunos`. O `user` não é mais necessário na query, mas o `useEffect` ainda depende de `user` por outro motivo (guard `if (!user) return`).

**3d.** Atualizar o `StatCard` "Turmas ativas" no JSX. Localizar:

```tsx
<StatCard label="Turmas ativas" value="—" muted />
```

Substituir por:

```tsx
<StatCard label="Turmas ativas" value={isLoading ? '…' : String(stats.turmasAtivas)} />
```

- [ ] **Step 4: Validar tipos**

```bash
npx tsc --noEmit
```

Esperado: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/admin/AdminSidebar.tsx src/pages/admin/AdminHome.tsx
git commit -m "feat: wire /admin/turmas route and fix stat cards in AdminHome"
```

---

## Task 4: Validação visual

- [ ] **Step 1: Subir o servidor de desenvolvimento**

```bash
npm run dev
```

Abrir `http://localhost:5173` e logar como admin.

- [ ] **Step 2: Verificar sidebar**

O item "Turmas" deve aparecer como link clicável (não mais acinzentado). Clicar nele deve navegar para `/admin/turmas`.

- [ ] **Step 3: Verificar tela vazia**

Se não houver turmas no banco, deve aparecer:
> "Nenhuma turma cadastrada ainda." em card cinza centralizado.

- [ ] **Step 4: Inserir turma de teste e verificar tela preenchida**

Inserir via Supabase Dashboard → SQL Editor:

```sql
INSERT INTO public.groups (name, goal, frequency, plan_type, is_active)
VALUES ('Turma 5K Manhã', '5k', '3x', 'grupo', true);
```

Recarregar a tela. Deve aparecer:
- Nome: "Turma 5K Manhã"
- Meta: "5K · 3×/sem · Grupo"
- Badge verde: "● Ativa"
- Contagem: "0 alunos"

- [ ] **Step 5: Verificar AdminHome**

Navegar para `/admin`. O card "Turmas ativas" deve mostrar `1` (ou o número real de turmas ativas).

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat: implement /admin/turmas list page

- useAdminTurmas hook with parallel queries and student count
- AdminTurmas component matching AdminAlunos visual pattern
- TurmaRow subcomponent with goal/frequency/plan_type labels
- Route /admin/turmas wired in App.tsx
- AdminSidebar: Turmas link activated
- AdminHome: turmasAtivas stat now shows real count"
```
