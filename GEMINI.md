# Arbo — CrossFit Running App

## Visão Geral
Aplicativo de corrida exclusivo para alunos e professores de CrossFit.
O objetivo é integrar o desempenho de corrida com a rotina de treino dos atletas,
oferecendo acompanhamento de progresso, treinos estruturados e comunidade.

## Stack Técnica
- **Frontend Web:** React 19 + Vite + TypeScript
- **Hospedagem:** Vercel
- **Backend / Banco de Dados:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Automações:** n8n (integração com Strava, notificações, webhooks)
- **Mobile:** PWA (Progressive Web App) — possível migração futura para React Native/Expo
- **Integrações externas:** Strava API

## Identidade Visual
- **Tema:** Dark mode exclusivo
- **Cor primária:** Laranja `#E8521A`
- **Cor de fundo:** Preto `#111111`
- **Tipografia:** moderna, esportiva

## Perfis de Usuário
- **Aluno:** acesso ao dashboard pessoal, treinos, check-in, recordes, comunidade
- **Professor / Admin:** gerenciamento de alunos, criação de treinos, painel admin, relatórios

## Funcionalidades

### Autenticação
- Login / cadastro via Supabase Auth
- Anamnese inicial obrigatória para novos alunos (dados físicos, objetivos, limitações)

### Dashboard do Aluno
- Resumo semanal de treinos e check-ins
- Próximo treino do plano
- Últimos recordes pessoais
- Atividade recente no Strava

### Treinos
- Planos semanais criados pelo professor
- Treinos diários com distância, pace alvo, séries e tipo (corrida, HIIT, recovery)
- Check-in de conclusão com dados reais (tempo, distância, observações)

### Calculadoras
- **Pace:** converte velocidade ↔ pace ↔ tempo por distância
- **Frequência Cardíaca:** zonas de FC baseadas em idade e FC máx

### Recordes Pessoais
- Melhores tempos por distância (1km, 5km, 10km, 21km, 42km)
- Histórico de evolução com gráfico

### Comunidade
- Feed de atividades e conquistas dos alunos
- Comentários e reações
- Rankings por distância, pace e check-ins

### Painel Admin (Professor)
- CRUD de alunos e planos de treino
- Relatórios de adesão e progresso

### Integração Strava
- OAuth via n8n
- Importação automática de atividades
- Sincronização de recordes pessoais

## Banco de Dados (Supabase — project: jhfkflnixzivuichmkie)

### Schema criado em 2026-05-18

#### Enums
```sql
training_type:     'corrida' | 'hiit' | 'recovery' | 'forca' | 'mobilidade'
distance_category: '1km' | '5km' | '10km' | '21km' | '42km'
user_level:        'iniciante' | 'intermediario' | 'avancado'
```

#### Tabelas
```
profiles          -- id = auth.users.id; colunas: role text ('aluno'|'admin'), group_id uuid FK groups
anamnesis         -- dados físicos e objetivos do aluno (1:1 com profiles)
trainings         -- templates de treino criados pelo professor
weekly_plans      -- planos semanais por aluno (UNIQUE student_id + week_start)
weekly_plan_trainings -- pivot: treino × plano × dia da semana
checkins          -- registro de conclusão de treinos
records           -- recordes pessoais por distância-categoria
comments          -- comentários em checkins e recordes (target_type + target_id)
reactions         -- reações em checkins e recordes
strava_connections -- tokens OAuth Strava (sem acesso direto — Edge Function only)
strava_activities  -- atividades importadas do Strava
groups            -- turmas: name, goal, frequency, plan_type, starts_at, is_active
group_plans       -- planos de ciclo por turma (group_id, starts_at, notes, created_by, released_through_week smallint DEFAULT 0 — 0=bloqueado, 1–4=semanas liberadas até N)
group_plan_trainings -- pivot: week_number (1–4) × day_of_week (1–6) × training_id
messages          -- chat admin↔aluno: student_id, sender_id, admin_id, content, deleted_by_student, deleted_by_admin, read_at
```

#### Convenções de schema
- Distâncias em metros (`integer`), tempos/paces em segundos (`integer`)
- Trigger `update_updated_at_column()` em: profiles, anamnesis, trainings, strava_connections
- Trigger `on_auth_user_created` → cria perfil automaticamente no cadastro
- Trigger `on_auth_user_role_set` → copia `role` de `user_metadata` → `app_metadata` no INSERT (segurança: impede usuário de injetar próprio role)

