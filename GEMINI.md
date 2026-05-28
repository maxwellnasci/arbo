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
profiles          -- id = auth.users.id, criado automaticamente por trigger
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

> Ao criar nova tabela: habilitar RLS + executar `GRANT` explícito para `authenticated`. Sem GRANT o cliente recebe erro 42501 mesmo com policy RLS correta.

### Tipos TypeScript
- `src/lib/database.types.ts` — gerado pelo Supabase (não editar)
- `src/lib/types.ts` — atalhos: `Profile`, `Training`, `WeeklyPlan`, `WeeklyPlanTraining`, `Checkin`, `PersonalRecord` (não `Record`!), `Comment`, `Reaction`, `StravaActivity`, `Anamnesis`
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

## Observações Importantes
- Sempre responder em português brasileiro
- Priorizar Row Level Security (RLS) no Supabase
- Preferir componentes funcionais e hooks no React
- Edge Functions do Supabase para lógica sensível no backend
- Nunca usar `user_metadata` para autorização — somente `app_metadata`
- `PersonalRecord` como alias de tipo em vez de `Record` (palavra reservada TS)

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

## Estado Atual (2026-05-27)

### Progresso geral
- Tasks 1–3: Schema, RLS, Auth stack ✅
- Task 4: TypeScript + Lint — zero erros ✅
- Task 5: AlunoDashboard com dados reais + redesign premium ✅
- Task 6: Painel Admin — Fase 1 completa ✅

### O que foi feito em 2026-05-21
- `useWeeklyPlan`: join N→1 corrigido (`wpt.trainings[0]` → `wpt.trainings`)
- AlunoDashboard redesign premium v2 (Bebas Neue, bottom sheet, skeleton, PR tracking)
- `checkins.perceived_effort smallint` adicionado ao banco

### O que foi feito em 2026-05-27

**Spec do painel admin:**
- Entrevista com o professor → modelo de turmas explícitas, ciclos mensais, responsivo
- Spec em `docs/superpowers/specs/2026-05-27-admin-panel-design.md`

**Painel Admin — Fase 1 implementada:**

| Arquivo | O que faz |
|---|---|
| `AdminLayout.tsx` | Wrapper com sidebar + `<Outlet />` |
| `AdminSidebar.tsx` | Nav desktop (Turmas/Treinos em breve) |
| `AdminHome.tsx` | Cards com dados reais + recordes recentes |
| `AdminAlunos.tsx` | Lista de alunos tipada com `Profile` |
| `AdminFeedbacks.tsx` | Feed de check-ins com badge PR e esforço |
| `AdminConvites.tsx` | Form de convite com reset de status |
| `useAdminAlunos.ts` | Query real em `profiles` (workaround: `.neq('id', adminId)`) |
| `useAdminFeedbacks.ts` | Query paralela `checkins` + `records`, PR por dia |

`AdminDashboard.tsx` removido (dead code).

**Padrão descoberto:** FK ambíguo — `checkins` tem dois FKs para `profiles`. Usar `profiles!checkins_student_id_fkey(*)`. Ver seção "Padrões Supabase".

**Workaround pendente:** `profiles` não tem coluna `role`. `useAdminAlunos` exclui o admin pelo id. Adicionar `role` à tabela fica para a Fase 2.

**Validação:** `tsc --noEmit` ✅

### Onde paramos
Fase 1 do painel admin commitada. **Não testada visualmente** — validada apenas com tsc.

### Próximo Passo
1. Testar visualmente o painel admin (`npm run dev`)
2. **Fase 2 — Turmas:** tabela `groups`, coluna `role` em `profiles`, `AdminTurmas`, grid plano mensal

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
- Gráfico de evolução de pace

**Bottom Nav — Perfil (`/aluno/perfil`)**
- Dados do aluno, Strava, logout

### Ordem de Desenvolvimento
1. Testar Fase 1 do admin visualmente
2. Painel Admin Fase 2 (turmas + plano mensal)
3. Painel Admin Fase 3 (treinos + mensagem)
4. Aba Progresso
5. Aba Perfil
