# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

**Arbo** — app de corrida para alunos e professores de CrossFit. Integra desempenho de corrida com rotina de treino, com acompanhamento de progresso, treinos estruturados e comunidade.

## Comandos

```bash
npm run dev       # servidor de desenvolvimento (Vite HMR)
npm run build     # tsc -b && vite build
npm run preview   # preview do build local
npm run lint      # ESLint (JS/JSX e TS/TSX)
```

Não há test runner configurado ainda.

## Comandos importantes

### Sempre que alterar o banco de dados

1. Fazer a alteração no [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard/project/jhfkflnixzivuichmkie/sql/new)
2. Sincronizar os tipos TypeScript:
```bash
npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts
```
3. Confirmar zero erros:
```bash
npx tsc --noEmit
```

Se der erro de login no CLI:
```bash
npx supabase login
```

**Project ID:** `jhfkflnixzivuichmkie`

## Stack

- **Frontend:** React 19 + Vite + TypeScript
- **Backend:** Supabase — PostgreSQL, Auth, Storage, Edge Functions
- **Automações:** n8n (integração Strava, webhooks, notificações)
- **Deploy:** Vercel (PWA, possível migração futura para React Native/Expo)

## Arquitetura

```
src/
  components/   # componentes reutilizáveis
  pages/        # páginas por rota
  lib/          # supabaseClient, tipos, helpers
  hooks/        # custom hooks (useAuth, useProfile, etc.)
  styles/       # CSS global e variáveis de tema
```

### Camada de dados (`src/lib/`)

| Arquivo | Propósito |
|---|---|
| `supabase.ts` | Cliente Supabase tipado com `Database` |
| `database.types.ts` | Tipos gerados pelo Supabase (não editar manualmente) |
| `types.ts` | Atalhos de tipo para uso no app |

Para regenerar `database.types.ts` após mudanças no schema:
```bash
npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts
```

### Tipos disponíveis em `src/lib/types.ts`

`Profile`, `Training`, `WeeklyPlan`, `WeeklyPlanTraining`, `Checkin`, `PersonalRecord` (não `Record` — palavra reservada TS), `Comment`, `Reaction`, `StravaActivity`, `Anamnesis`, `Group`, `GroupPlan`, `GroupPlanTraining`, `TrainingType`, `DistanceCategory`, `UserLevel`.

### Banco de dados (Supabase — project: `jhfkflnixzivuichmkie`)

**Tabelas:** `profiles`, `anamnesis`, `trainings`, `weekly_plans`, `weekly_plan_trainings`, `checkins`, `records`, `comments`, `reactions`, `strava_connections`, `strava_activities`, `groups`, `group_plans`, `group_plan_trainings`

**Enums:** `training_type` · `distance_category` · `user_level`

**Convenções de schema:**
- Distâncias em metros (`integer`), tempos/paces em segundos (`integer`)
- `updated_at` atualizado por trigger automático
- Trigger `on_auth_user_created` cria `profiles` ao registrar usuário
- Trigger `on_auth_user_role_set` copia `role` de `user_metadata` → `app_metadata` no INSERT (segurança)

### Perfis de usuário e RLS

Dois roles: **Aluno** e **Professor/Admin**. Role armazenada em `app_metadata.role = 'admin'` (nunca em `user_metadata` — editável pelo usuário).

Função helper: `private.is_admin()` — usada em todas as policies de admin.

`strava_connections` tem RLS ativo sem policies → bloqueada para clientes. Acesso exclusivo por Edge Functions com `service_role`.

### GRANTs (role `authenticated`)

GRANTs configurados por tabela — apenas os necessários conforme policies RLS:

| Tabela | GRANTs |
|---|---|
| `profiles` | SELECT, UPDATE |
| `anamnesis` | SELECT, INSERT, UPDATE |
| `trainings` | SELECT, INSERT, UPDATE, DELETE |
| `weekly_plans` | SELECT, INSERT, UPDATE, DELETE |
| `weekly_plan_trainings` | SELECT, INSERT, UPDATE, DELETE |
| `checkins` | SELECT, INSERT, UPDATE |
| `records` | SELECT, INSERT, UPDATE |
| `comments` | SELECT, INSERT, UPDATE, DELETE |
| `reactions` | SELECT, INSERT, DELETE |
| `strava_activities` | SELECT |
| `strava_connections` | **nenhum** — service_role only |
| `groups` | SELECT, INSERT, UPDATE, DELETE |
| `group_plans` | SELECT, INSERT, UPDATE, DELETE |
| `group_plan_trainings` | SELECT, INSERT, UPDATE, DELETE |
| `tags` | SELECT, INSERT, UPDATE, DELETE |

> Ao criar nova tabela: habilitar RLS + executar `GRANT` explícito para `authenticated`. Sem GRANT o cliente recebe erro 42501 mesmo com policy correta.

### Identidade visual

Dark mode exclusivo. Variáveis de tema:
- Primária (laranja): `#E8521A`
- Fundo: `#111111`

## Padrões Supabase

### JOINs e tipos de retorno

**JOIN many-to-one (N → 1):** Supabase retorna **objeto**, não array.

```ts
// weekly_plan_trainings → trainings (N:1)
// retorna: { trainings: Training }  — NÃO Training[]

const training = wpt.trainings      // ✅ correto
const training = wpt.trainings[0]   // ❌ retorna undefined
```

Nunca usar `[0]` para acessar joins N→1. Declarar o tipo como `Training`, não `Training[]`.

**JOIN one-to-many (1 → N):** Supabase retorna array normalmente.

### FK ambíguo (múltiplos relacionamentos para a mesma tabela)

Quando uma tabela tem mais de um FK para a mesma tabela referenciada, o Supabase não sabe qual usar e retorna erro de tipo. Solução: nomear o FK explicitamente no select.

```ts
// checkins tem dois FKs para profiles: student_id e approved_by
// profiles(*) → erro: "more than one relationship was found"

.select('*, profiles!checkins_student_id_fkey(*)')  // ✅ correto
.select('*, profiles(*)')                            // ❌ ambíguo
```

O nome do FK segue o padrão `tabela_coluna_fkey`, confirmável em `database.types.ts` na seção `Relationships`.

## Padrões React / Hooks

### useEffect com fetch assíncrono

Sempre usar `async function load()` interna com flag `cancelled`. `setState` direto no corpo do `useEffect` é erro de lint (`react-hooks/set-state-in-effect`):

```ts
useEffect(() => {
  let cancelled = false
  async function load() {
    setIsLoading(true) // ✅ dentro da função, não no corpo do effect
    // ...
    if (cancelled) return
    setState(data)
  }
  load()
  return () => { cancelled = true }
}, [dep])
```

**TypeScript não estreita variáveis do escopo externo dentro de funções async aninhadas.** O guard `if (!id) return` deve ficar dentro de `load()`, não no `useEffect`.

### Tratamento de erros

`catch (e: any)` é proibido (`no-explicit-any`). Usar:

```ts
catch (e: unknown) {
  setError(e instanceof Error ? e.message : 'Erro desconhecido')
}
```

## Convenções

