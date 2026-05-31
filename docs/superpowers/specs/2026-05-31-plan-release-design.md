# Spec: Controle de Liberação do Plano

> Data: 2026-05-31  
> Status: aprovado  
> Área: Admin + Aluno  

---

## Contexto

O professor monta o plano de 4 semanas de uma turma antecipadamente. Até agora, todos os treinos ficavam visíveis para o aluno imediatamente. Esta feature adiciona controle: o professor decide quando liberar cada semana — semana a semana conforme os alunos avançam, ou tudo de uma vez.

---

## Decisões de design

| Decisão | Escolha |
|---|---|
| Estado padrão de novos planos | Bloqueado (`released_through_week = 0`) |
| Direção da liberação | Unidirecional — uma vez liberada, a semana não volta |
| Granularidade | Semana inteira (não por dia) |
| Liberação não-sequencial | Não suportada — liberar S3 implica S1 e S2 já liberadas |
| Liberação em lote | "Liberar tudo" define `released_through_week = 4` |
| Backfill de planos existentes | `UPDATE group_plans SET released_through_week = 4` — mantém comportamento atual |

---

## Schema

### Alteração em `group_plans`

```sql
ALTER TABLE group_plans
  ADD COLUMN released_through_week smallint NOT NULL DEFAULT 0;

-- Backfill: planos existentes ficam totalmente liberados
UPDATE group_plans SET released_through_week = 4;
```

**Semântica da coluna:**
- `0` — nada liberado (padrão para novos planos)
- `1` — semana 1 liberada
- `2` — semanas 1 e 2 liberadas
- `3` — semanas 1, 2 e 3 liberadas
- `4` — ciclo inteiro liberado

Sem alteração de RLS ou GRANTs — a checagem é feita no cliente. O controle de liberação é pedagógico, não um limite de segurança.

Após aplicar no banco: regenerar `database.types.ts`:
```bash
npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts
```

---

## Camada de dados (hooks)

### `useGroupPlanMutations` — novo método

```ts
releaseThrough(weekNumber: 1 | 2 | 3 | 4): Promise<void>
```

- Executa `UPDATE group_plans SET released_through_week = weekNumber WHERE id = planId`
- Só aceita valor maior que o atual (unidirecional) — guarda `if (weekNumber <= plan.released_through_week) return` no cliente antes de chamar
- `planId` sempre existe quando chamado (banner só aparece com `plan !== null`)
- Usado por "Liberar S{n}" (`releaseThrough(n)`) e "Liberar tudo" (`releaseThrough(4)`)

### `useWeeklyPlan` — novos campos de retorno

Após buscar `groupPlan`, o hook verifica:

```ts
const isLocked = weekNumber > (groupPlan.released_through_week ?? 0)
```

Se `isLocked = true`:
- Não busca `group_plan_trainings`
- Busca check-ins da semana anterior: `.eq('student_id', userId).eq('week_start', previousMonday)`
- Calcula `lastWeekSummary` a partir dos check-ins encontrados

Novos campos no tipo `UseWeeklyPlanResult`:

```ts
isLocked: boolean
lockedWeekNumber: number        // semana bloqueada (para "Semana X a caminho")
lastWeekSummary: {
  checkinCount: number
  totalDistanceM: number
  avgPaceSecondsPerKm: number | null  // null se nenhum check-in tiver pace calculável
} | null                        // null quando weekNumber = 1 (sem histórico anterior)
```

Quando `isLocked = false`: campos `isLocked = false`, `lastWeekSummary = null`, comportamento atual inalterado.

---

## Admin UI — `AdminTurmaDetail`

### Tabs de semana (S1–S4)

Cada tab exibe o status de liberação abaixo do label:

| Estado | Visual |
|---|---|
| Liberada, não ativa | `✓ lib` em verde `#4caf50` |
| Liberada, ativa (semana atual) | `✓ lib` em branco sobre fundo `#E8521A` |
| Bloqueada, ativa (semana atual) | `🔒 bloq` em branco semitransparente sobre fundo `#E8521A` |
| Bloqueada, não ativa | `🔒 bloq` acinzentado, tab com `opacity: 0.5` |

