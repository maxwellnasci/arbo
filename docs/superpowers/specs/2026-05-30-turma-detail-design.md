# Spec — /admin/turmas/:id (Plano Mensal da Turma)

> Gerado em 2026-05-30

---

## Objetivo

Permitir que o professor monte o plano mensal (ciclo de 4 semanas) de uma turma diretamente no app, com navegação entre semanas, toggle de visualização e painel lateral para buscar ou criar treinos.

---

## Decisões de design

| Decisão | Escolha | Motivo |
|---|---|---|
| Schema | Novas tabelas `group_plans` + `group_plan_trainings` | Planos de grupo e individuais têm ciclos e lógica diferentes |
| Vista padrão | Semana (navegação ‹ ›) | Foco no imediato; cards maiores e legíveis |
| Interação p/ adicionar treino | Painel lateral (direita) | Grid permanece visível; melhor para desktop/tablet |
| Cálculo do ciclo | Derivado de `groups.starts_at` automaticamente | Sem configuração extra; `starts_at` já existe no banco |
| Integração com aluno | Fallback no `useWeeklyPlan` | Plano individual tem precedência; grupo é o default |

---

## Schema

### Novas tabelas

```sql
-- Um plano por turma por ciclo de 4 semanas
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

-- Treinos por dia/semana dentro do ciclo
CREATE TABLE group_plan_trainings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_plan_id   uuid NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
  week_number     smallint NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 6), -- 1=Seg, 6=Sáb
  training_id     uuid NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  sort_order      smallint NOT NULL DEFAULT 0
);
```

### RLS

**`group_plans`:**
- Admin: SELECT, INSERT, UPDATE, DELETE (sem restrição)
- Aluno: SELECT WHERE `group_id = (SELECT group_id FROM profiles WHERE id = auth.uid())`

**`group_plan_trainings`:**
- Admin: SELECT, INSERT, UPDATE, DELETE
- Aluno: SELECT via JOIN com `group_plans` (mesma lógica de group_id)

### GRANTs

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON group_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON group_plan_trainings TO authenticated;
```

### Triggers

- `update_group_plans_updated_at` — BEFORE UPDATE em `group_plans`

---

## Arquitetura de componentes

### Novos arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/pages/admin/AdminTurmaDetail.tsx` | Página principal — layout, toggle mês/semana, navegação entre semanas, orquestra painel lateral |
| `src/hooks/useAdminTurmaDetail.ts` | Busca grupo + group_plan do ciclo atual + group_plan_trainings com training details |
| `src/hooks/useGroupPlanMutations.ts` | add training ao dia, remove training, create training inline |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Adicionar rota `{ path: 'turmas/:id', element: <AdminTurmaDetail /> }` dentro do AdminLayout |
| `src/pages/admin/AdminTurmas.tsx` | `TurmaRow` vira link clicável (`useNavigate` ou `<Link>`) para `/admin/turmas/:id` |
| `src/hooks/useWeeklyPlan.ts` | Fallback para plano de grupo quando aluno não tem plano individual |
| `src/lib/types.ts` | Adicionar tipos `GroupPlan` e `GroupPlanTraining` |

---

## Lógica de ciclo

Calculada no client a partir de `groups.starts_at`:

```ts
function getCurrentCycle(startsAt: string): { cycleStart: Date; weekNumber: number } {
  const origin = new Date(startsAt)
  const today = new Date()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksElapsed = Math.floor((today.getTime() - origin.getTime()) / msPerWeek)
  const cycleIndex = Math.floor(weeksElapsed / 4)   // qual bloco de 4 semanas estamos
  const cycleStart = new Date(origin.getTime() + cycleIndex * 4 * msPerWeek)
  const weekNumber = (weeksElapsed % 4) + 1          // 1..4
  return { cycleStart, weekNumber }
}
```

- `cycleStart` é o início do **bloco de 4 semanas atual** — usado para buscar/criar o `group_plan` (campo `starts_at`) e como referência das datas no header. Formatado como `YYYY-MM-DD` ao gravar no banco.
- `weekNumber` (1–4) é a semana dentro do ciclo onde o professor aterra ao abrir a tela.

---

## Hook: `useAdminTurmaDetail`

```ts
// Retorno
{
  group: Group | null
  plan: GroupPlan | null          // null se ainda não foi criado
  trainings: GroupDayTraining[]   // todos os group_plan_trainings do ciclo
  cycleStart: Date
  isLoading: boolean
  error: string | null
}

type GroupDayTraining = {
  id: string                  // group_plan_trainings.id
  weekNumber: number          // 1–4
  dayOfWeek: number           // 1–6
  training: Training
}
```