### Segurança e RLS
- RLS habilitado em todas as tabelas
- Role admin em `app_metadata.role = 'admin'` (NÃO em `user_metadata`)
- Função `private.is_admin()` — schema privado, SECURITY DEFINER
- Policies usam `(SELECT auth.uid())` e `(SELECT private.is_admin())` para evitar re-avaliação por linha
- `strava_connections`: sem policies → completamente bloqueada para clientes

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
| `messages` | SELECT, INSERT, UPDATE |

> Ao criar nova tabela: habilitar RLS + executar `GRANT` explícito para `authenticated`. Sem GRANT o cliente recebe erro 42501 mesmo com policy RLS correta.

### Tipos TypeScript
- `src/lib/database.types.ts` — gerado pelo Supabase (não editar)
- `src/lib/types.ts` — atalhos: `Profile`, `Training`, `WeeklyPlan`, `WeeklyPlanTraining`, `Checkin`, `PersonalRecord` (não `Record`!), `Comment`, `Reaction`, `StravaActivity`, `Anamnesis`, `Group`, `GroupPlan`, `GroupPlanTraining`
- Regenerar tipos: `npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts`

## Estrutura de Pastas (Frontend)
```
src/
  components/     # componentes reutilizáveis
  pages/          # páginas por rota
  lib/            # supabaseClient, database.types.ts, types.ts
  hooks/          # custom hooks (useAuth, useProfile, etc.)
  styles/         # CSS global e variáveis de tema
```

## Desenvolvedor
- Consultor de automações de IA — primeiro projeto próprio full-stack
- Preferência por soluções práticas, código limpo e documentação em português
- Prioridade: funcionalidade > perfeição técnica, mas sem abrir mão de segurança

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

Quando uma tabela tem mais de um FK para a mesma tabela referenciada, usar o nome do FK no select:

```ts
// checkins tem dois FKs para profiles: student_id e approved_by
.select('*, profiles!checkins_student_id_fkey(*)')  // ✅
.select('*, profiles(*)')                            // ❌ ambíguo — erro de tipo
```

Nome do FK segue padrão `tabela_coluna_fkey`, confirmável na seção `Relationships` de `database.types.ts`.

## Padrões React / Hooks

### useEffect com fetch assíncrono

`setState` direto no corpo do `useEffect` é erro de lint (`react-hooks/set-state-in-effect`). Padrão correto:

```ts
useEffect(() => {
  let cancelled = false
  async function load() {
    if (!id) return          // guard DENTRO de load() — TS não estreita do escopo externo
    setIsLoading(true)       // dentro da função, não no corpo do effect
    try { /* ... */ } catch (e: unknown) {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      if (!cancelled) setIsLoading(false)
    }
  }
  load()
  return () => { cancelled = true }
}, [id])
```

`catch (e: any)` proibido — usar `catch (e: unknown)` com `e instanceof Error`.

## Observações Importantes
- Sempre responder em português brasileiro
- Priorizar Row Level Security (RLS) no Supabase
- Preferir componentes funcionais e hooks no React
- Edge Functions do Supabase para lógica sensível no backend
- Nunca usar `user_metadata` para autorização — somente `app_metadata`
- `PersonalRecord` como alias de tipo em vez de `Record` (palavra reservada TS)
- `profiles.role` existe e é populado por trigger — filtrar alunos com `.eq('role', 'aluno')`
- `profiles.group_id` é FK nullable para `groups.id` — alunos sem turma têm NULL
- **Plano de grupo:** `group_plans` (id, group_id, starts_at, notes, created_by, **released_through_week smallint DEFAULT 0** — 0=bloqueado, 1–4=semanas liberadas até N, unidirecional) + `group_plan_trainings` (id, group_plan_id, week_number 1–4, day_of_week 1–6, training_id). Ciclo de 4 semanas calculado a partir de `groups.starts_at`.
- **Fallback de plano:** `useWeeklyPlan` busca plano individual primeiro; se não existir e `profile.group_id` não for null, usa plano do grupo da semana correspondente; se `weekNumber > released_through_week`, retorna `isLocked: true`
- **`supabase gen types`** pode incluir aviso de versão no final — remover manualmente as linhas após o `} as const`

