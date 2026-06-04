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
- **Gráficos:** recharts `^2.x` — **não usar 3.x**: incompatível com Vite (erro `require_isUnsafeProperty` causado por `victory-vendor` CJS)

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

**Tabelas:** `profiles`, `anamnesis`, `trainings`, `weekly_plans`, `weekly_plan_trainings`, `checkins`, `records`, `comments`, `reactions`, `strava_connections`, `strava_activities`, `groups`, `group_plans`, `group_plan_trainings`, `messages`

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
| `messages` | SELECT, INSERT, UPDATE |

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

## Estado atual (2026-06-04)

### Progresso geral
- **Task 1–3:** Schema, RLS, Auth stack ✅
- **Task 4:** TypeScript + Lint — zero erros ✅
- **Task 5:** AlunoDashboard com dados reais + redesign premium ✅
- **Task 6:** Painel Admin — Fase 1 completa ✅
- **Task 7:** Painel Admin — Fase 2 schema + `/admin/turmas` ✅
- **Task 8:** `/admin/turmas/:id` — rota, wiring, fallback aluno, build ✅
- **Task 9:** `/admin/alunos/:id` — perfil do aluno, hook, CSS, lint zero ✅
- **Task 10:** Sistema de Etiquetas — tabela `tags`, pills coloridas, color picker inline ✅
- **Task 11:** Controle de Liberação — `released_through_week`, chips admin, `LockedScreen` aluno ✅
- **Task 12:** `/admin/treinos` — biblioteca de treinos implementada via colaboração Gemini + DeepSeek V4 Pro como subagente ✅
- **Task 13:** `/admin/treinos` — visual refinado pelo Claude Code: padrão dark inline styles, pills de tipo coloridas, lint + TS zero erros ✅
- **Task 14:** `/admin/alunos/:id` e `/aluno` — Chat Direto admin ↔ aluno com interface premium (Framer Motion, Glassmorphism, tempo real via Supabase) ✅
- **Task 15:** Fix `<Toaster>` duplicado em `AdminAlunoDetail` ✅
- **Task 16:** `/aluno/progresso` — `AlunoProgresso.tsx`, `useProgresso.ts`, gráfico recharts, recordes pessoais, histórico de check-ins, streak ✅
- **Task 17:** Fix recharts 3.x → downgrade 2.15.4 (erro `require_isUnsafeProperty` com Vite) ✅
- **Task 18:** `/aluno/perfil` — `AlunoPerfil.tsx`, `useAlunoPerfil.ts`, dados pessoais, Strava placeholder, logout (Gemini + revisão Claude Code) ✅
- **Task 19:** Notificações de PR no admin — `AdminPRFeed.tsx`, `useAdminPRs.ts`, feed de recordes recentes clicável no `AdminHome` (Gemini + revisão Claude Code) ✅
- **Task 20:** Code Splitting — `React.lazy()` + `Suspense` em todas as rotas; cada página gera chunk separado; spinner on-brand como fallback (Opus 4.6) ✅
- **Task 21:** Botão Nova Turma — `CreateGroupModal.tsx` funcional em `/admin/turmas`; cria registro na tabela `groups` ✅
- **Task 22:** Error Boundary global — `ErrorBoundary.tsx` com design premium, envolvendo rotas em `App.tsx` ✅
- **Task 23:** Tabela `invites` no Supabase — RLS + policies + GRANT; Edge Function `invite-user` registra convite no banco; `/admin/convites` exibe log ✅
- **Task 24:** Filtros em `/admin/alunos` — busca por nome + filtro por Turma (dinâmico) e Nível via state local ✅
- **Task 25:** Deploy no Vercel — app publicado em **https://arbo-weld.vercel.app** ✅
- **Task 26:** Responsividade Mobile — menu hamburguer no admin, sidebar drawer, tabelas scrolláveis, safe area no aluno (Gemini) ✅
- **Task 27:** PWA completo — `vite-plugin-pwa`, `manifest.webmanifest`, ícones PNG + SVG custom, service worker Workbox, meta tags iOS/Android (Gemini) ✅
- **Task 28:** Correções UX mobile — prevenção de bounce iOS, bloqueio de zoom indesejado, layout `100dvh` com scroll no `#root` (Gemini) ✅
- **Task 29:** Login redesign premium (logo Arbo, glassmorphism, glow laranja, ícones Lucide), novos ícones PWA (`public/icons/`), sidebar hover refinado, header da turma com botão Editar, `EditGroupModal.tsx` (Gemini) ✅
- **Task 30:** Correção de responsividade mobile no header da turma — layout em coluna, `clamp()` no título, `flexWrap` nas pills, botão Editar integrado; reversão do `minHeight: '70vh'` no grid (Gemini) ✅