- Responder e documentar em **português brasileiro**
- Preferir **componentes funcionais e hooks**
- Sempre habilitar **RLS** em novas tabelas do Supabase
- Usar **Edge Functions** para lógica de backend sensível
- Não usar `user_metadata` para autorização — apenas `app_metadata`
- `PersonalRecord` como alias de tipo (não `Record`)
- `profiles` **tem coluna `role text`** (`'aluno'` | `'admin'`). Filtrar alunos com `.eq('role', 'aluno')`. O workaround `.neq('id', adminId)` foi removido em 2026-05-30.
- `profiles` **tem coluna `group_id uuid`** — FK para `groups.id`, nullable (`ON DELETE SET NULL`). Alunos sem turma têm `NULL`.
- Trigger `tr_set_profile_role` (BEFORE INSERT em `profiles`) — popula `role` de `raw_user_meta_data` ao criar perfil via convite.
- **Plano mensal:** professor define os dias da semana para cada turma. Aluno pode ajustar individualmente se necessário (plano individual tem precedência sobre o plano da turma).
- **Plano de grupo:** `group_plans` (id, group_id, starts_at, notes, created_by, **released_through_week smallint DEFAULT 0** — 0=bloqueado, 1–4=semanas liberadas até N, unidirecional) + `group_plan_trainings` (id, group_plan_id, week_number 1–4, day_of_week 1–6, training_id, sort_order). Ciclo de 4 semanas calculado a partir de `groups.starts_at`. Admin: acesso total. Aluno: SELECT onde `group_id = profile.group_id`.
- **`supabase gen types`** pode incluir aviso de versão no final do arquivo gerado — remover manualmente as linhas de texto após o `} as const` antes de commitar.

## Autenticação (implementada)

- `src/contexts/AuthContext.tsx` — sessão reativa via `onAuthStateChange`. Role extraída de `app_metadata.role` (nunca `user_metadata`).
- `useAuth()` expõe: `{ session, user, role, isAdmin, isLoading }`

### Rotas disponíveis

| Rota | Componente | Acesso |
|---|---|---|
| `/login` | `Login.tsx` | público |
| `/set-password` | `SetPassword.tsx` | público (link de convite/recuperação) |
| `/dashboard` | `DashboardRedirect.tsx` | autenticado — redireciona por role/anamnese |
| `/admin` | `AdminLayout` → `AdminHome` (index) | somente `role=admin` |
| `/admin/alunos` | `AdminAlunos` | somente `role=admin` |
| `/admin/feedbacks` | `AdminFeedbacks` | somente `role=admin` |
| `/admin/convites` | `AdminConvites` | somente `role=admin` |
| `/admin/turmas` | `AdminTurmas` | somente `role=admin` |
| `/admin/turmas/:id` | `AdminTurmaDetail` | somente `role=admin` |
| `/admin/alunos/:id` | `AdminAlunoDetail` | somente `role=admin` |
| `/aluno` | `AlunoDashboard.tsx` | somente `role=aluno` |
| `/onboarding` | `AnamnesisForm.tsx` | aluno sem anamnese |

### Sistema de convite