## Autenticação (implementada em 2026-05-19)

Stack de auth: React Router v6 (`createBrowserRouter`) + Supabase Auth + `AuthContext`.

### Rotas

| Rota | Acesso |
|---|---|
| `/login` | público |
| `/set-password` | público (convite / recuperação) |
| `/dashboard` | autenticado — redireciona por role + anamnese |
| `/admin` | `role=admin` → AdminHome (index) |
| `/admin/alunos` | `role=admin` |
| `/admin/feedbacks` | `role=admin` |
| `/admin/convites` | `role=admin` |
| `/admin/turmas` | `role=admin` |
| `/admin/turmas/:id` | `role=admin` |
| `/aluno` | `role=aluno` com anamnese |
| `/onboarding` | `role=aluno` sem anamnese |

### Convite de alunos

Edge Function `invite-user` (Deno) — usa `service_role` para chamar `inviteUserByEmail`.  
Frontend chama via `useInvite` hook com Bearer token do admin.  
Deploy: `npx supabase functions deploy invite-user --project-ref jhfkflnixzivuichmkie`

**Segurança de role:** o trigger `on_auth_user_role_set` promove automaticamente `role` de `user_metadata` → `app_metadata` no INSERT, impedindo que o usuário injete seu próprio role.

### Aviso SMTP

Supabase gratuito: limite ~3-4 emails/hora. Configurar SMTP externo (Resend/SES) antes de produção:  
Dashboard → Authentication → Settings → SMTP Settings

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

## Estado Atual (2026-06-04)

### Progresso geral
- Tasks 1–3: Schema, RLS, Auth stack ✅
- Task 4: TypeScript + Lint — zero erros ✅
- Task 5: AlunoDashboard com dados reais + redesign premium ✅
- Task 6: Painel Admin — Fase 1 completa ✅
- Task 7: Painel Admin — Fase 2 schema + `/admin/turmas` ✅
- Task 8: `/admin/turmas/:id` — rota, wiring, fallback aluno, build ✅
- Task 9: `/admin/alunos/:id` — perfil do aluno, hook, CSS, lint zero ✅
- Task 10: Sistema de Etiquetas — tabela `tags`, pills coloridas, color picker inline ✅
- Task 11: Controle de Liberação — `released_through_week`, chips admin, `LockedScreen` aluno ✅
- Task 12: `/admin/treinos` — biblioteca de treinos CRUD implementada ✅
- Task 13: `/admin/treinos` — visual refinado: dark inline styles, pills de tipo coloridas ✅
- Task 14: Chat Admin ↔ Aluno implementado com UI Premium, framer-motion e banco Realtime ✅
- Task 15: Fix `<Toaster>` duplicado em `AdminAlunoDetail` — Claude Code ✅
- Task 16: `/aluno/progresso` — `AlunoProgresso.tsx`, `useProgresso.ts`, gráfico recharts, recordes e histórico ✅
- Task 17: Fix recharts 3.x → downgrade 2.15.4 (compatibilidade Vite) ✅
- Task 18: `/aluno/perfil` — AlunoPerfil.tsx, useAlunoPerfil.ts, avatar, dados pessoais, Strava placeholder, logout ✅
- Task 19: Notificações de PR — AdminPRFeed.tsx, feed de recordes no AdminHome ✅
- Task 20: Code Splitting — React.lazy() + Suspense em todas as rotas ✅
- Task 21: Botão Nova Turma — CreateGroupModal.tsx funcional em /admin/turmas ✅
- Task 22: Error Boundary global — ErrorBoundary.tsx com fallback elegante ✅
- Task 23: Tabela `invites` — Supabase + RLS + log em /admin/convites ✅
- Task 24: Filtros em /admin/alunos — busca por nome + filtro por Turma e Nível ✅
- Task 25: Deploy no Vercel — **https://arbo-weld.vercel.app** ✅
- Task 26: Responsividade Mobile — menu hamburguer no admin, sidebar drawer, tabelas scrolláveis, safe area no aluno ✅
- Task 27: PWA completo — `vite-plugin-pwa`, ícones custom, service worker Workbox, meta tags iOS/Android ✅
- Task 28: Correções UX mobile — bounce iOS, zoom bloqueado, `100dvh` com scroll no `#root` ✅
- Task 29: Login redesign premium (logo Arbo, glassmorphism, glow laranja, ícones lucide nos inputs), novos ícones PWA em `public/icons/`, header da turma reformulado com botão Editar, `EditGroupModal.tsx` ✅
- Task 30: Correção de responsividade mobile no header da turma — layout em coluna, `clamp()` no título, `flexWrap` nas pills, botão Editar integrado; reversão do `minHeight: '70vh'` no grid (Gemini) ✅