**Lint:** `npm run lint` → 0 erros, 0 warnings ✅ (2026-06-04)
**Fase 3:** 100% completa ✅

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

**Controle de Liberação do Plano:**
- Schema: `released_through_week smallint DEFAULT 0` em `group_plans`; backfill de planos existentes para 4 (mantém comportamento atual)
- `useGroupPlanMutations`: `releaseThrough(weekNumber)` — atualiza `released_through_week` no banco
- `useWeeklyPlan`: lock check — verifica se semana está liberada antes de retornar trainings; exporta `isLocked`, `lockedWeekNumber`, `lastWeekSummary`
- `AdminTurmaDetail`: chips S1–S4 com `✓` / `🔒` + banner de liberação com botões "Liberar Sn" e "Liberar tudo"; toasts via sonner
- `App.tsx`: `<Toaster />` do sonner adicionado
- `AlunoDashboard`: `LockedScreen` — boas-vindas (semana 1), resumo da semana anterior + card "a caminho" + barra de ciclo S1–S4 (semanas 2–4)

**Correções de lint (Claude Code — revisão):**
- `useAdminAlunoDetail`: `fetchData` inline como `async function load()` com flag `cancelled`; `catch (e: any)` → `catch (e: unknown)`
- `useAdminTurmaDetail`: `setIsLoading`/`setError` movidos para dentro de `load()`
- `AdminTurmaDetail`: removido `useEffect` de sync de `selectedWeek`; substituído por `effectiveWeek = selectedWeek > 0 ? selectedWeek : defaultWeekNumber`

**Lint:** `npm run lint` → 0 erros, 0 warnings ✅

### O que foi feito em 2026-06-01