### Banner contextual

Aparece **somente** quando a semana ativa está bloqueada (`effectiveWeek > plan.released_through_week`). Posicionado entre os tabs e a grade de treinos:

```
┌──────────────────────────────────────────────────────────┐
│ Semana 3 bloqueada                                        │
│ Alunos não veem os treinos desta semana    [Liberar S3] [Liberar tudo] │
└──────────────────────────────────────────────────────────┘
```

- "Liberar S{n}" chama `releaseThrough(effectiveWeek)` → refresca o hook
- "Liberar tudo" chama `releaseThrough(4)` → refresca o hook
- Após liberar: banner some, tab atualiza para `✓ lib`, toast Sonner verde "Semana N liberada para os alunos"
- Quando `plan` é null (plano não existe ainda), banner não aparece — não há o que liberar

---

## Aluno UI — `AlunoDashboard`

### Quando `isLocked = false`

Comportamento atual, sem alteração.

### Quando `isLocked = true` e `lastWeekSummary !== null` (S2+)

Substitui a lista de treinos por:

1. **Card "Semana N concluída"** (verde escuro, `#4caf5022`):
   - Título: "Semana {lockedWeekNumber - 1} concluída ✓"
   - Métricas em linha: `{checkinCount} treinos` · `{km} km` · `{pace médio}` (pace some se null)

2. **Card "Semana N a caminho"** (gradiente laranja sutil, `#E8521A18 → #E8521A08`):
   - Ícone ⏳ com animação de pulso (framer-motion)
   - Título: "Semana {lockedWeekNumber} a caminho"
   - Subtítulo: "Seu professor está preparando os treinos. Em breve! 💪"

3. **Barra de progresso do ciclo** (S1–S4):
   - Verde `#4caf50` = semanas com número < `lockedWeekNumber` (liberadas e já passadas)
   - Laranja pulsando `#E8521A55` = semana com número = `lockedWeekNumber` (atual, bloqueada)
   - Cinza `#2a2a2a` = semanas com número > `lockedWeekNumber` (futuras, bloqueadas)

### Quando `isLocked = true` e `lastWeekSummary === null` (S1 bloqueada)

1. **Card boas-vindas** (fundo `#1a1a1a`):
   - Ícone 🏃, título "Pronto para correr?"
   - Texto: "Você está no {group.name}. Seu professor está preparando o plano da primeira semana."

2. **Card "Semana 1 a caminho"** (mesmo estilo laranja)

3. **Barra de progresso** — S1 em laranja pulsando, S2–S4 em cinza

---

## Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| Supabase Dashboard SQL | ADD COLUMN + backfill |
| `src/lib/database.types.ts` | Regenerar após migration |
| `src/lib/types.ts` | Nenhuma — `GroupPlan` atualizado automaticamente via database.types |
| `src/hooks/useGroupPlanMutations.ts` | Adicionar `releaseThrough()` |
| `src/hooks/useAdminTurmaDetail.ts` | Expor `plan.released_through_week` (já exposto via `plan`) |
| `src/hooks/useWeeklyPlan.ts` | Adicionar checagem de lock + `lastWeekSummary` |
| `src/pages/admin/AdminTurmaDetail.tsx` | Lock icons nos tabs + banner contextual + ações de liberação |
| `src/pages/aluno/AlunoDashboard.tsx` | Renderizar locked screen (Opção C) quando `isLocked = true` |
| `CLAUDE.md` / `GEMINI.md` | Documentar `released_through_week` em `group_plans` |

---

## Critérios de conclusão

- [ ] `npm run lint` → 0 erros
- [ ] `npx tsc --noEmit` → 0 erros
- [ ] `npm run build` → sucesso
- [ ] Admin consegue liberar S1, depois S2, e ver os tabs atualizarem
- [ ] Admin consegue usar "Liberar tudo" e ver todas as semanas com `✓ lib`
- [ ] Aluno sem semana liberada vê o card "a caminho" correto (S1 vs S2+)
- [ ] Aluno com semana liberada continua vendo treinos normalmente
- [ ] Planos existentes continuam funcionando (backfill = 4)