**Lint:** `npm run lint` → 0 erros, 0 warnings ✅ (2026-06-04)

### O que foi feito em 2026-05-21
- `useWeeklyPlan`: join N→1 corrigido (`wpt.trainings[0]` → `wpt.trainings`)
- AlunoDashboard redesign premium v2 (Bebas Neue, bottom sheet, skeleton, PR tracking)
- `checkins.perceived_effort smallint` adicionado ao banco

### O que foi feito em 2026-05-27
- Spec do painel admin (spec em `docs/superpowers/specs/2026-05-27-admin-panel-design.md`)
- Painel Admin Fase 1 implementada (AdminLayout, AdminHome, AdminAlunos, AdminFeedbacks, AdminConvites)
- FK ambíguo documentado: `profiles!checkins_student_id_fkey(*)`

### O que foi feito em 2026-05-30 (sessão 1)

**Schema Fase 2:**
- `profiles.role text` adicionado com backfill + trigger `tr_set_profile_role`
- `profiles.group_id uuid` FK para `groups.id` (nullable, ON DELETE SET NULL)
- Tabela `groups` criada com RLS, policies, GRANT e trigger `updated_at`

**Frontend `/admin/turmas` e `/admin/turmas/:id` (Fase 2 completa):**
- `useAdminTurmas.ts` — hook `GroupWithCount`, queries paralelas, contagem por turma
- `AdminTurmas.tsx` — lista de turmas com `TurmaRow` clicável (`useNavigate`) + seta `›`
- `App.tsx` — rotas `/admin/turmas` e `turmas/:id` registradas
- `AdminSidebar.tsx` — "Turmas" ativado
- `AdminHome.tsx` — card "Turmas ativas" com dado real; alunos via `.eq('role', 'aluno')`
- `useAdminAlunos.ts` — workaround `.neq('id', adminId)` → `.eq('role', 'aluno')`
- `types.ts` — tipos `Group`, `GroupPlan`, `GroupPlanTraining` adicionados
- `useAdminTurmaDetail.ts` — fetch do grupo, ciclo de 4 semanas, trainings do ciclo
- `useGroupPlanMutations.ts` — addTraining, removeTraining, createAndAddTraining
- `AdminTurmaDetail.tsx` — WeekView (‹›, 6 colunas), MonthView, SidePanel, CreateTrainingForm
- `useWeeklyPlan.ts` — fallback: aluno sem plano individual usa plano do grupo

**Repositório:** https://github.com/maxwellnasci/arbo  
**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` ✅

### O que foi feito em 2026-05-31

- `useAdminAlunoDetail.ts` — fetch paralelo de profile, grupos, check-ins, PRs e anamnese; mutation `changeGroup`
- `AdminAlunoDetail.tsx` — 3 tabs (check-ins, recordes, anamnese), métricas, dropdown de turma, framer-motion
- `AdminAlunoDetail.module.css` — CSS Modules, dark mode
- Lint zerado: padrão `async function load()` com flag `cancelled` em todos os hooks; `catch (e: unknown)`
- **Sistema de Etiquetas Personalizadas**: Tabela `tags`, FK em `trainings`, tag pill colorida nos cards e criação/seleção inline com 8 cores. 100% completo.
- **Controle de Liberação do Plano**: `released_through_week smallint DEFAULT 0` em `group_plans`; `releaseThrough()` em `useGroupPlanMutations`; lock check em `useWeeklyPlan` (`isLocked`, `lockedWeekNumber`, `lastWeekSummary`); chips S1–S4 + banner admin; `LockedScreen` no AlunoDashboard; `<Toaster />` adicionado ao `App.tsx`.
- **Biblioteca de Treinos**: `/admin/treinos` — biblioteca de treinos implementada via colaboração Gemini + DeepSeek V4 Pro como subagente ✅

### O que foi feito em 2026-06-01

**Refinamento visual de `/admin/treinos` (Claude Code):**
- `TreinoCard.tsx` — reescrito com inline styles dark: fundo `#1c1c1e`, pill de tipo colorida (corrida=#E8521A, hiit=#EF4444, recovery=#22C55E, forca=#3B82F6, mobilidade=#A855F7), pill de etiqueta com cor do banco, stats grid sobre `#111`
- `TreinoFormPanel.tsx` — convertido de Tailwind para inline styles dark; `as any` → `TrainingType`; `resetForm` movida antes do `useEffect`; setState via `async function load()` (padrão CLAUDE.md)
- `AdminTreinos.tsx` — removidas classes Tailwind; botão `+ Novo Treino` em `#E8521A`; busca dark; grid `auto-fill 260px`
- `AdminSidebar.tsx` — fix TS pré-existente: `disabled?: boolean` adicionado ao tipo dos links