**Refinamento visual de `/admin/treinos` (Claude Code):**
- `TreinoCard.tsx` — reescrito com inline styles dark: fundo `#1c1c1e`, pill de tipo colorida por categoria (corrida=#E8521A, hiit=#EF4444, recovery=#22C55E, forca=#3B82F6, mobilidade=#A855F7), pill de etiqueta com cor do banco, stats grid sobre `#111`
- `TreinoFormPanel.tsx` — convertido de Tailwind para inline styles dark; `as any` corrigido → `TrainingType`; `resetForm` movida antes do `useEffect`; setState via `async function load()` (padrão CLAUDE.md)
- `AdminTreinos.tsx` — removidas classes Tailwind; botão `+ Novo Treino` em `#E8521A`; busca dark; grid `auto-fill 260px`
- `AdminSidebar.tsx` — fix TS pré-existente: `disabled?: boolean` adicionado ao tipo dos links

### O que foi feito em 2026-06-01 (Parte 2)

**Implementação do Chat Admin ↔ Aluno (AntiGravity):**
- Schema: Tabela `messages` criada (id, student_id, admin_id, sender_id, content, deleted_by_student, deleted_by_admin, read_at) com RLS ativada e policies restritas por `role`. Realtime ativado.
- Hook `useChat.ts` — fetch, realtime subscription com supabase channel, soft delete. Bypass no eslint para initial fetch.
- UI Admin: `AdminChatPanel.tsx` + `AdminChatPanel.module.css` — Painel lateral framer-motion com glassmorphism, integrado ao perfil do aluno via botão "Mensagem".
- UI Aluno: `AlunoChat.tsx` + `AlunoChat.module.css` — View full page mobile-first, balões coloridos, soft delete. Aba Chat adicionada no `BottomNav` de `AlunoDashboard`.

**Fix (Claude Code — revisão):**
- `AdminAlunoDetail.tsx` — `<Toaster>` duplicado removido; `App.tsx` já possui o global. Eliminava toasts duplicados.

**Repositório:** https://github.com/maxwellnasci/arbo  
**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` → 0 erros ✅ (2026-06-01)

### O que foi feito em 2026-06-02

**Aba Progresso — `/aluno/progresso` (Claude Code):**
- `src/hooks/useProgresso.ts` — queries paralelas: recordes pessoais por categoria (`records`), histórico de check-ins com join `trainings`, cálculo de `paceHistory` (pace médio agrupado por mês), cálculo de `streak` (semanas consecutivas com check-in)
- `src/pages/aluno/AlunoProgresso.tsx` — badge de streak, grid de recordes pessoais (5km, 10km, 21km, 42km), gráfico `LineChart` com `CustomTooltip` formatado em min:seg/km, lista de histórico recente de check-ins
- `src/pages/aluno/AlunoProgresso.module.css` — CSS Modules dark mode
- `src/pages/aluno/AlunoDashboard.tsx` — aba `progresso` integrada ao BottomNav; renderiza `<AlunoProgresso studentId={user.id} />`

**Fix de compatibilidade recharts × Vite:**
- Downgrade `recharts` 3.8.1 → **2.15.4**: versão 3.x usa `victory-vendor` (CJS) que o Vite não consegue pre-bundlar corretamente → `require_isUnsafeProperty`. Versão 2.x é ESM nativa.
- `vite.config.ts` — `optimizeDeps.include: ['recharts']` removido (não efetivo e desnecessário com 2.x)

**Repositório:** https://github.com/maxwellnasci/arbo  
**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` → 0 erros ✅ (2026-06-02)

### O que foi feito em 2026-06-02 (Parte 2)

**Aba Perfil — `/aluno/perfil` (Gemini + revisão Claude Code):**
- `src/hooks/useAlunoPerfil.ts` — queries paralelas: `profiles` com join `groups(name)` + `strava_connections` (placeholder RLS); `async function load()` com `cancelled` flag, `catch (e: unknown)`
- `src/pages/aluno/AlunoPerfil.tsx` — avatar com fallback (inicial do nome), dados pessoais (nível, turma), card Strava placeholder (botão desabilitado se conectado), botão logout (`supabase.auth.signOut()` + redirect)
- `src/pages/aluno/AlunoPerfil.module.css` — CSS Modules dark, avatar com glow laranja, `padding-bottom: 96px` para BottomNav
- `src/pages/aluno/AlunoDashboard.tsx` — aba `perfil` substitui `ProfileMenu` inline antigo; `useLogout` e estado `showProfileMenu` removidos

**Notificações de PR no admin (Gemini + revisão Claude Code):**
- `src/hooks/useAdminPRs.ts` — query paginada em `records` com join `profiles(full_name, avatar_url)`; padrão `async load()` com `cancelled` flag
- `src/pages/admin/AdminPRFeed.tsx` — feed de cards clicáveis dos 5 recordes mais recentes; navega para `/admin/alunos/:id`; formatação de tempo `h:mm:ss` / `m:ss`
- `src/pages/admin/AdminPRFeed.module.css` — CSS Modules dark
- `src/pages/admin/AdminHome.tsx` — substitui lista inline de PRs por `<AdminPRFeed />`; `fetchStats` refatorada com `cancelled` flag e `try/finally`

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ (2026-06-02)

**Code Splitting (Opus 4.6):**
- `src/App.tsx` — todos os imports de páginas convertidos para `React.lazy()`, cada rota envolvida com `Suspense` + `PageLoader` (spinner laranja on-brand)
- Componentes estruturais (`ProtectedRoute`, `AdminRoute`, `AdminLayout`) ficam estáticos (necessários no primeiro render)
- Build gera chunks isolados: AdminHome 4KB, AdminTurmaDetail 24KB, AlunoDashboard 420KB, etc. — aluno nunca baixa código do admin
- tsc + lint + build: 0 erros ✅

### O que foi feito em 2026-06-03

**Deploy no Vercel:**
- App publicado em **https://arbo-weld.vercel.app** (Vercel, SPA routing via `vercel.json`)

**Implementação em Paralelo (Antigravity + Subagentes):**
- **Nova Turma:** `src/components/CreateGroupModal.tsx` — modal com form (nome, objetivo, frequência, tipo de plano, data de início); cria registro na tabela `groups` via insert Supabase; `AdminTurmas.tsx` exibe modal ao clicar em `+ Nova Turma`
- **Error Boundary:** `src/components/ErrorBoundary.tsx` — class component global com fallback elegante (botão "Tentar novamente"); integrado em `App.tsx` envolvendo todas as rotas
- **Tabela `invites`:** criada no Supabase (id, email, role, status, invited_by, created_at); RLS + policies (admin: tudo, aluno: sem acesso); GRANT INSERT/SELECT para `authenticated`; Edge Function `invite-user` atualizada para inserir registro após `inviteUserByEmail`; `AdminConvites.tsx` exibe tabela de log com email, role, status, data
- **Filtros em Alunos:** `AdminAlunos.tsx` — busca por nome (input), filtro por Turma (select dinâmico dos grupos) e Nível (select de `user_level`); filtros via `useMemo` sobre a lista local

**Fix de lint (Claude Code — revisão):**
- `AdminConvites.tsx` — `useEffect` que chamava `fetchInvites()` diretamente refatorado para `async function load()` com flag `cancelled` (padrão CLAUDE.md)

**Types regenerados:**
- `src/lib/database.types.ts` regenerado após criação da tabela `invites` (`npx supabase gen types typescript`)

**Repositório:** https://github.com/maxwellnasci/arbo  
**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` → 0 erros ✅ (2026-06-03)

### O que foi feito em 2026-06-04 (Parte 2)

**PWA Completo (Gemini + fix Claude Code):**
- `vite.config.ts` — `vite-plugin-pwa` adicionado com `registerType: 'autoUpdate'`; manifest inline com `name`, `short_name`, `theme_color: #111111`, `background_color: #111111`, `display: standalone`, `orientation: portrait`, ícones 192×192 e 512×512
- `public/icon.svg` — ícone custom do Arbo: fundo `#111111`, letra "A" estilizada em `#E8521A` (corrida)
- `public/icon-192x192.png` e `public/icon-512x512.png` — ícones PNG derivados do SVG
- `index.html` — `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, `viewport-fit=cover` para safe area iOS
- Build gera `dist/sw.js` + `dist/workbox-*.js` (Workbox precache de 29 entradas, ~1.18MB)
- **Fix (Claude Code):** removidos `public/manifest.json` (redundante — plugin gera `manifest.webmanifest`), `public/icons.svg` (arquivo de template não relacionado ao projeto), `vite.config.js` (cópia compilada redundante do `.ts`)

**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` → 0 erros ✅ (2026-06-04)

### O que foi feito em 2026-06-04 (Parte 3)

**Correções UX Mobile (Gemini):**
- `index.html` — viewport atualizado: `maximum-scale=1.0, user-scalable=no` bloqueia pinch-to-zoom e double-tap zoom indesejados em iPhone/Android
- `src/index.css` — `html, body` recebem `overscroll-behavior: none` (elimina bounce/rubber-band do iOS) e `overflow: hidden` (contém o scroll no `#root`); `#root` muda de `min-height: 100svh` para `height: 100dvh` + `overflow-y: auto` + `-webkit-overflow-scrolling: touch` para scroll nativo suave no iOS

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ (2026-06-04)

### O que foi feito em 2026-06-04

**Responsividade Mobile — Painel Admin e App do Aluno (Gemini):**
- `src/pages/admin/AdminLayout.tsx` — refatorado para CSS Modules; menu hamburguer mobile (ícone `Menu` da lucide-react); overlay escuro ao abrir sidebar; `useState` para controlar `sidebarOpen`
- `src/pages/admin/AdminLayout.module.css` — criado do zero: layout desktop via `flex-row`, breakpoint 768px muda para `flex-column`; `.headerMobile` visível apenas no mobile; sidebar vira drawer com `position:fixed` + `transform: translateX(-100%)` animado; overlay com `opacity` transicionado
- `src/pages/admin/AdminSidebar.tsx` — aceita props `isOpen` e `onClose`; links chamam `onClose` ao navegar; aplica `.sidebarOpen` class quando aberto
- `src/pages/admin/AdminTurmaDetail.tsx` — WeekView envolvida em wrapper `overflowX: 'auto'` com `WebkitOverflowScrolling: 'touch'`; grid `minWidth: '420px'` para scroll horizontal no mobile
- `src/pages/admin/AdminConvites.tsx` — tabela de convites com `overflowX: 'auto'` e `minWidth: '450px'`; form de convite com `flexWrap: 'wrap'` e `flex: '1 1 200px'` nos campos
- `src/pages/admin/AdminAlunoDetail.module.css` — media query 768px: `.header` em coluna centralizada, `.actions` em coluna full-width, `.btn` full-width, `.metrics` em 1 coluna
- `src/components/admin/CreateGroupModal.tsx` — form com `flexWrap: 'wrap'` e `flex: '1 1 200px'` nos grupos de campos
- `src/pages/aluno/AlunoPerfil.module.css` — `padding-bottom: calc(96px + env(safe-area-inset-bottom, 24px))` para iPhone com home indicator
- `src/pages/aluno/AlunoProgresso.module.css` — container do gráfico recharts recebe `width: 100%`, `max-width: 100%`, `overflow: hidden` para não vazar no mobile

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ (2026-06-04)

### O que foi feito em 2026-06-04 (Parte 4)

**Login redesign premium + ícones PWA + EditGroupModal (Gemini):**
- `src/components/Login.tsx` — usa `arbo-logo.png` do assets; ícones `Mail` e `Lock` da lucide nos inputs; card glassmorphism com `backdrop-filter: blur`
- `src/components/Login.css` — reescrito do zero: `radial-gradient` no fundo, glow laranja (`filter: blur(60px)`), inputs com ícone + border focus laranja, botão com gradiente e `transform: translateY(-2px)` no hover, estados disabled/error/info
- `public/icons/icon-192.png` + `public/icons/icon-512.png` — ícones PWA com arbo-logo (nova pasta `public/icons/`)
- `vite.config.ts` — caminhos de ícones atualizados para `icons/icon-192.png` e `icons/icon-512.png`
- `index.html` — `apple-touch-icon` atualizado para `/icons/icon-192.png`
- `src/pages/admin/AdminTurmaDetail.tsx` — header reformulado: flex layout com breadcrumb, nome da turma + pills de metadados (objetivo, frequência, status), botão "Editar" com ícone `Edit2` da lucide; `showEditModal` state + `<EditGroupModal>` integrado
- `src/components/admin/EditGroupModal.tsx` — novo componente: form completo para editar nome, objetivo, frequência, tipo de plano e status da turma; dark inline styles; atualiza `groups` via supabase update; toast de sucesso via `onSuccess()`
- **Fix:** `vite.config.js` (cópia compilada redundante) removido

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ (2026-06-04)

### O que foi feito em 2026-06-04 (Parte 5)

**Ajustes visuais no grid da semana, vista mês e ícones PWA (Gemini):**
- `src/pages/admin/AdminTurmaDetail.tsx` — grid da semana com `minHeight: '70vh'`; colunas e células com `flex: 1` + `flexDirection: column` para a vista mês crescer proporcionalmente; células com `height: '100%'`
- `public/icons/icon-192.png` e `public/icons/icon-512.png` — proporção da árvore/logo nos ícones PWA melhorada

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros, 0 warnings ✅ (2026-06-04)

### O que foi feito em 2026-06-04 (Parte 6)

**Correção do header mobile e reversão da altura do grid (Gemini):**
- `src/pages/admin/AdminTurmaDetail.tsx`:
  - Header reestruturado em `flexDirection: 'column'` para separar a linha de navegação/toggle do bloco de informações da turma
  - Título da turma usa `fontSize: 'clamp(18px, 5vw, 24px)'` para adaptar ao tamanho de tela
  - Pills de metadados (objetivo, frequência, status) com `flexWrap: 'wrap'` — quebram linha no mobile
  - Botão "Editar" integrado à linha de pills (estilo pill, `marginLeft: 'auto'`), eliminando o `hide-mobile` anterior
  - `minHeight: '70vh'` removido do container principal do grid — revertido por causar altura excessiva na vista de treinos
  - `display: 'flex', flexDirection: 'column'` removido do flex wrapper da área do grid (simplificação)

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros, 0 warnings ✅ (2026-06-04)

### Próximo passo
- Integração Strava (Edge Function via n8n)
- Domínio customizado (apontar domínio próprio no Vercel)
- SMTP externo (Resend ou AWS SES) antes de produção

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
| Painel Admin — Treinos | `/admin/treinos` | ✅ |
| Chat Admin → Aluno | panel em `/admin/alunos/:id` | ✅ |
| Chat Aluno → Admin | aba em `/aluno` | ✅ |
| Progresso do Aluno | `/aluno/progresso` | ✅ |
| Perfil do Aluno | aba em `/aluno` | ✅ |
| Notificações de PR | widget em `/admin` | ✅ |

### Pendentes

**Painel Admin — Fase 2**
- ~~Sistema de etiquetas personalizadas~~ ✅
- ~~Controle de liberação do plano~~ ✅
- ~~Chat admin ↔ aluno~~ ✅
- ~~Notificações de PR no painel~~ ✅
- ~~Schema: tabela `invites`~~ ✅
- ~~Botão Nova Turma com modal~~ ✅
- ~~Filtros em `/admin/alunos`~~ ✅

~~**Painel Admin — Fase 3**~~ ✅ **100% completa**
- ~~`/admin/treinos` — biblioteca de treinos (CRUD) + visual refinado~~ ✅
- ~~Modal de mensagem direta ao aluno + aba chat aluno~~ ✅
- ~~Schema: tabela `messages`~~ ✅

~~**Bottom Nav — Progresso (`/aluno/progresso`)** — histórico, recordes, gráfico de pace, streak~~ ✅

~~**Bottom Nav — Perfil (`/aluno/perfil`)** — dados pessoais, Strava placeholder, logout~~ ✅

### Próximos passos sugeridos
- ~~Error Boundary global~~ ✅
- ~~Tabela `invites` (schema pendente)~~ ✅
- ~~Ícone do app + PWA completo~~ ✅
- Integração Strava (Edge Function via n8n)
- **Domínio customizado** — apontar domínio próprio ao Vercel (arbo-weld.vercel.app é o atual)

### Ordem de desenvolvimento
1. ~~Testar visualmente Fase 1 do admin~~ ✅
2. ~~Schema Fase 2 (role + group_id + tabela groups)~~ ✅
3. ~~`/admin/turmas` lista~~ ✅
4. ~~`/admin/turmas/:id` — grid plano mensal~~ ✅
5. ~~`/admin/alunos/:id` — perfil do aluno~~ ✅
6. ~~Painel Admin Fase 3 (treinos ✅ + mensagem ✅)~~ ✅
7. ~~Aba Progresso~~ ✅
8. ~~Aba Perfil~~ ✅
9. ~~Notificações de PR no admin~~ ✅
10. ~~Code Splitting (React.lazy + Suspense)~~ ✅