Edge Function: `supabase/functions/invite-user/index.ts`  
- Valida JWT do admin, chama `inviteUserByEmail` com `service_role`  
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` ao frontend  
- Deploy: `npx supabase functions deploy invite-user --project-ref jhfkflnixzivuichmkie`

**Segurança de role no convite:** a Edge Function pode passar `role` em `user_metadata` — o trigger `on_auth_user_role_set` garante que esse valor seja promovido automaticamente para `app_metadata` (somente servidor), tornando-o imutável pelo cliente.

### Aviso SMTP

O Supabase gratuito tem limite de ~3-4 emails/hora para convites e recuperação de senha.  
Antes de produção, configure SMTP externo (Resend ou AWS SES) em:  
**Supabase Dashboard → Authentication → Settings → SMTP Settings**

## Estado atual (2026-05-31)

### Progresso geral
- **Task 1–3:** Schema, RLS, Auth stack ✅
- **Task 4:** TypeScript + Lint — zero erros ✅
- **Task 5:** AlunoDashboard com dados reais + redesign premium ✅
- **Task 6:** Painel Admin — Fase 1 completa ✅
- **Task 7:** Painel Admin — Fase 2 schema + `/admin/turmas` ✅
- **Task 8:** `/admin/turmas/:id` — rota, wiring, fallback aluno, build ✅
- **Task 9:** `/admin/alunos/:id` — perfil do aluno, hook, CSS, lint zero ✅

**Lint:** `npm run lint` → 0 erros, 0 warnings ✅ (2026-05-31)

### O que foi feito em 2026-05-21
- `useWeeklyPlan.ts` — join N→1 retorna objeto, não array: `wpt.trainings[0]` → `wpt.trainings`
- `AlunoDashboard` redesign premium v2 (Bebas Neue, glow animado, bottom sheet, skeleton, PR tracking)
- `checkins.perceived_effort smallint` adicionado ao banco
- Padrão de JOINs documentado em CLAUDE.md e GEMINI.md

### O que foi feito em 2026-05-27
- Spec do painel admin salva em `docs/superpowers/specs/2026-05-27-admin-panel-design.md`
- Painel Admin Fase 1 implementada (AdminLayout, AdminHome, AdminAlunos, AdminFeedbacks, AdminConvites)
- FK ambíguo documentado: `profiles!checkins_student_id_fkey(*)`

### O que foi feito em 2026-05-30

**Schema — Fase 2 aplicado:**
- `profiles.role text CHECK ('aluno'|'admin')` — backfill de usuários existentes + trigger `tr_set_profile_role`
- `profiles.group_id uuid REFERENCES groups(id) ON DELETE SET NULL`
- Tabela `groups` criada com RLS, policies (admin: tudo; aluno: SELECT de ativas), GRANT e trigger `updated_at`

**Frontend — `/admin/turmas` lista:**
- `src/hooks/useAdminTurmas.ts` — hook com `GroupWithCount`, duas queries paralelas, contagem de alunos por turma
- `src/pages/admin/AdminTurmas.tsx` — lista de turmas com `TurmaRow`, labels, acessibilidade
- `src/App.tsx` — rota `/admin/turmas` registrada
- `src/pages/admin/AdminSidebar.tsx` — "Turmas" ativado (era "em breve")
- `src/pages/admin/AdminHome.tsx` — card "Turmas ativas" com dado real; contagem de alunos corrigida para `.eq('role', 'aluno')`
- `src/hooks/useAdminAlunos.ts` — workaround `.neq('id', adminId)` substituído por `.eq('role', 'aluno')`
- `src/lib/types.ts` — tipo `Group` adicionado

**Frontend — `/admin/turmas/:id` (concluído 2026-05-30):**
- Schema: tabelas `group_plans` + `group_plan_trainings` criadas com RLS, policies, GRANTs, trigger `updated_at`
- `src/lib/types.ts` — tipos `GroupPlan` e `GroupPlanTraining` adicionados
- `src/hooks/useAdminTurmaDetail.ts` — fetch do grupo + plano do ciclo atual + trainings; cálculo de ciclo de 4 semanas a partir de `groups.starts_at`
- `src/hooks/useGroupPlanMutations.ts` — `addTraining`, `removeTraining`, `createAndAddTraining`; `ensureGroupPlan` cria o plano lazily
- `src/pages/admin/AdminTurmaDetail.tsx` — página completa: WeekView (navegação ‹›, 6 colunas SEG-SÁB, dots), MonthView (4 semanas compactas), SidePanel (modos: busca, criação, visualização/remoção), CreateTrainingForm
- `src/App.tsx` — rota `turmas/:id` registrada + import de `AdminTurmaDetail`
- `src/pages/admin/AdminTurmas.tsx` — `TurmaRow` clicável com `useNavigate` + seta `›`
- `src/hooks/useWeeklyPlan.ts` — fallback: aluno sem plano individual usa plano do grupo (`group_plans` + `group_plan_trainings`)
- Spec: `docs/superpowers/specs/2026-05-30-turma-detail-design.md`
- Plano de impl: `docs/superpowers/plans/2026-05-30-turma-detail.md`

**Repositório:** https://github.com/maxwellnasci/arbo  
**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` ✅

### O que foi feito em 2026-05-31