**Chat Admin ↔ Aluno (AntiGravity + fix Claude Code):**
- Schema: `messages` (student_id, sender_id, admin_id, content, deleted_by_student, deleted_by_admin, read_at) com RLS + Realtime
- `useChat.ts` — fetch + realtime subscription via supabase channel, soft delete
- `AdminChatPanel.tsx` + CSS Modules — painel lateral framer-motion, integrado em `/admin/alunos/:id`
- `AlunoChat.tsx` + CSS Modules — view full page, aba Chat no BottomNav de `/aluno`
- Fix: `<Toaster>` duplicado removido de `AdminAlunoDetail` (Claude Code)

**Repositório:** https://github.com/maxwellnasci/arbo  
**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` → 0 erros ✅ (2026-06-01)

### O que foi feito em 2026-06-02

**Aba Progresso — `/aluno/progresso` (Claude Code):**
- `src/hooks/useProgresso.ts` — queries paralelas: recordes pessoais, histórico de check-ins com join `trainings`, `paceHistory` (pace médio por mês), `streak` (semanas consecutivas)
- `src/pages/aluno/AlunoProgresso.tsx` — badge de streak, grid de recordes (5km, 10km, 21km, 42km), gráfico LineChart com CustomTooltip em min:seg/km, histórico recente
- `src/pages/aluno/AlunoProgresso.module.css` — CSS Modules dark mode
- `src/pages/aluno/AlunoDashboard.tsx` — aba `progresso` integrada ao BottomNav

**Fix compatibilidade recharts × Vite:**
- Downgrade `recharts` 3.8.1 → **2.15.4** — versão 3.x usa `victory-vendor` (CJS) que causa `require_isUnsafeProperty`; 2.x é ESM nativa
- `vite.config.ts` — `optimizeDeps` removido

**Aba Perfil — `/aluno/perfil` (Gemini + revisão Claude Code):**
- `src/hooks/useAlunoPerfil.ts` — queries paralelas: `profiles` com join `groups(name)` + `strava_connections` (placeholder); padrão `async load()`, `cancelled` flag, `catch (e: unknown)`
- `src/pages/aluno/AlunoPerfil.tsx` — avatar com fallback, dados pessoais (nível, turma), card Strava placeholder, botão logout
- `src/pages/aluno/AlunoPerfil.module.css` — dark mode, glow laranja, `padding-bottom: 96px` para BottomNav
- `src/pages/aluno/AlunoDashboard.tsx` — aba `perfil` navega para `<AlunoPerfil>`; `ProfileMenu` inline antigo removido

**Notificações de PR no admin (Gemini + revisão Claude Code):**
- `src/hooks/useAdminPRs.ts` — query em `records` com join `profiles`; padrão `async load()`, `cancelled` flag
- `src/pages/admin/AdminPRFeed.tsx` — feed dos 5 recordes mais recentes, clicável para `/admin/alunos/:id`
- `src/pages/admin/AdminPRFeed.module.css` — CSS Modules dark
- `src/pages/admin/AdminHome.tsx` — substitui lista inline por `<AdminPRFeed />`; `fetchStats` com `cancelled` flag e `try/finally`

**Code Splitting (Opus 4.6):**
- `src/App.tsx` — todos os imports de páginas convertidos para `React.lazy()`, cada rota envolvida com `Suspense` + `PageLoader` (spinner laranja on-brand)
- Componentes estruturais (`ProtectedRoute`, `AdminRoute`, `AdminLayout`) ficam estáticos
- Task 18: Global Error Boundary, Tabela `invites` (schema), refatoração de loading estados ✅

**Lint:** `npm run lint` → 0 erros, 0 warnings ✅ (2026-06-03)

### O que foi feito em 2026-06-04 (Parte 4)

**Login redesign premium + ícones PWA + EditGroupModal (Gemini):**
- `Login.tsx` — usa `arbo-logo.png` do assets; ícones `Mail`/`Lock` da lucide; card glassmorphism
- `Login.css` — reescrito: `radial-gradient`, glow laranja, inputs com border focus laranja, botão com gradiente e hover animado, estados error/info
- `public/icons/icon-192.png` + `public/icons/icon-512.png` — ícones PWA com logo Arbo (nova pasta `public/icons/`)
- `vite.config.ts` + `index.html` — referências atualizadas para `icons/icon-192.png` e `icons/icon-512.png`
- `AdminTurmaDetail.tsx` — header com breadcrumb, nome + pills de metadados (objetivo, frequência, status), botão "Editar" (`Edit2` lucide)
- `EditGroupModal.tsx` (novo) — form completo para editar nome, objetivo, frequência, tipo de plano e status; dark inline styles; atualiza `groups` via supabase update

**Fix:** `vite.config.js` (cópia compilada redundante) removido pelo Claude Code

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ (2026-06-04)

### O que foi feito em 2026-06-04 (Parte 5)

**Ajustes visuais no grid da semana, vista mês e ícones PWA (Gemini):**
- `AdminTurmaDetail.tsx` — grid da semana com `minHeight: '70vh'`; colunas e células com `flex: 1` + `flexDirection: column` para a vista mês crescer proporcionalmente; células com `height: '100%'`
- `public/icons/icon-192.png` e `public/icons/icon-512.png` — proporção da árvore/logo nos ícones PWA melhorada

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros, 0 warnings ✅ (2026-06-04)

### O que foi feito em 2026-06-04 (Parte 6)

**Correção do header mobile e reversão da altura do grid (Gemini):**
- `AdminTurmaDetail.tsx` — header reestruturado em `flexDirection: 'column'`: linha de navegação (← Turmas + toggle) separada do bloco de informações da turma; título com `clamp(18px, 5vw, 24px)` para responsividade; pills de metadados com `flexWrap: 'wrap'`; botão "Editar" integrado como pill com `marginLeft: 'auto'`; `minHeight: '70vh'` removido do container do grid (altura excessiva na vista de treinos); `flexDirection: 'column'` removido do wrapper da área do grid

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros, 0 warnings ✅ (2026-06-04)

### O que foi feito em 2026-06-04 (Parte 2)

**PWA Completo (Gemini + fix Claude Code):**
- `vite.config.ts` — `vite-plugin-pwa` com `registerType: autoUpdate`, manifest inline (nome, cores, ícones, orientação portrait)
- `public/icon.svg` — ícone "A" estilizado em `#E8521A` sobre fundo `#111111`
- `public/icon-192x192.png` e `public/icon-512x512.png` — ícones PWA
- `index.html` — meta `theme-color`, `apple-touch-icon`, `viewport-fit=cover`
- Build: `dist/sw.js` + Workbox com precache de 29 entradas
- Fix (Claude Code): removidos `public/manifest.json` (redundante), `public/icons.svg` (template não relacionado), `vite.config.js` (cópia compilada)

