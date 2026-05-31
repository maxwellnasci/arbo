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
group_plans       -- planos de ciclo por turma (group_id, starts_at, notes, created_by)
group_plan_trainings -- pivot: week_number (1–4) × day_of_week (1–6) × training_id
```

#### Convenções de schema
- Distâncias em metros (`integer`), tempos/paces em segundos (`integer`)
- Trigger `update_updated_at_column()` em: profiles, anamnesis, trainings, strava_connections
- Trigger `on_auth_user_created` → cria perfil automaticamente no cadastro
- Trigger `on_auth_user_role_set` → copia `role` de `user_metadata` → `app_metadata` no INSERT (segurança: impede usuário de injetar próprio role)

### Segurança e RLS
- RLS habilitado em todas as 11 tabelas
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
- **Plano de grupo:** `group_plans` (id, group_id, starts_at, notes, created_by) + `group_plan_trainings` (id, group_plan_id, week_number 1–4, day_of_week 1–6, training_id). Ciclo de 4 semanas calculado a partir de `groups.starts_at`.
- **Fallback de plano:** `useWeeklyPlan` busca plano individual primeiro; se não existir e `profile.group_id` não for null, usa plano do grupo da semana correspondente
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

## Estado Atual (2026-05-31)

### Progresso geral
- Tasks 1–3: Schema, RLS, Auth stack ✅
- Task 4: TypeScript + Lint — zero erros ✅
- Task 5: AlunoDashboard com dados reais + redesign premium ✅
- Task 6: Painel Admin — Fase 1 completa ✅
- Task 7: Painel Admin — Fase 2 schema + `/admin/turmas` ✅
- Task 8: `/admin/turmas/:id` — rota, wiring, fallback aluno, build ✅
- Task 9: `/admin/alunos/:id` — perfil do aluno, hook, CSS, lint zero ✅

**Lint:** `npm run lint` → 0 erros, 0 warnings ✅ (2026-05-31)

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
- **Sistema de Etiquetas Personalizadas**: Tabela `tags`, FK em `trainings`, tag pill colorida nos cards e criação/seleção inline com 8 cores. 100% completo (incluindo correção do Claude Code no `handleCreateTag` para exibir erros) e lint zerado.

### Próximo Passo
Painel Admin Fase 3: `/admin/treinos` (biblioteca de treinos CRUD) ou Chat admin ↔ aluno.

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

### Pendentes

**Painel Admin — Fase 2**
- ~~Sistema de etiquetas personalizadas~~ ✅
- Controle de liberação do plano
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
- Gráfico de evolução de pace

**Bottom Nav — Perfil (`/aluno/perfil`)**
- Dados do aluno, Strava, logout

### Ordem de Desenvolvimento
1. ~~Testar Fase 1 do admin visualmente~~ ✅
2. ~~Schema Fase 2 (role + group_id + tabela groups)~~ ✅
3. ~~`/admin/turmas` lista~~ ✅
4. ~~`/admin/turmas/:id` — grid plano mensal~~ ✅
5. ~~`/admin/alunos/:id` — perfil do aluno~~ ✅
6. Painel Admin Fase 3 (treinos + mensagem)
7. Aba Progresso
8. Aba Perfil