**Frontend — `/admin/alunos/:id` (implementado pelo AntiGravity, revisado pelo Claude Code):**
- `src/hooks/useAdminAlunoDetail.ts` — fetch paralelo de profile, grupos, check-ins, PRs e anamnese; mutation `changeGroup`
- `src/pages/admin/AdminAlunoDetail.tsx` — 3 tabs (check-ins, recordes, anamnese), métricas, dropdown de turma, framer-motion
- `src/pages/admin/AdminAlunoDetail.module.css` — CSS Modules, dark mode

**Fase 2 - Sistema de Etiquetas Personalizadas:**
- Schema: Tabela `tags` (RLS, policies) e coluna `tag_id` em `trainings`.
- Hooks: `useAdminTurmaDetail` com join para `tags`, `useGroupPlanMutations` com suporte a `tag_id`.
- UI: Pill de etiqueta colorida nos cards de treino (Admin e Aluno) e form de criação inline com color picker (8 cores).

**Correções de lint (Claude Code — revisão):**
- `useAdminAlunoDetail`: `fetchData` inline como `async function load()` com flag `cancelled`; `catch (e: any)` → `catch (e: unknown)`
- `useAdminTurmaDetail`: `setIsLoading`/`setError` movidos para dentro de `load()`
- `AdminTurmaDetail`: removido `useEffect` de sync de `selectedWeek`; substituído por `effectiveWeek = selectedWeek > 0 ? selectedWeek : defaultWeekNumber`

**Lint:** `npm run lint` → 0 erros, 0 warnings ✅

### Próximo passo
Painel Admin Fase 3: `/admin/treinos` (biblioteca de treinos CRUD) ou Chat admin ↔ aluno.

## Roadmap de telas

### Implementadas
| Tela | Rota | Status |
|---|---|---|
| Login | `/login` | ✅ |
| Set Password (convite) | `/set-password` | ✅ |
| Anamnese | `/onboarding` | ✅ |
| Dashboard do Aluno — Início | `/aluno` | ✅ |
| Painel Admin — Início | `/admin` | ✅ |
| Painel Admin — Alunos | `/admin/alunos` | ✅ |
| Painel Admin — Feedbacks | `/admin/feedbacks` | ✅ |
| Painel Admin — Convites | `/admin/convites` | ✅ |
| Painel Admin — Turmas (lista) | `/admin/turmas` | ✅ |
| Painel Admin — Turmas (detalhe) | `/admin/turmas/:id` | ✅ |
| Painel Admin — Perfil Aluno | `/admin/alunos/:id` | ✅ |

### Pendentes

**Painel Admin — Fase 2**
- ~~Sistema de etiquetas personalizadas~~ ✅
- ~~Controle de liberação do plano~~ ✅
- Chat admin ↔ aluno
- Notificações de PR no painel
- Schema pendente: tabela `invites`

**Painel Admin — Fase 3**
- `/admin/treinos` — biblioteca de treinos (CRUD)
- Modal de mensagem direta ao aluno
- Schema: tabela `messages`

**Bottom Nav — Progresso (`/aluno/progresso`)**
- Histórico de check-ins por semana
- Recordes pessoais (5km, 10km, 21km, 42km)
- Gráfico de evolução de pace ao longo do tempo
- Streak de consistência semanal

**Bottom Nav — Perfil (`/aluno/perfil`)**
- Dados do aluno (nome, nível, foto)
- Botão conectar/desconectar Strava
- Logout

### Ordem de desenvolvimento
1. ~~Testar visualmente Fase 1 do admin~~ ✅
2. ~~Schema Fase 2 (role + group_id + tabela groups)~~ ✅
3. ~~`/admin/turmas` lista~~ ✅
4. ~~`/admin/turmas/:id` — grid plano mensal~~ ✅
5. ~~`/admin/alunos/:id` — perfil do aluno~~ ✅
6. Painel Admin Fase 3 (treinos + mensagem)
7. Aba Progresso
8. Aba Perfil