**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · PWA ✅ (2026-06-04)

### O que foi feito em 2026-06-04

**Responsividade Mobile — Painel Admin e App do Aluno (Gemini):**
- `AdminLayout.tsx` — refatorado para CSS Modules; menu hamburguer mobile; overlay escuro; `useState` para `sidebarOpen`
- `AdminLayout.module.css` — criado; layout desktop `flex-row`, breakpoint 768px; sidebar vira drawer `position:fixed` animado
- `AdminSidebar.tsx` — props `isOpen`/`onClose`; links fecham sidebar ao navegar; `.sidebarOpen` class condicional
- `AdminTurmaDetail.tsx` — WeekView com `overflowX: auto` e `minWidth: 420px` para scroll horizontal
- `AdminConvites.tsx` — tabela `overflowX: auto`, `minWidth: 450px`; form com `flexWrap: wrap`
- `AdminAlunoDetail.module.css` — media 768px: header em coluna, actions full-width, metrics 1 coluna
- `CreateGroupModal.tsx` — campos com `flexWrap: wrap` e `flex: 1 1 200px`
- `AlunoPerfil.module.css` — safe area inset bottom para iPhone com home indicator
- `AlunoProgresso.module.css` — container recharts com `width: 100%` e `overflow: hidden`

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ (2026-06-04)

