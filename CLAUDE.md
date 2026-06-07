# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Histórico detalhado de sessões: [CLAUDE_HISTORICO.md](CLAUDE_HISTORICO.md)

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
- **Deploy:** Vercel — **https://arbo.mxos.com.br** (PWA, possível migração futura para React Native/Expo)
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
| `trainingUtils.ts` | Constantes e helpers compartilhados: `TAG_COLORS`, `TRAINING_TYPE_OPTIONS`, `TRAINING_TYPE_LABELS`, `insertTag()`, `insertTrainingType()` |

Para regenerar `database.types.ts` após mudanças no schema:
```bash
npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts
```

### Tipos disponíveis em `src/lib/types.ts`

`Profile`, `Training`, `WeeklyPlan`, `WeeklyPlanTraining`, `Checkin`, `PersonalRecord` (não `Record` — palavra reservada TS), `Comment`, `Reaction`, `StravaActivity`, `Anamnesis`, `Group`, `GroupPlan`, `GroupPlanTraining`, `Tag`, `TrainingCustomType`, `TrainingType`, `DistanceCategory`, `UserLevel`.

### Banco de dados (Supabase — project: `jhfkflnixzivuichmkie`)

**Tabelas:** `profiles`, `anamnesis`, `trainings`, `weekly_plans`, `weekly_plan_trainings`, `checkins`, `records`, `comments`, `reactions`, `strava_connections`, `strava_activities`, `groups`, `group_plans`, `group_plan_trainings`, `messages`, `invites`, `tags`, `training_types`

**Enums:** `training_type` (enum legado — `trainings.type` migrado para `text`) · `distance_category` · `user_level`

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
| `invites` | SELECT, INSERT |
| `training_types` | SELECT, INSERT, DELETE |

> Ao criar nova tabela: habilitar RLS + executar `GRANT` explícito para `authenticated`. Sem GRANT o cliente recebe erro 42501 mesmo com policy correta.

### Identidade visual

Dark mode + Light mode. Variáveis de tema definidas em `src/index.css`:
- Primária (laranja): `var(--orange)` → `#E8521A`
- Fundo: `var(--bg-primary)` → `#111111` (dark) / `#f5f5f0` (light)
- Usar sempre CSS Variables semânticas — nunca hardcoded hex em novos componentes

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
- `profiles` **tem coluna `role text`** (`'aluno'` | `'admin'`). Filtrar alunos com `.eq('role', 'aluno')`.
- `profiles` **tem coluna `group_id uuid`** — FK para `groups.id`, nullable (`ON DELETE SET NULL`). Alunos sem turma têm `NULL`.
- Trigger `tr_set_profile_role` (BEFORE INSERT em `profiles`) — popula `role` de `raw_user_meta_data` ao criar perfil via convite.
- **Plano de grupo:** `group_plans` (id, group_id, starts_at, notes, created_by, **released_through_week smallint DEFAULT 0** — 0=bloqueado, 1–4=semanas liberadas até N, **bidirecional**: chips S1–S4 fazem toggle — clicar em semana já liberada reduz o valor; clicar na semana ativa seta para N-1, com S1 ativo → 0) + `group_plan_trainings` (id, group_plan_id, week_number 1–4, day_of_week 1–6, training_id, sort_order). Ciclo de 4 semanas calculado a partir de `groups.starts_at`. Admin: acesso total. Aluno: SELECT onde `group_id = profile.group_id`.
- **`supabase gen types`** pode incluir aviso de versão no final do arquivo gerado — remover manualmente as linhas de texto após o `} as const` antes de commitar.
- **Checkins limitados a 100 registros no frontend (`limit(100)`)** — decisão MVP 2026-06-05. Quando algum aluno atingir esse limite, implementar RPC no Supabase para calcular streak no banco e separar da query de exibição.
- **CSS Variables:** usar sempre variáveis semânticas de `src/index.css`. Nunca hardcodar `#fff`, `#000`, `#1c1c1c` etc. em novos componentes.
- **`TrainingType`** é branded union: `'corrida' | 'hiit' | 'recovery' | 'forca' | 'mobilidade' | (string & {})` — aceita strings arbitrárias (tipos custom) sem perder autocomplete. `trainings.type` migrado de enum para `text` (migration `20260606010118`).
- **`training_types`** — tabela de tipos personalizados: `id uuid PK`, `name text NOT NULL UNIQUE`, `is_custom boolean DEFAULT true`, `created_by uuid FK profiles(id)`. Sempre filtrar com `.eq('is_custom', true)` para distinguir dos embutidos.
- **`trainingUtils.ts`** (`src/lib/`) — fonte única de verdade para `TAG_COLORS`, `TRAINING_TYPE_OPTIONS`, `TRAINING_TYPE_LABELS`, e helpers `insertTag(userId, name, color)` / `insertTrainingType(userId, name)`. Não duplicar em componentes.
- **Mutations de etiqueta/tipo** devem ficar no componente pai (page), não em componentes presentacionais. `TreinoFormPanel` expõe `onCreateTag: (name, color) => Promise<Tag | null>` e `onCreateType: (name) => Promise<TrainingCustomType | null>` — a responsabilidade de chamar Supabase é do pai.

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
| `/admin/treinos` | `AdminTreinos` | somente `role=admin` |
| `/aluno` | `AlunoDashboard.tsx` | somente `role=aluno` |
| `/onboarding` | `AnamnesisForm.tsx` | aluno sem anamnese |

