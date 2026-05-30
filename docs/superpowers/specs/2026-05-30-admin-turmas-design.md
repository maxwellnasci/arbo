# Admin Turmas — Design Spec

> Data: 2026-05-30
> Escopo: `/admin/turmas` — lista de turmas com contagem de alunos

---

## Contexto

A tabela `groups` foi criada na Fase 2 do schema (2026-05-30) com os campos:
`id`, `name`, `goal`, `frequency`, `plan_type`, `starts_at`, `is_active`, `created_at`, `updated_at`.

A coluna `group_id` ainda não existe em `profiles` — esta feature adiciona essa FK.
A tela `/admin/turmas` estava marcada como "em breve" na sidebar. Este spec a torna real.

---

## Objetivo

Exibir para o professor a lista de todas as turmas cadastradas, com dados suficientes para
identificar objetivo, frequência, tipo de plano, status e quantos alunos estão em cada turma.

---

## Schema — migração obrigatória antes da implementação

```sql
ALTER TABLE public.profiles
ADD COLUMN group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;
```

- Nullable: alunos existentes sem turma ficam com `NULL`
- `ON DELETE SET NULL`: deletar uma turma não quebra o perfil do aluno

---

## Arquitetura

### Hook: `useAdminTurmas`

Arquivo: `src/hooks/useAdminTurmas.ts`

Duas queries em `Promise.all`:

1. `supabase.from('groups').select('*').order('name')` — todas as turmas
2. `supabase.from('profiles').select('group_id').eq('role', 'aluno').not('group_id', 'is', null)` — alunos com turma atribuída

O hook monta um `Map<groupId, count>` a partir da query 2 e combina com a query 1:

```ts
type GroupWithCount = Group & { studentCount: number }
```

Retorna: `{ turmas: GroupWithCount[], isLoading: boolean, error: string | null }`

Padrão idêntico ao `useAdminFeedbacks` (queries paralelas, estado local, `cancelled` flag).

---

### Componente: `AdminTurmas`

Arquivo: `src/pages/admin/AdminTurmas.tsx`

Estrutura:
```
<div>
  Header: <h1>Turmas</h1> + botão "+ Nova Turma" (desabilitado, opacity 0.4)
  Error state
  Loading state: "Carregando…"
  Empty state: card #1c1c1e centralizado
  Lista: flex-column gap 8px → <TurmaRow> por item
</div>
```

Subcomponente `TurmaRow`:
- Card `background: #1c1c1e`, `border: 1px solid #2a2a2a`, `borderRadius: 10px`, `padding: 14px 16px`
- Layout: flex, `justifyContent: space-between`, `alignItems: center`
- **Esquerda:**
  - Nome da turma: branco, `14px`, `fontWeight 600`
  - Metadados: `Objetivo · Frequência · Plano` — cor `#888`, `12px`
- **Direita:**
  - Badge status: `● Ativa` (verde `#4caf50`) ou `● Inativa` (cinza `#555`), `12px`
  - Contagem: `N alunos` — cor `#aaa`, `12px`

#### Labels de exibição

| Valor no banco | Exibição |
|---|---|
| `5k` | `5K` |
| `10k` | `10K` |
| `21k` | `21K` |
| `evoluir_10k` | `Evolução 10K` |
| `evoluir_21k` | `Evolução 21K` |
| `2x` | `2×/sem` |
| `3x` | `3×/sem` |
| `grupo` | `Grupo` |
| `individual` | `Individual` |

---

### Botão "+ Nova Turma"

Presente desde o início com `opacity: 0.4` e `cursor: 'not-allowed'` — sinaliza feature futura
sem exibir texto "(em breve)". Sem handler por enquanto.

---

## Alterações em arquivos existentes

### `App.tsx`
Adicionar rota dentro do bloco `/admin`:
```tsx
{ path: 'turmas', element: <AdminTurmas /> }
```

### `AdminSidebar.tsx`
Remover `disabled: true` do item "Turmas" e atualizar label:
```ts
{ to: '/admin/turmas', label: 'Turmas', exact: false }
```

### `AdminHome.tsx`
O card "Turmas ativas" está hardcoded com `"—"`. Corrigir para buscar o total real:
```ts
supabase.from('groups').select('id', { count: 'exact', head: true }).eq('is_active', true)
```
Adicionar ao `Promise.all` existente em `fetchStats`.

### `src/lib/types.ts`
Após a migração e regeneração dos tipos, adicionar:
```ts
// Já existe: export type Group = Database['public']['Tables']['groups']['Row']
// Adicionar alias com contagem para uso no hook:
// (definido localmente no hook como GroupWithCount = Group & { studentCount: number })
```
Nenhuma alteração necessária em `types.ts` — `GroupWithCount` é tipo local do hook.

---

## Fluxo de dados

```
Supabase DB
  ├── groups (SELECT *)
  └── profiles (SELECT group_id WHERE role='aluno' AND group_id IS NOT NULL)
        ↓
  useAdminTurmas
    ├── monta Map<groupId, count>
    └── retorna GroupWithCount[]
        ↓
  AdminTurmas
    └── TurmaRow × N
```

---

## Estados da tela

| Estado | UI |
|---|---|
| Loading | `"Carregando…"` em `#555` |
| Erro | Mensagem em `#ff6b6b` |
| Vazio | Card cinza com `"Nenhuma turma cadastrada ainda."` |
| Preenchido | Lista de `TurmaRow` |

---

## Ordem de implementação

1. Executar migração SQL (`group_id` em `profiles`)
2. Regenerar tipos TypeScript
3. Criar `useAdminTurmas.ts`
4. Criar `AdminTurmas.tsx`
5. Atualizar `App.tsx` (rota)
6. Atualizar `AdminSidebar.tsx` (ativar link)
7. Atualizar `AdminHome.tsx` (contar turmas ativas)
8. `tsc --noEmit` — zero erros

---

## Fora do escopo deste spec

- Criar/editar turmas (modal — Fase 3)
- Atribuir alunos a turmas (tela separada)
- `/admin/turmas/:id` — grid do plano mensal (próximo spec)