### O que foi feito em 2026-06-04 (Parte 3)

**Correções UX Mobile (Gemini):**
- `index.html` — `maximum-scale=1.0, user-scalable=no` no viewport: bloqueia pinch-to-zoom e double-tap zoom
- `src/index.css` — `html, body`: `overscroll-behavior: none` (elimina bounce iOS), `overflow: hidden`; `#root`: `height: 100dvh`, `overflow-y: auto`, `-webkit-overflow-scrolling: touch`

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ (2026-06-04)

### O que foi feito em 2026-06-03

**Deploy no Vercel:**
- App publicado em **https://arbo-weld.vercel.app** com SPA routing via `vercel.json`

**Implementação em Paralelo (Antigravity + Subagentes):**
- **Nova Turma:** `CreateGroupModal.tsx` — modal com form completo (nome, objetivo, frequência, tipo de plano, data de início); cria registro na tabela `groups`; ativado pelo botão `+ Nova Turma` em `AdminTurmas.tsx`
- **Error Boundary:** `ErrorBoundary.tsx` — class component global com fallback elegante (mensagem de erro + botão "Tentar novamente"); integrado em `App.tsx` envolvendo todas as rotas
- **Tabela `invites`:** criada no Supabase (id, email, role, status, invited_by, created_at); RLS + policies + GRANT; Edge Function `invite-user` atualizada para registrar no banco; `AdminConvites.tsx` exibe log com email, role, status, data
- **Filtros em Alunos:** `AdminAlunos.tsx` — busca por nome + filtro por Turma (select dinâmico dos grupos) e Nível (`user_level`); filtragem via `useMemo` sobre lista local

**Fix de lint (Claude Code — revisão):**
- `AdminConvites.tsx` — `useEffect` refatorado para `async function load()` com `cancelled` flag (padrão do projeto)

**Types regenerados:** `database.types.ts` atualizado com tabela `invites`

**Repositório:** https://github.com/maxwellnasci/arbo  
**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` → 0 erros ✅ (2026-06-03)

### Próximos passos sugeridos
- Integração Strava (Edge Function via n8n)
- **Ícone do app** — favicon personalizado (árvore/corrida) para aba do navegador, PWA e home screen
- **PWA completo** — manifest.json, service worker, instalável no celular
- **Domínio customizado** — apontar domínio próprio no Vercel (arbo-weld.vercel.app é o atual)

## Roadmap de Telas

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
- Schema pendente: tabela `invites`

~~**Painel Admin — Fase 3**~~ ✅ **100% completa**
- ~~`/admin/treinos` — biblioteca de treinos (CRUD) + visual refinado~~ ✅
- ~~Chat direto admin ↔ aluno + schema `messages`~~ ✅

~~**Bottom Nav — Progresso (`/aluno/progresso`)** — histórico, recordes, gráfico de pace, streak~~ ✅

~~**Bottom Nav — Perfil (`/aluno/perfil`)** — dados pessoais, Strava placeholder, logout~~ ✅

### Ordem de Desenvolvimento
1. ~~Testar Fase 1 do admin visualmente~~ ✅
2. ~~Schema Fase 2 (role + group_id + tabela groups)~~ ✅
3. ~~`/admin/turmas` lista~~ ✅
4. ~~`/admin/turmas/:id` — grid plano mensal~~ ✅
5. ~~`/admin/alunos/:id` — perfil do aluno~~ ✅
6. ~~Painel Admin Fase 3 (treinos ✅ + mensagem ✅)~~ ✅
7. ~~Aba Progresso~~ ✅
8. ~~Aba Perfil~~ ✅
9. ~~Notificações de PR no admin~~ ✅
10. ~~Code Splitting (React.lazy + Suspense)~~ ✅
