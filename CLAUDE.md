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

`Profile`, `Training`, `WeeklyPlan`, `WeeklyPlanTraining`, `Checkin`, `PersonalRecord` (não `Record` — palavra reservada TS), `Comment`, `Reaction`, `StravaActivity`, `Anamnesis`, `TrainingType`, `DistanceCategory`, `UserLevel`.

### Banco de dados (Supabase — project: `jhfkflnixzivuichmkie`)

**Tabelas:** `profiles`, `anamnesis`, `trainings`, `weekly_plans`, `weekly_plan_trainings`, `checkins`, `records`, `comments`, `reactions`, `strava_connections`, `strava_activities`

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

## Convenções

- Responder e documentar em **português brasileiro**
- Preferir **componentes funcionais e hooks**
- Sempre habilitar **RLS** em novas tabelas do Supabase
- Usar **Edge Functions** para lógica de backend sensível
- Não usar `user_metadata` para autorização — apenas `app_metadata`
- `PersonalRecord` como alias de tipo (não `Record`)
- `profiles` **não tem coluna `role`** — role fica em `app_metadata`. Para filtrar alunos, usar `.neq('id', user.id)` como workaround MVP (exclui o admin). Adicionar coluna `role` à tabela é pendente para a Fase 2 do painel admin.

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

## Estado atual (2026-05-27)

### Progresso geral
- **Task 1–3:** Schema, RLS, Auth stack ✅
- **Task 4:** TypeScript + Lint — zero erros ✅
- **Task 5:** AlunoDashboard com dados reais + redesign premium ✅
- **Task 6:** Painel Admin — Fase 1 completa ✅

### O que foi feito em 2026-05-21
- `useWeeklyPlan.ts` — join N→1 retorna objeto, não array: `wpt.trainings[0]` → `wpt.trainings`
- `AlunoDashboard` redesign premium v2 (Bebas Neue, glow animado, bottom sheet, skeleton, PR tracking)
- `checkins.perceived_effort smallint` adicionado ao banco
- Padrão de JOINs documentado em CLAUDE.md e GEMINI.md

### O que foi feito em 2026-05-27

**Spec do painel admin:**
- Entrevista com o professor → decisões de design documentadas
- Modelo de turmas explícitas (`groups` table) escolhido para Fase 2
- Spec salva em `docs/superpowers/specs/2026-05-27-admin-panel-design.md`

**Painel Admin — Fase 1 implementada e corrigida:**

Arquivos criados:
- `src/pages/admin/AdminLayout.tsx` — wrapper com `<Outlet />`, sidebar fixa
- `src/pages/admin/AdminSidebar.tsx` — nav com todas as rotas (Turmas/Treinos atenuados como "em breve")
- `src/pages/admin/AdminHome.tsx` — cards com dados reais (alunos, feedbacks, PRs) + lista de recordes recentes
- `src/pages/admin/AdminAlunos.tsx` — lista tipada de alunos com avatar, nível, botão Convidar
- `src/pages/admin/AdminFeedbacks.tsx` — feed de check-ins com badge 🏆 PR, esforço emoji, dados reais
- `src/pages/admin/AdminConvites.tsx` — form de convite com reset de status no onChange
- `src/hooks/useAdminAlunos.ts` — query real em `profiles` (workaround: exclui admin pelo id)
- `src/hooks/useAdminFeedbacks.ts` — query paralela `checkins` + `records`, detecção de PR por dia

`AdminDashboard.tsx` removido (dead code substituído pelo novo AdminLayout).

9 problemas corrigidos no code review:
1. Dead code `AdminDashboard.tsx` deletado
2. `aluno: any` → `Profile` (type-safe)
3. `fb: any` → `FeedbackItem` (type-safe)
4. Botão "+ Convidar" sem handler → navega para `/admin/convites`
5. `Link to="#"` para itens desabilitados → `<span>` semântico
6. `useAdminAlunos` stub → query real Supabase
7. `useAdminFeedbacks` stub → query paralela com detecção de PR
8. `AdminHome` hardcoded 0 → dados reais via Supabase
9. Status de erro em convites não resetava → reset no `onChange`

**Padrão descoberto hoje:**
- FK ambíguo: `checkins` tem dois FKs para `profiles`. Usar `profiles!checkins_student_id_fkey(*)` no select. Ver seção "Padrões Supabase" acima.

**Validação:** `tsc --noEmit` ✅

### Onde paramos
Fase 1 do painel admin completa e commitada. **Não testada visualmente ainda** — validada apenas com tsc.

### Próximo passo
1. Testar visualmente o painel admin no browser (`npm run dev`)
2. **Fase 2 — Turmas:**
   - `ALTER TABLE profiles ADD COLUMN role text` (ou outro mecanismo para filtrar alunos)
   - Criar tabela `groups` (nome, objetivo, frequência)
   - `AdminTurmas` + `AdminTurmaDetalhe` (grid plano mensal 4 semanas)
   - Atribuição de plano em lote para alunos da turma

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

### Pendentes

**Painel Admin — Fase 2**
- `/admin/turmas` — lista de turmas com objetivo/frequência
- `/admin/turmas/:id` — grid plano mensal (4 semanas)
- `/admin/alunos/:id` — perfil do aluno
- Schema: tabela `groups`, coluna `role` em `profiles`, tabela `invites`

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
1. Testar visualmente Fase 1 do admin + corrigir regressões
2. Painel Admin Fase 2 (turmas + plano mensal)
3. Painel Admin Fase 3 (treinos + mensagem)
4. Aba Progresso
5. Aba Perfil