**Queries:**
1. `groups` WHERE `id = groupId` — dados da turma
2. `group_plans` WHERE `group_id = groupId AND starts_at = cycleStart` — plano do ciclo atual (`.maybeSingle()`)
3. Se plan existe: `group_plan_trainings` WHERE `group_plan_id = plan.id` + JOIN `trainings(*)`

---

## Hook: `useGroupPlanMutations`

```ts
addTraining(params: {
  groupId: string
  cycleStart: Date
  weekNumber: number
  dayOfWeek: number
  trainingId: string
}): Promise<void>
// Se group_plan não existe ainda, cria via INSERT antes de inserir o training.

removeTraining(groupPlanTrainingId: string): Promise<void>
// DELETE em group_plan_trainings.

createAndAddTraining(params: {
  groupId: string
  cycleStart: Date
  weekNumber: number
  dayOfWeek: number
  training: { title: string; type: TrainingType; distance_m?: number; target_pace_seconds_per_km?: number; sets?: number; description?: string }
}): Promise<void>
// INSERT em trainings (created_by = admin.id) → INSERT em group_plan_trainings.
```

---

## UI — Comportamento detalhado

### Vista Semana (padrão)

- Header: botão "← Turmas" + nome da turma + badges (goal, frequência, plano, status)
- Toggle "Mês / Semana" no canto direito do header; "Semana" ativo por padrão
- Navegação: `‹ Semana X de 4 (DD mmm – DD mmm) ›` com 4 dots abaixo
  - Dot laranja sólido = semana atual no calendário
  - Dot laranja 50% = semanas com ao menos 1 treino
  - Dot cinza = semana vazia
  - Seta ‹ desabilitada na semana 1; seta › desabilitada na semana 4
- Grid: 6 colunas (SEG–SÁB), cada coluna tem:
  - Header com dia abreviado + número do dia
  - Cards de treino existentes (clicáveis → abre painel em modo edição/remoção)
  - Slot "+" vazio (clicável → abre painel em modo busca)
- Ao abrir a página: posiciona na `weekNumber` do ciclo atual

### Vista Mês

- 4 blocos de semana empilhados verticalmente
- Cada bloco: label "Semana X · DD–DD mmm" + grid de 6 células compactas
- Célula com treino: mostra título truncado em laranja
- Célula vazia: mostra "+" em cinza escuro
- Clicar numa célula: muda toggle para "Semana", navega para a semana correspondente, abre painel lateral para aquele dia

### Painel lateral (direita)

**Estado: busca (padrão ao abrir)**
- Header: "× fechar" + "Dia, DD mmm"
- Search bar: filtra em tempo real nos `trainings` existentes (título)
- Seção "Usados neste ciclo": treinos já em `group_plan_trainings` do ciclo atual — prioridade visual
- Seção "Outros treinos": demais treinos da tabela `trainings`
- Clicar num treino da lista → chama `addTraining` + fecha painel
- Botão "Criar novo treino" → muda painel para estado de criação

**Estado: criação**
- Link "← Voltar à busca"
- Campos: Título* (text), Tipo* (select: corrida | hiit | recovery | forca | mobilidade), Distância km (number, opcional), Pace alvo (text "mm:ss/km", opcional — converter para segundos), Séries (number, opcional), Descrição (textarea, opcional)
- Botão "Salvar e adicionar ao dia" → chama `createAndAddTraining` + fecha painel

**Estado: edição (clicar em card existente)**
- Mostra título + tipo + meta do treino
- Botão "Remover deste dia" (vermelho) → chama `removeTraining`
- Botão "Fechar"

---

## Fallback no `useWeeklyPlan` (integração com o aluno)

Após buscar o plano individual do aluno sem resultado (`plan === null`):

```
if (plan === null && profile.group_id) {
  1. Busca group_plan WHERE group_id = profile.group_id
       AND starts_at <= thisMonday
       AND thisMonday < starts_at + 28 dias
  2. Computa weekNumber = floor((thisMonday - starts_at) / 7) + 1
  3. Busca group_plan_trainings WHERE group_plan_id = plan.id AND week_number = weekNumber
  4. Retorna como DayTraining[] (mesmo formato atual)
}
```

- Plano individual sempre tem precedência
- Se grupo não tem plano ainda: aluno vê semana vazia (comportamento atual)
- Sem mudança na interface do aluno — `DayTraining[]` é o mesmo tipo

---

## Fora de escopo nesta iteração

- Controle de liberação de semanas (item 5 do roadmap)
- Etiquetas personalizadas nos treinos (item 4 do roadmap)
- Múltiplos treinos no mesmo dia (sort_order existe no schema, mas a UI não suporta ainda)
- Validação de que o número de treinos respeita a `frequency` da turma (2x ou 3x/sem)