### Sistema de convite

Edge Function: `supabase/functions/invite-user/index.ts`  
- Valida JWT do admin, chama `inviteUserByEmail` com `service_role`  
- Fallback para `resetPasswordForEmail` se usuário já existe  
- CORS dinâmico via allowlist explícita (nunca `*`)  
- Open Redirect protegido: `new URL()` + `allowedRedirectHosts.has(u.hostname)`  
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` ao frontend  
- Deploy: `npx supabase functions deploy invite-user --project-ref jhfkflnixzivuichmkie`

**Segurança de role no convite:** a Edge Function pode passar `role` em `user_metadata` — o trigger `on_auth_user_role_set` garante que esse valor seja promovido automaticamente para `app_metadata` (somente servidor), tornando-o imutável pelo cliente.

### Exclusão de aluno

Edge Function: `supabase/functions/delete-user/index.ts`  
- Recebe: `{ userId: string }` no body  
- Valida JWT do admin via `app_metadata.role`  
- Usa `service_role` para chamar `adminClient.auth.admin.deleteUser(userId)`  
- Proteção anti-auto-exclusão (admin não pode deletar a si mesmo)  
- CORS restrito ao mesmo allowlist de `invite-user`  
- Deploy: `npx supabase functions deploy delete-user --project-ref jhfkflnixzivuichmkie`

### Aviso SMTP

O Supabase gratuito tem limite de ~3-4 emails/hora para convites e recuperação de senha.  
Antes de produção, configure SMTP externo (Resend ou AWS SES) em:  
**Supabase Dashboard → Authentication → Settings → SMTP Settings**

## Estado atual (2026-06-06)

- **Média geral:** 8.4/10 — Segurança 8.2 · Performance 8.6 · Qualidade 8.8 · UX/Bugs 8.5 · Arquitetura 8.0 · PWA/Mobile 8.3
- **Tasks 39-47 concluídas**
- **Próxima sessão:**
  - Auditoria Lighthouse no PWA (meta: score 90+).
  - SMTP externo (Resend ou AWS SES) antes de produção.
  - CI/CD GitHub Actions (`tsc + build + lint` a cada push).
  - Vitest — primeiros testes unitários para hooks críticos.
  - README.md público para o repositório.

> Histórico detalhado de cada sessão em [CLAUDE_HISTORICO.md](CLAUDE_HISTORICO.md) — deve ser lido para contexto completo de decisões técnicas passadas.

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
- **Task 12–13:** `/admin/treinos` — biblioteca de treinos CRUD + visual refinado ✅
- **Task 14–15:** Chat admin ↔ aluno com interface premium (Framer Motion, Glassmorphism, Realtime) ✅
- **Task 16–17:** `/aluno/progresso` — gráfico recharts, recordes, streak + downgrade recharts 2.15.4 ✅
- **Task 18:** `/aluno/perfil` — dados pessoais, Strava placeholder, logout ✅
- **Task 19:** Notificações de PR no admin — `AdminPRFeed.tsx` ✅
- **Task 20:** Code Splitting — `React.lazy()` + `Suspense` em todas as rotas ✅
- **Task 21:** Botão Nova Turma — `CreateGroupModal.tsx` ✅
- **Task 22:** Error Boundary global — `ErrorBoundary.tsx` ✅
- **Task 23:** Tabela `invites` + Edge Function atualizada + log de convites ✅
- **Task 24:** Filtros em `/admin/alunos` — busca + turma + nível ✅
- **Task 25:** Deploy no Vercel — **https://arbo.mxos.com.br** ✅
- **Task 26:** Responsividade Mobile — menu hamburguer, sidebar drawer, tabelas scrolláveis ✅
- **Task 27:** PWA completo — `vite-plugin-pwa`, ícones, service worker Workbox ✅
- **Task 28:** Correções UX mobile — bounce iOS, zoom, layout `100dvh` ✅
- **Task 29:** Login redesign premium + ícones PWA + `EditGroupModal.tsx` ✅
- **Task 30:** Correção responsividade mobile no header da turma ✅
- **Task 31 (Fase 5):** CSS Variables semânticas + Dark/Light mode + Redesign premium aluno ✅
- **Task 32:** 10 bugs pós-redesign corrigidos (CSS vars, módulos deletados, error handling) ✅
- **Task 33:** Bug fix — chips S1–S4 agora fazem toggle bidirecional (permite bloquear semanas já liberadas) ✅
- **Task 34:** Feature — Exclusão de aluno: Edge Function `delete-user` + modal de confirmação em `AdminAlunoDetail` ✅
- **Task 35:** Performance — Relatório completo + 7 índices SQL criados no Supabase ✅
- **Task 36:** Sistema de Etiquetas/Tipos inline — `training_types` no banco, seleção + criação inline nos formulários de treino, painel de gerenciamento em `/admin/treinos` ✅
- **Task 37:** 10 correções no sistema de etiquetas/tipos — catch Supabase, cancelled flag, UUID vazio, UNIQUE constraint, hex hardcoded → CSS vars, `is_custom` filter, refetch desnecessário removido, `trainingUtils.ts` extraído, `TrainingType` branded union, mutations movidas para pai ✅
- **Task 38:** Fix "Unexpected Application Error!" em produção — `RouterErrorElement` adicionado como `errorElement` na rota raiz do `createBrowserRouter`; detecta falha de chunk (`Failed to fetch dynamically imported module`) e faz auto-reload com guard `sessionStorage` para evitar loop ✅
- **Task 39:** 5 Melhorias DeepSeek — RLS em `messages`, remoção de `select('*')`, queries paralelizadas via Deep Join em `useAdminTurmaDetail`, `<ConfirmModal />` premium em vez de `window.confirm`, Workbox runtimeCaching + fallback `offline.html` ✅
- **Task 40:** Limpeza profunda de performance/qualidade — 10 ocorrências de `select('*')` removidas em 8 arquivos, deleção do gargalo de N+1 no `changeGroup`, variáveis CSS globais fixadas no `<ConfirmModal />` (`--red-accent` adicionada no Light/Dark) e screenshots fantasmas do manifesto PWA higienizados ✅
- **Task 41:** Refatoração de Qualidade — Remoção de select wildcard em `useAdminTreinos.ts` / `useTreinoMutations.ts`, 25+ hex hardcoded substituídos por CSS variables em `AdminTurmaDetail.tsx`, novas variáveis CSS de suporte no `index.css`, `ConfirmModal.tsx` padronizado, suporte a Light Mode estendido para `ErrorBoundary`, `ProtectedRoute`, `PageLoader`, `RouterErrorElement`, `SetPassword`, e tipos explícitos `DBGroupPlan`/`DBGroupPlanTraining` em `useAdminTurmaDetail.ts` ✅
- **Task 42:** Micro-residuais de Qualidade — Correção de hex em `ErrorBoundary.tsx` (#d14312 e sombra), `SetPassword.tsx` (#ff6b6b), `ConfirmModal.tsx` (background subtleMap e sombra) e `App.tsx` (sombra de erro); novas variáveis de sombra `--shadow-modal` e `--shadow-card` no `index.css` ✅
- **Task 43:** Migração CSS Vars e Performance Server-side — Migração de hex hardcoded em 7 arquivos (`Login.css`, `AdminChatPanel.module.css`, `AlunoDashboard.module.css`, `CreateGroupModal.tsx`, `EditGroupModal.tsx`, `AnamnesisForm.tsx`, `TreinoCard.tsx`); Adição de vars `--purple-accent/subtle` e `--yellow-accent/subtle` no `index.css`; Filtro server-side e remoção do Deep Join no `useAdminTurmaDetail`; `.limit()` adicionado no `useAdminAlunos`, `useChat` e `AdminConvites` ✅
- **Task 44:** Limpeza de hardcoded residuais — Limpeza final de hexadecimais em `AdminConvites.tsx`, `AdminTurmas.tsx`, `AdminFeedbacks.tsx` e `AdminAlunoDetail.tsx` (cerca de 15 cores substituídas por variáveis semânticas como `--red-accent`, `--text-disabled`, `--text-tertiary`) ✅
**Lint:** `npm run lint` → 0 erros, 0 warnings ✅ (2026-06-06)
**Fase 3:** 100% completa ✅  
**Fase 5:** 100% completa ✅

### Próximos passos
- Auditoria Lighthouse no PWA (meta: score 90+)
- SMTP externo (Resend ou AWS SES) antes de produção
- CI/CD GitHub Actions
- Vitest — testes unitários para hooks críticos
- Integração Strava (Edge Function via n8n)
- README.md público

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
| Progresso do Aluno | aba em `/aluno` | ✅ |
| Perfil do Aluno | aba em `/aluno` | ✅ |
| Notificações de PR | widget em `/admin` | ✅ |

### Pendentes
- Integração Strava (Edge Function via n8n)
- SMTP externo (Resend ou AWS SES)

### Task 45 (Findings Claude Code)
- Alta prioridade & Limpeza Rapida: padding-bottom em AlunoPerfil, tipagens catch(err: unknown), limits(200/50/500) em useAdminTreinos, AdminTurmaDetail, useProgresso, useAdminFeedbacks, useAdminAlunoDetail
- CSS e Hardcoded: Migracao de hardcoded hex nos modulos restantes (AdminChatPanel, AdminSidebar, AdminAlunos, DashboardRedirect, AdminLayout.module.css, AlunoChat.module.css, AdminPRFeed.module.css)
- Configuracao: lang pt-BR no index.html e timeout de rede 10s no vite config


### Task 46 (Correções PWA e Mobile)
- navigateFallback: '/offline.html' adicionado no Workbox
- Inputs 15px → 16px em Login.css, SetPassword.tsx, AnamnesisForm.tsx
- Inter duplicada removida do index.html + preload adicionado
- Bebas Neue movida para AdminLayout.module.css (local)
- AlunoDashboard.module.css e AlunoProgresso.module.css — safe area corrigida
- icon-512-maskable.png criado com fundo laranja + 40% padding
- offline.html viewport-fit=cover adicionado

### Task 47 (Security Headers)
- `vercel.json` — bloco `headers` adicionado preservando `rewrites` existente
- `Content-Security-Policy`: origens restritas (self + Supabase + Google Fonts + Resend), bloqueia framing
- `X-Frame-Options: DENY` — proteção contra clickjacking
- `X-Content-Type-Options: nosniff` — impede MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — limita vazamento de URL cross-origin


### Task 48 (Correções Lighthouse)
- index.html — meta description adicionada
- public/robots.txt — criado com allow all
- AlunoDashboard.tsx — tag <main> adicionada
- index.css — --text-tertiary #444444 → #666666 (contraste WCAG AA)
- index.html — preload Inter com onload fallback

Resultado Lighthouse antes:
- Performance: 96
- Accessibility: 87
- Best Practices: 100
- SEO: 83


### Task 49 (Accessibility WCAG AA)
- Login.tsx — div → <main> (landmark)
- SetPassword.tsx — div → <main> (landmark)
- DashboardRedirect.tsx — div → <main> (landmark)
- index.css — --text-tertiary #666666 → #7d7d7d (contraste WCAG AA 4.52:1)
- DeepSeek usado como subagente para calcular ratios de contraste exatos


### Task 50 (Contraste WCAG AA)
- Login.css — placeholder opacity: 1 explícito
- AlunoChat.module.css — placeholder cor tertiary + opacity: 1
- AdminBottomNav.module.css — abas inativas tertiary
- AlunoDashboard.module.css — empty states tertiary
- AlunoProgresso.module.css — empty states tertiary
- AdminPRFeed.module.css — badges tertiary
- LockedScreen.module.css — labels S1-S4 tertiary
- AdminTurmaDetail.tsx — ícones + tertiary
- AdminAlunoDetail.tsx — ícone chevron tertiary
- DeepSeek subagente calculou ratios exatos e identificou opacity padrão dos browsers


### Task 52 (CI/CD GitHub Actions)
- Arquivo .github/workflows/ci.yml criado com sucesso.
- Workflow roda lint, typescript e build em branches e PRs para a master.
- Nota: O push remoto do workflow requer que o Personal Access Token do GitHub tenha o escopo 'workflow'.

