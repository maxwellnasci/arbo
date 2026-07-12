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

> **`supabase/migrations/` reflete o schema real de produção** desde o baseline capturado via `supabase db pull` (commit `eb8491f`, 2026-07-11 — 21 tabelas, 65 RLS policies, funções, triggers, grants). A partir de agora, **toda mudança de banco é uma migration nova** (`supabase migration new <nome>` + `supabase db push`), **nunca SQL solto direto no SQL Editor** — SQL aplicado fora de uma migration volta a divergir o repositório do banco real, o mesmo problema que o baseline resolveu.

1. Criar a migration: `npx supabase migration new <nome_descritivo>`
2. Escrever o SQL no arquivo gerado em `supabase/migrations/`
3. Aplicar em produção: `npx supabase db push`
4. Sincronizar os tipos TypeScript:
```bash
npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts
```
5. Confirmar zero erros:
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
- **Armazenamento de vídeo:** Cloudflare R2 (bucket `arbo-videos`, domínio público `videos.mxos.com.br`)
- **IA:** DeepSeek API (`deepseek-chat`) — agente de análise automática de atividades Strava
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
| `scheduleUtils.ts` | `getScheduleStatus(schedule: unknown)` — retorna `'pendente' | 'agendado' | 'concluido'` |

Para regenerar `database.types.ts` após mudanças no schema:
```bash
npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts
```

### Tipos disponíveis em `src/lib/types.ts`

`Profile`, `Training`, `WeeklyPlan`, `WeeklyPlanTraining`, `Checkin`, `PersonalRecord` (não `Record` — palavra reservada TS), `Comment`, `Reaction`, `StravaActivity`, `Anamnesis`, `Group`, `GroupPlan`, `GroupPlanTraining`, `Tag`, `TrainingCustomType`, `TrainingType`, `DistanceCategory`, `UserLevel`, `Schedule`, `GroupMode`, `ScheduleStatus`.

### Banco de dados (Supabase — project: `jhfkflnixzivuichmkie`)

**Tabelas:** `profiles`, `anamnesis`, `trainings`, `weekly_plans`, `weekly_plan_trainings`, `checkins`, `records`, `comments`, `reactions`, `strava_connections`, `strava_activities`, `strava_analysis`, `groups`, `group_plans`, `group_plan_trainings`, `messages`, `invites`, `tags`, `training_types`, `schedules`, `training_programs`

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
| `strava_analysis` | SELECT |
| `groups` | SELECT, INSERT, UPDATE, DELETE |
| `group_plans` | SELECT, INSERT, UPDATE, DELETE |
| `group_plan_trainings` | SELECT, INSERT, UPDATE, DELETE |
| `tags` | SELECT, INSERT, UPDATE, DELETE |
| `messages` | SELECT, INSERT, UPDATE |
| `invites` | SELECT, INSERT |
| `training_types` | SELECT, INSERT, DELETE |
| `schedules` | SELECT, INSERT, UPDATE, DELETE |
| `training_programs` | SELECT, INSERT, UPDATE, DELETE |

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
- **Trigger `trg_prevent_self_privilege_escalation`** (BEFORE UPDATE em `profiles`, função `private.prevent_self_privilege_escalation()`) — bloqueia alteração de `role`/`group_id` por quem não é `private.is_admin()`. A policy `profiles_update` permite `id = auth.uid()` (necessário para o aluno editar nome/avatar), o que sozinho também liberaria o aluno setar `role='admin'` ou `group_id` para qualquer turma via PATCH direto no client REST — RLS controla **quais linhas**, não **quais colunas**, um usuário pode tocar. O trigger fecha esse gap sem restringir a edição legítima dos demais campos (ver Caso 10 em `docs/PORTFOLIO_DEBUG_CASES.md`).
- **FKs de dado operacional do aluno** (`checkins.student_id`, `records.student_id`, `weekly_plans.student_id`, `strava_activities.user_id`, `strava_connections.user_id`) são `ON DELETE CASCADE` para `profiles(id)` — decisão: ao excluir um aluno, o histórico dele é removido de fato (não anonimizado), cumprindo direito ao esquecimento (LGPD). Antes eram `NO ACTION` (padrão implícito), o que fazia `delete-user` falhar com 500 sempre que o aluno tinha qualquer checkin/record/plano/atividade Strava.
- **`records_select`** — `USING ((student_id = auth.uid()) OR private.is_admin())`. Antes era `USING (true)`: qualquer aluno autenticado lia o recorde pessoal de qualquer outro aluno via query direta ao Supabase.
- **Plano de grupo:** `group_plans` (id, group_id, starts_at, notes, created_by, **released_through_week smallint DEFAULT 0** — 0=bloqueado, 1–4=semanas liberadas até N, **bidirecional**: chips S1–S4 fazem toggle — clicar em semana já liberada reduz o valor; clicar na semana ativa seta para N-1, com S1 ativo → 0) + `group_plan_trainings` (id, group_plan_id, week_number 1–4, day_of_week 1–7, training_id, sort_order). Ciclo de 4 semanas calculado a partir de `groups.starts_at`. Admin: acesso total. Aluno: SELECT onde `group_id = profile.group_id`.
- **`supabase gen types`** pode incluir aviso de versão no final do arquivo gerado — remover manualmente as linhas de texto após o `} as const` antes de commitar.
- **Checkins limitados a 100 registros no frontend (`limit(100)`)** — decisão MVP 2026-06-05. Quando algum aluno atingir esse limite, implementar RPC no Supabase para calcular streak no banco e separar da query de exibição.
- **CSS Variables:** usar sempre variáveis semânticas de `src/index.css`. Nunca hardcodar `#fff`, `#000`, `#1c1c1c` etc. em novos componentes.
- **Não há reset global `box-sizing: border-box`** (`*` selector) em `index.css` — só elementos específicos declaram `border-box` individualmente (`#root`, `Login.css`, etc.). Qualquer container novo com `width: 100%` (ou `min-width` fixo) **e** `padding` precisa declarar `box-sizing: border-box` explicitamente — sem isso, o padding é somado por cima dos 100%/min-width, e o elemento estoura a largura do pai/viewport exatamente pela soma do padding horizontal. Esse mesmo padrão de bug apareceu 2× na sessão de 2026-07-12 (grid do `WeekView` admin e `.modal` do `DayPicker`) — ver Caso 12 em `docs/PORTFOLIO_DEBUG_CASES.md`.
- **`TrainingType`** é branded union: `'corrida' | 'hiit' | 'recovery' | 'forca' | 'mobilidade' | (string & {})` — aceita strings arbitrárias (tipos custom) sem perder autocomplete. `trainings.type` migrado de enum para `text` (migration `20260606010118`).
- **`training_types`** — tabela de tipos personalizados: `id uuid PK`, `name text NOT NULL UNIQUE`, `is_custom boolean DEFAULT true`, `created_by uuid FK profiles(id)`. Sempre filtrar com `.eq('is_custom', true)` para distinguir dos embutidos.
- **`trainingUtils.ts`** (`src/lib/`) — fonte única de verdade para `TAG_COLORS`, `TRAINING_TYPE_OPTIONS`, `TRAINING_TYPE_LABELS`, e helpers `insertTag(userId, name, color)` / `insertTrainingType(userId, name)`. Não duplicar em componentes.
- **Mutations de etiqueta/tipo** devem ficar no componente pai (page), não em componentes presentacionais. `TreinoFormPanel` expõe `onCreateTag: (name, color) => Promise<Tag | null>` e `onCreateType: (name) => Promise<TrainingCustomType | null>` — a responsabilidade de chamar Supabase é do pai.
- **`GroupMode = 'fixo' | 'flexivel'`** — valores em português, correspondem ao `CHECK (mode IN ('fixo', 'flexivel'))` no banco. Nunca usar `'fixed'` ou `'flexible'` (causaria rejeição silenciosa).
- **`groups.is_active`** — boolean, já existia desde o schema original. Usado (1) como badge visual "Ativa"/"Inativa" em `AdminTurmas.tsx`, e (2) na policy RLS `aluno_select_groups` (`is_active = true`) — turma inativa fica invisível para alunos, mas continua acessível ao admin. **Mecanismo diferente e independente da exclusão de turma** (abaixo): `is_active = false` é reversível e não apaga nada; a exclusão é `DELETE` real e permanente. Não confundir os dois ao decidir entre "desativar" e "excluir" uma turma.
- **Exclusão de turma** (`deleteGroup()` em `useGroupPlanMutations.ts`) — hard delete real via `supabase.from('groups').delete().eq('id', groupId)` direto do client, **sem Edge Function**: a policy `admin_all_groups` (`FOR ALL`, `private.is_admin()`) já cobre `DELETE` para o admin autenticado. Diferente da exclusão de aluno (que exige `service_role` porque mexe em `auth.users`). Cascade do banco remove `group_plans`/`group_plan_trainings`/`schedules` dependentes; `profiles.group_id` (`ON DELETE SET NULL`) vira `NULL` para os alunos matriculados — eles não são excluídos, só ficam "SEM TURMA". UI em `AdminTurmaDetail.tsx` ("Zona de Perigo") exige digitar o nome exato da turma para confirmar.
- **`training_programs`** — tabela de "bibliotecas"/"pastas" de treino: `id uuid PK`, `name text NOT NULL`, `slug text NOT NULL UNIQUE`, `description text` nullable, `color text NOT NULL DEFAULT 'orange'` com `CHECK IN ('orange','green','yellow','red')`, `created_by uuid`. RLS: `private.is_admin()` para `ALL` (admin gerencia) + `SELECT` aberto a `authenticated` (todos leem). `trainings.program` é `text` livre **sem FK** para `training_programs` — casamento por `slug` feito inteiramente no frontend (confirmar sempre com grep antes de assumir integridade referencial). Excluir uma biblioteca não apaga os treinos que a usam — eles só ficam com `program` órfão, sem badge/filtro. Treinos com `program = NULL` não aparecem na navegação por pastas do `AdminTurmaDetail.tsx` (só a lista raiz de `allPrograms` é iterada) — hoje só são editáveis diretamente em `/admin/treinos`.
- **`trainings.program`** (text, slug de `training_programs`) e **`trainings.category`** (text — método de treino: `intervalado`, `fartlek`, `contínuo`, `progressivo`, `pirâmide`, `regenerativo`, `teste`, `ritmo`) — colunas adicionadas junto com a carga de 48 treinos do professor (2026-07-09). Índices `idx_trainings_program`/`idx_trainings_category`.
- **Tabela `schedules`** — agendamentos de alunos em modo flexível: `student_id`, `group_plan_training_id`, `scheduled_day_of_week smallint CHECK(1-7)`, `checkin_id` (nullable, vinculado ao checar), `completed_at` (nullable). JOIN via `group_plan_training_id` — não há FK direto para `trainings`.
- **`DayTraining.dayOfWeek`** pode ser `null` (modo flexível sem agendamento). Usar `?? 99` em sorts e `?? null` em acessos. Nunca indexar diretamente sem null guard.
- **Convenção `day_of_week` / `scheduled_day_of_week`: 1=Segunda...7=Domingo, nunca 0-6.** Domingo é `7`, não `0`, mesmo `Date.getDay()` do JS retornando `0` pra domingo — normalizar sempre no ponto de comparação (`jsDow === 0 ? 7 : jsDow`, ver `todayDow` em `AlunoDashboard.tsx`). Motivo: pelo menos 2 lugares do código usam `?? 0`/`?? null` como sentinela de "sem dia atribuído" (`useAdminTurmaDetail.ts` no sort, `FlexibleTrainingCard.tsx` no `scheduledDay`) — se domingo fosse `0`, um treino agendado pra domingo ficaria indistinguível de um treino sem dia nenhum nesses pontos. Também bate com a matemática já existente em `dayDate()`/`weekRange()` (`AdminTurmaDetail.tsx`), que calculam o fim da semana como `cycleStart + 6` (o 7º dia).
- **`useScheduling` hook** não inclui confirmação de exclusão — chamador deve usar `<ConfirmModal />`. `window.confirm` é proibido.
- **Rota `/preview-aluno`** ("Testar como Aluno") — dentro de `<AdminRoute />`, monta `<AlunoDashboard previewStudentId="00000000-0000-0000-0000-000000000000">`: o admin navega com a própria sessão, mas todo `student_id` gravado é o UUID fixo do "Aluno Demo" (`demo@arborun.com`, existe em `auth.users`, nunca logado de fato — `last_sign_in_at IS NULL`). Como `auth.uid()` (admin) ≠ `student_id` (Aluno Demo), as policies padrão de aluno (`student_id = auth.uid()`) bloqueiam qualquer escrita em preview. Duas policies adicionais, escopadas **exclusivamente** a esse UUID fixo (não abrem escrita pra admin em nome de qualquer aluno real): `"Admin escreve schedules do Aluno Demo"` (`FOR ALL` em `schedules`) e `"Admin insere checkin do Aluno Demo"` (`FOR INSERT` em `checkins` — só faltava aqui, `checkins_update`/`checkins_delete` já tinham bypass `OR private.is_admin()` de antes). Múltiplas policies permissivas pro mesmo comando se combinam via OR, sem conflito com as policies existentes do aluno real.
- **Vitest** está configurado (`vitest.config.ts`). `npm test` roda os testes. Não há mais "Não há test runner" — era nota desatualizada.

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
| `/strava/callback` | `StravaCallback.tsx` | público (retorno do OAuth do Strava, fora do `ProtectedRoute`) |

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
- Depende das FKs de aluno serem `ON DELETE CASCADE` (ver bullet em "Convenções") — sem isso, `auth.admin.deleteUser()` falha com 500 sempre que o aluno tem checkin/record/plano/atividade Strava.

### Integração Strava (implementada 2026-07-03, estendida 2026-07-04)

5 Edge Functions em `supabase/functions/`:
- **`strava-auth`** — monta a URL de autorização do Strava (`STRAVA_CLIENT_ID` + `SITE_URL`) e responde com `Response.redirect` 302. Chamada via `window.location.href` (navegação direta, não `fetch`) — por isso não valida JWT.
- **`strava-callback`** — valida JWT do aluno, troca `code` por tokens em `POST https://www.strava.com/oauth/token`, grava com `service_role` em `strava_connections` via `upsert(..., { onConflict: 'user_id' })`.
- **`strava-sync`** (v2) — valida JWT, aceita corpo opcional `{ studentId }`: se presente, exige `user.app_metadata.role === 'admin'` (403 caso contrário) e usa `targetUserId = studentId`; senão usa o próprio `user.id`. Busca a conexão (`service_role` + filtro explícito por `targetUserId`, nunca confiando só no bypass de RLS), renova o token se `token_expires_at` já passou, busca até 30 atividades no Strava, filtra as últimas 10 do tipo `Run` e grava em `strava_activities` via `upsert(..., { onConflict: 'strava_id' })`. Retorna `durationSeconds` em cada atividade.
- **`strava-connection`** — GET retorna `{ isConnected, athleteId, connectedAt }` (nunca os tokens); DELETE remove a conexão (desconectar).
- **`strava-analyze`** — recebe `{ activity }` (mesmo formato de `StravaActivitySummary`), calcula `distance_m`/`moving_time_seconds`/`average_speed`, checa se já existe análise para `(student_id, activity_id)` (evita rechamar a API), chama a API do DeepSeek (`deepseek-chat`) com prompt fixo em PT-BR, faz parsing defensivo do JSON retornado (remove ```json fences) e grava em `strava_analysis` via `upsert(..., { onConflict: 'student_id,activity_id' })`.

**Por que 5 e não 3:** `strava_connections` já vinha travada de propósito — RLS ativo, zero policies, GRANT para `authenticated` é só `REFERENCES/TRIGGER/TRUNCATE` (nem SELECT). Sem uma function dedicada, o frontend não teria como checar status/desconectar sem violar essa trava (`strava-connection`). A análise automática por IA exigiu uma quinta function (`strava-analyze`) para nunca expor `DEEPSEEK_API_KEY` ao cliente.

**Schema real da tabela** (confirmado ao vivo via SQL antes de escrever qualquer código): colunas são `user_id` e `token_expires_at` — não `student_id`/`expires_at`.

Frontend:
- `src/hooks/useStravaConnection.ts` — `isConnected`, `athleteId`, `connectedAt`, `activities`, `isLoading`, `isLoadingActivities`, `isSyncing`, `error`, `latestAnalysis`, `isAnalyzing`, `syncActivities()`, `disconnect()`, `refresh()`. Nunca faz `supabase.from('strava_connections')` — só `fetch` contra as Edge Functions com o JWT da sessão atual. Ao carregar (mount) ou sincronizar, se `isConnected`, chama `fetchActivities()` automaticamente (sem exigir clique) e, se houver atividade, dispara `analyzeActivity()` em paralelo sem bloquear a lista.
- `src/hooks/useAdminStravaActivities.ts` — versão admin: chama `strava-sync` com `{ studentId }`, expõe `notConnected` (derivado da mensagem 404 `"Nenhuma conexão com o Strava encontrada."`) e `latestAnalysis` (leitura direta de `strava_analysis` via RLS admin).
- `src/pages/aluno/StravaCallback.tsx` — rota `/strava/callback`, valida `state` (nonce `crypto.randomUUID()` gerado no clique de "Conectar" e guardado em `sessionStorage`) contra CSRF antes de chamar `strava-callback`.
- `src/pages/aluno/AlunoPerfil.tsx` — card Strava profissional (badge de status, data de conexão, ícones lucide, pace/duração), lista de atividades com "Ver mais", e card "Análise do seu último treino" (borda esquerda laranja) com `summary`/`analysis`/`tip` do DeepSeek.
- `src/pages/admin/AdminAlunoDetail.tsx` — seção "Atividades Strava" (professor vê corridas de qualquer aluno) + card "Última análise automática".

**Segurança:** client secret do Strava e `DEEPSEEK_API_KEY` nunca no frontend (só `Deno.env` nas Edge Functions); `access_token`/`refresh_token` nunca retornam em nenhuma resposta ao cliente; todas as functions validam JWT via `userClient.auth.getUser(token)` antes de qualquer operação com `service_role`.

**Tabela `strava_analysis`:** RLS com policy única `student_id = auth.uid() OR private.is_admin()` (mesmo helper das outras tabelas, nunca subquery em `profiles`). `UNIQUE(student_id, activity_id)` evita reanálise da mesma atividade. **Lição:** `GRANT SELECT ON strava_analysis TO authenticated` é obrigatório mesmo com as policies corretas — RLS não substitui GRANT, são camadas separadas no Postgres (ver `GEMINI_LESSONS.md` item 14).

### Upload de Vídeo — Cloudflare R2 (implementado 2026-07-04)

Edge Function `supabase/functions/r2-upload/index.ts`:
- Valida JWT + exige `role=admin`
- Recebe `{ trainingId, filename, contentType, fileSize }` — valida tipo (`video/mp4`, `video/webm`, `video/quicktime`) e tamanho (≤500MB)
- Sanitiza `filename`/`trainingId` (remove acentos/caracteres especiais, previne path traversal)
- Gera uma **presigned URL** (SigV4 via `aws4fetch`, `region: 'auto'`) para `PUT` direto em `videos/{trainingId}/{filename}` no R2 — em vez de proxiar os bytes do vídeo pela function, porque Edge Functions têm limites de memória/tempo incompatíveis com arquivos de até 500MB. As credenciais do R2 nunca saem do servidor.
- Retorna `{ uploadUrl, publicUrl, key }`

Frontend:
- `src/components/admin/TreinoFormPanel.tsx` — toggle "Link YouTube" / "Upload de vídeo"; upload via `XMLHttpRequest` direto para `uploadUrl` (progress bar usando `xhr.upload.onprogress` — `fetch` não expõe progresso de upload); para treino novo (sem `id` ainda), usa `crypto.randomUUID()` como pasta temporária no R2.
- `src/pages/admin/AdminTreinos.tsx` — `handleUploadVideo()` chama `r2-upload` e faz o PUT (responsabilidade de rede no componente pai, não no presentacional, como `onCreateTag`/`onCreateType`).
- `src/components/ui/VideoPlayer.tsx` — detecta a URL: contém `videos.mxos.com.br` → `<video>` nativo (MIME inferido pela extensão); senão tenta extrair ID do YouTube → iframe.
- `vercel.json` — CSP com `media-src` (tocar o vídeo) e `connect-src https://*.r2.cloudflarestorage.com` (PUT direto do browser).

**Pendente:** configuração manual de CORS no bucket R2 (Cloudflare Dashboard) permitindo `PUT` das origens do app — sem isso o navegador bloqueia o upload direto mesmo com a URL assinada correta. Exclusão do objeto no R2 ao remover vídeo também não implementada (só limpa `video_url`).

### Service Worker — estratégia de cache (`vite.config.ts`)

Configurado via `VitePWA({ workbox: { runtimeCaching: [...] } })`. Estratégia por padrão de URL:
- **Navegação (documento HTML)** — `NetworkFirst` (`networkTimeoutSeconds: 5`), `cacheName: 'html-cache'`. `navigateFallback` (default `"index.html"` do `vite-plugin-pwa`) é explicitamente desativado (`navigateFallback: undefined`) — o default gera um `NavigationRoute` preso ao precache, que serve **todo** carregamento de página (inclusive hard refresh) do `index.html` cacheado, com os headers HTTP (CSP, security headers) congelados de quando aquele arquivo foi cacheado pela primeira vez. Como mudanças só em `vercel.json` não alteram os bytes do `index.html`, a revisão do precache nunca muda entre deploys — o Workbox nunca refaz o fetch, e headers desatualizados ficam presos indefinidamente em quem já tinha o SW instalado. Vercel já resolve o fallback de rotas da SPA via `rewrites` (`vercel.json`), então essa rota do SW é redundante para roteamento (ver Caso 11 em `docs/PORTFOLIO_DEBUG_CASES.md`).
- **REST do Supabase** (`/rest/v1/*`) e **Auth** (`/auth/v1/*`) — `NetworkOnly`. Dado de aplicação (treinos, check-ins, sessão) nunca é servido do cache — sempre rede. Antes disso usavam `NetworkFirst` com timeout de 30s e validade de até 24h/1h: em rede instável, o Workbox servia silenciosamente dado obsoleto "com cara de atual" quando a rede falhava/estourava o timeout (ver Caso 9 em `docs/PORTFOLIO_DEBUG_CASES.md`).
- **Storage do Supabase** (`/storage/v1/*`) — `NetworkFirst` (mantido — arquivo estático, não dado de aplicação que muda a cada ação do usuário).
- **Edge Functions** (`/functions/*`) — `NetworkOnly` (sempre foi assim).
- **Imagens** (`png/jpg/jpeg/svg/gif/webp`) — `CacheFirst`, 30 dias.
- `skipWaiting: true` + `clientsClaim: true` — SW assume imediatamente após deploy, sem precisar fechar/reabrir o app (Task 56).
- **`cacheId` versionado** (`arbo-v6`, incrementar a cada mudança de comportamento crítico do SW) — cada bump cria um namespace de cache totalmente novo, forçando refetch de tudo (inclusive o precache do `index.html`). Necessário sempre que uma mudança não muda dado, mas muda **como** o SW decide servir dado (estratégia de cache, `navigateFallback`, etc.) — nesses casos não existe "conteúdo novo" que naturalmente invalide o cache antigo, só o bump força a atualização em quem já tinha o SW anterior instalado.

**Regra geral:** nunca cachear resposta de API que representa estado do usuário (dado que muda por ação de outro usuário/admin) — só cachear assets verdadeiramente estáticos. O mesmo raciocínio vale para o **documento HTML**: ele carrega os headers de segurança da resposta e a referência aos bundles JS/CSS do deploy atual — tratá-lo como asset estático (precache) tem o mesmo risco de servir configuração desatualizada que tratar dado de API como estático.

### Sentry — monitoramento de erro em produção

`@sentry/react` integrado via `src/lib/sentry.ts` — `initSentry()` chama `Sentry.init({ dsn, environment, tracesSampleRate: 0.1 })` só se `VITE_SENTRY_DSN` estiver definida; sem a env var, é **no-op** (não quebra build nem runtime). Chamada em `main.tsx`, antes do primeiro render.

- `ErrorBoundary.tsx` (`componentDidCatch`) chama `Sentry.captureException(error, { contexts: { react: { componentStack } } })` — cobre erros de render não tratados por nenhum boundary mais interno.
- Integrations padrão do SDK (não sobrescritas) incluem `GlobalHandlers` (`window.onerror` + `unhandledrejection`) — captura automática de exceções soltas sem precisar de `try/catch` manual em todo lugar.
- `VITE_SENTRY_DSN` configurada no Vercel (Production + Preview). DSN é um valor público (não secreto) — pode aparecer no bundle final sem risco.
- **CSP:** `connect-src` em `vercel.json` precisa incluir `https://*.ingest.us.sentry.io https://*.sentry.io`, senão o navegador bloqueia o POST do evento de erro mesmo com o DSN configurado corretamente (erro aparece no console, nunca chega no painel do Sentry).

### Aviso SMTP

O Supabase gratuito tem limite de ~3-4 emails/hora para convites e recuperação de senha.  
Antes de produção, configure SMTP externo (Resend ou AWS SES) em:  
**Supabase Dashboard → Authentication → Settings → SMTP Settings**

## Estado atual (2026-07-11)

- **Média geral:** 9.0/10 — Segurança 8.5 · Performance 8.8 · Qualidade 9.2 · UX/Bugs 9.2 · Arquitetura 8.5 · PWA/Mobile 9.0
- **Tasks 39-55, 56, 57, 59, 59c, 60, 61, 62, 63, 64, 65, 66, 67, 68 concluídas**
- **Lighthouse Mobile:** Performance 96 · Accessibility 89 · Best Practices 100 · SEO 100
- **Testes:** 22 testes passando (Vitest)
- **Sessão 2026-07-02:** 2 rodadas de correção no painel do aluno — causa raiz de `groups.starts_at NULL` gerando `group_plans` duplicados (Task 65) e feature de liberação de semana ausente por completo no modo flexível (Task 66). 6 estudos de caso documentados em `docs/PORTFOLIO_DEBUG_CASES.md`, linkado no README.
- **Sessão 2026-07-03 (Task 67):** Integração Strava completa — OAuth, 4 Edge Functions, hook e UI no `AlunoPerfil`.
- **Sessão 2026-07-04 (Task 68):** Strava Fase 2 (card profissional + painel admin + `strava-sync` v2), Upload de Vídeo via Cloudflare R2 (`r2-upload`, presigned URL) e Agente DeepSeek de análise automática de atividades (`strava-analyze`). Ver seções "Integração Strava" e "Upload de Vídeo — Cloudflare R2" acima. 7º estudo de caso documentado em `docs/PORTFOLIO_DEBUG_CASES.md` (GRANT `authenticated` ausente, pego na revisão antes de aplicar SQL).
- **Sessão 2026-07-09:** Biblioteca de treinos dinâmica — tabela `training_programs`, dropdown "Biblioteca de Treinos" substituindo pills fixas, `ManageProgramsModal`/`NewProgramModal`, carga de 48 treinos reais do professor em 3 programas (`trainings.program`/`trainings.category` novas colunas). 4 commits de fix visual/comportamental no dropdown, culminando em correção via `createPortal` para o corte de borda no mobile (Caso 8 em `docs/PORTFOLIO_DEBUG_CASES.md`).
- **Sessão 2026-07-10:** Navegação por pastas no seletor de treinos da turma (`AdminTurmaDetail.tsx` reaproveita `training_programs` como "pastas") + `ManageProgramsModal` (criar/renomear pasta, mover treino entre pastas) + exclusão permanente de turma (hard delete via RLS, sem Edge Function, confirmação por nome digitado).
- **Sessão 2026-07-11 (manhã):** Auditoria e correção de performance/confiabilidade em 4 commits — P1 service worker `NetworkOnly` (fim do cache de dado obsoleto de até 24h, Caso 9 em `docs/PORTFOLIO_DEBUG_CASES.md`), P2 erros de `schedules`/`checkins` não são mais engolidos silenciosamente + hero espera `useProgresso`, P3 skeleton no lugar de tela branca no admin + paralelização de queries em `useWeeklyPlan`, P4 lazy load das abas do aluno + logo PNG→WebP (chunk `AlunoDashboard`: 438kB→33kB gzip 118kB→9,6kB; logo: 454kB→34,7kB).
- **Sessão 2026-07-11 (tarde) — Auditoria de segurança de produção (Fable 5) + 5 bloqueadores corrigidos:** auditoria completa confirmou RLS em 21/21 tabelas, segredos protegidos (nunca expostos ao client), zero XSS, JWT validado em todas as Edge Functions e 0 vulnerabilidade de dependência em produção — 5 bloqueadores encontrados e corrigidos, cada um com commit próprio e testado manualmente em produção: `eb8491f` baseline do schema versionado (ver "Sempre que alterar o banco de dados" acima); `8e40af5` **crítico** — trigger `trg_prevent_self_privilege_escalation` + migração de 3 policies legadas para `private.is_admin()` (Caso 10 em `docs/PORTFOLIO_DEBUG_CASES.md`); `b71b502` **crítico** — FKs de aluno de `NO ACTION` para `CASCADE`, corrige exclusão de aluno e cumpre LGPD; `8d7716f` **alto** — `records_select` restrita ao próprio aluno + admin; `a0b1590` **alto** — integração Sentry. Na sequência, mais 3 correções relacionadas: `a540dbd` bug de botão de ação escondido em `CheckinSheet`/`DayPicker` (`position: fixed` perde a viewport como containing block quando um ancestral tem `transform` do Framer Motion — mesma classe do Caso 8, corrigido com `createPortal`); `ad3a7bf` CSP sem os domínios de ingest do Sentry no `connect-src`; `877fde7` causa raiz real de "Sentry não recebia erro mesmo após o fix do CSP" — Service Worker preso em `navigateFallback: "index.html"` (default do `vite-plugin-pwa`), servindo o documento HTML precacheado com os headers antigos mesmo com hard refresh (Caso 11 em `docs/PORTFOLIO_DEBUG_CASES.md`). Ver seções "Convenções", "Exclusão de aluno", "Service Worker" e "Sentry" acima.
- **Próxima sessão:**
  - Achados extra do advisor de segurança do Supabase (não corrigidos nesta sessão, escopo separado): `search_path` mutável em `update_updated_at_column`/`update_group_plans_updated_at` (risco baixíssimo — nenhuma é `SECURITY DEFINER`); RPCs `SECURITY DEFINER` expostas via REST (`handle_new_user`/`rls_auto_enable`/`set_profile_role`/`set_user_role` são funções de trigger/event-trigger, não invocáveis fora desse contexto — risco zero; `get_user_email` já tem guarda interna de admin, risco baixo); proteção de senha vazada (HaveIBeenPwned) desligada no Supabase Auth — risco médio, fix trivial (toggle no dashboard).
  - Configurar CORS no bucket R2 (Cloudflare Dashboard) para o upload de vídeo funcionar ponta a ponta
  - Testar no celular o fluxo completo de turma flexível ponta a ponta (liberar semana → aluno ver treino → check-in)
  - Endereçar o gap de treinos órfãos (`program = NULL`) na navegação por pastas do `AdminTurmaDetail.tsx` — hoje ficam inacessíveis nesse fluxo, só editáveis via `/admin/treinos`
  - Expandir testes de 22 para 50+ (hooks, componentes, fluxos críticos) — cobrir especialmente `useWeeklyPlan.ts` (cálculo de ciclo) e o branch flexível do `AdminTurmaDetail.tsx`
  - Service layer — abstrair chamadas Supabase para `src/lib/api.ts`
  - Acessibilidade 89 → 95+ (focus indicators, ARIA labels, screen reader)
  - Security scanning no CI (`npm audit`)
  - Push notifications (Web Push API)
  - Sentry para monitoramento de erros em produção
  - Definir com o professor se o agente Strava também deve comentar diretamente na atividade (item 7 do `ARBO_FASE3.md`)

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
- **Task 52:** CI/CD GitHub Actions — `.github/workflows/ci.yml` com lint + tsc + build + test em PRs/pushes para master ✅
- **Task 53:** Vitest — 11 testes em 3 arquivos (auth, formatTime, trainingUtils); `ci.yml` atualizado ✅
- **Task 54:** README.md profissional com badges, stack, setup local e métricas Lighthouse ✅
- **Task 55:** Modo Flexível de Turmas — tabela `schedules`, `groups.mode`, `DayPicker`, `FlexibleTrainingCard`, `ProfessorStatusGrid`, bifurcação fixo/flexível no `useWeeklyPlan`, `GroupMode = 'fixo' | 'flexivel'` ✅
- **Task 56:** Fix PWA Service Worker — `skipWaiting: true` + `clientsClaim: true` no workbox ✅
- **Task 57:** Corrigir findings pós Task 55 — toast.error agendamento, error state ProfessorStatusGrid, `--text-on-brand`, CSS vars `#fff` → CSS vars ✅
- **Task 59:** Bugs visuais AdminConvites + AdminLayout — migração 23× `#fff` → `var(--text-on-brand)` ✅
- **Task 59c:** Navegação admin — AnimatePresence removido, `background-color` no `.main`, prefetch 5 rotas, try/catch/finally em hooks ✅
- **Task 60:** Fix piscada pós-carregamento — `listContainer.hidden` removeu `opacity: 0` nos três pages admin (Alunos, Turmas, Treinos); `setLoading(true)` removido do `useAdminTreinos.fetchTrainings()` (evita flash loading em refetch após mutações) ✅
- **Task 61:** Feature de vídeo YouTube nos treinos — Coluna `video_url` na tabela `trainings`, componente `VideoPlayer` (suporta links e iframe responsivo), campo de URL com validação no `TreinoFormPanel`, e exibição do player em `TrainingCard` e `FlexibleTrainingCard` ✅
- **Task 61b:** Eliminação definitiva de piscadas nas abas admin — 7 commits iterativos: (1) removeu `navigateFallback`/`navigateFallbackDenylist` do workbox + `cacheId: 'arbo-v4'`, (2) migrou `startTransition` → `setState` direto nos hooks (React 18 já bateia), (3) trocou `{isLoading ? <Skeletons> : <RealList>}` por `{isLoading ? null : <motion.div>}` — sem unmount/remount de DOM, (4) removeu stagger de cards individuais (`staggerChildren`) — agora o container inteiro faz fade-in + slide-up (`y:16→0, 0.35s, easeOut`), igual a Home, (5) itens são elementos HTML puros (`<button>`/`<div>`) sem `motion.*`, (6) script nuclear em `index.html` com `localStorage` que desinstala SWs antigos e limpa caches 1×, (7) `TreinoCard` mantém `motion.div` interno mas sem variants propaga renderiza estático ✅
- **Task 62 (2026-06-29):** Fix visibilidade de alunos recém-convidados — Adicionada opção de filtro "Sem Turma" e badge visual vermelho no `AdminAlunos` para destacar alunos que completaram o cadastro mas ainda não possuem turma vinculada. ✅
- **Task 63 (2026-06-29):** 3 Melhorias Admin — Adicionado campo obrigatório de nome na configuração de senha (`SetPassword.tsx`), email do aluno exibido no perfil usando a nova RPC `get_user_email` (`AdminAlunoDetail.tsx`), e reprodução de vídeos incorporada e expansível no card de treinos e no side panel de turmas. ✅
- **Task 64 (2026-06-29):** Edição de perfil no admin e correção de RPC — Implementado fluxo para editar nome de aluno no painel admin, e e-mail via auth recuperado através da RPC (`get_user_email`) corrigida (com cast completo do client no código). ✅
- **Task 65 (2026-07-02):** Correção de causa raiz — chat do aluno sem área de digitar + semanas liberadas não refletindo no aluno. Root cause real: `groups.starts_at NULL` fazia o cálculo de ciclo/semana usar âncora que muda todo dia, gerando `group_plans` duplicados por turma com `released_through_week` divergente entre admin e aluno. Corrigido `AlunoChat.module.css` (padding do `.inputArea` restaurado para não ficar atrás do `BottomNav` fixed), `useWeeklyPlan.ts` (query do ciclo ordena ascendente ao invés de pegar o registro mais recente da janela), dados de 2 turmas corrigidos via SQL direto no Supabase, e `CreateGroupModal.tsx` passou a exigir data de início (evita recorrência em turmas novas). Ver estudo de caso completo em `docs/PORTFOLIO_DEBUG_CASES.md`. ✅
- **Task 66 (2026-07-02):** Fix crítico — modo flexível não tinha NENHUM mecanismo de liberar semana no admin (`AdminTurmaDetail.tsx`). Os chips S1–S4 (`handleChipClick`/`releaseThrough`) só existiam no branch `WeekView` do modo fixo; turmas flexíveis ficavam com `released_through_week` travado em 0 pra sempre — todo aluno via tudo bloqueado, sem forma de o professor liberar. Adicionados os mesmos chips S1–S4 no branch flexível (reuso da lógica existente, sem duplicar). Corrigido também: botão "+ Adicionar Treino" sempre criava na Semana 1 (`openSlot(1, 1)` fixo); lista agora é agrupada por semana (1–4), cada uma com seu próprio botão de adicionar. `AlunoChat.module.css` — padding do `.inputArea` alinhado a 110px (mesmo valor do resto do app) para folga real acima do `BottomNav` no celular. Ver Caso 6 em `docs/PORTFOLIO_DEBUG_CASES.md`. ✅
- **Task 67 (2026-07-03):** Integração Strava — OAuth completo, 4 Edge Functions (`strava-auth`, `strava-callback`, `strava-sync`, `strava-connection` — a 4ª não estava no escopo original, mas foi necessária porque `strava_connections` está travada pra `authenticated` desde sempre), `useStravaConnection.ts`, `StravaCallback.tsx` (com proteção CSRF via `state`), card funcional no `AlunoPerfil.tsx` (conectar/desconectar/sincronizar/lista de atividades). Antes de escrever qualquer SQL, consultado o schema real via MCP Supabase — a tabela já existia com `user_id`/`token_expires_at` (não `student_id`/`expires_at` como um primeiro rascunho supôs) e RLS corretamente travada; nenhuma migration foi necessária. Tokens do Strava nunca trafegam para o cliente — todas as operações passam por `service_role` nas Edge Functions, filtrando explicitamente por `user.id`. ✅
- **Task 68 (2026-07-04):** Três entregas na mesma sessão — (1) **Strava Fase 2**: fix de atividades sumindo ao recarregar (`fetchActivities()` chamada automaticamente no mount), card profissional no `AlunoPerfil.tsx` (badge, data de conexão, ícones), seção "Atividades Strava" no `AdminAlunoDetail.tsx`, `strava-sync` v2 aceitando `{ studentId }` para admin; (2) **Upload de Vídeo via Cloudflare R2**: Edge Function `r2-upload` com presigned URL (SigV4/`aws4fetch`) em vez de proxy de bytes — Edge Functions não aguentariam 500MB; toggle YouTube/Upload no `TreinoFormPanel.tsx`, `VideoPlayer.tsx` detecta R2 vs YouTube automaticamente; (3) **Agente DeepSeek**: tabela `strava_analysis` + Edge Function `strava-analyze` gera `{ summary, analysis, tip }` em PT-BR após cada sync, exibido em card dedicado no aluno e no admin. Bug de `GRANT SELECT ON strava_analysis TO authenticated` ausente pego na revisão do SQL antes de aplicar (mesma classe do incidente da Task 67 com `service_role`) — lição registrada em `GEMINI_LESSONS.md` item 14 e Caso 7 em `docs/PORTFOLIO_DEBUG_CASES.md`. ✅
- **Sessão 2026-07-09:** Biblioteca de treinos dinâmica — tabela `training_programs` (RLS + GRANT `FOR ALL`), dropdown "Biblioteca de Treinos" (`FilterDropdown.tsx` extraído como componente reutilizável) substituindo pills fixas, `ManageProgramsModal`/`NewProgramModal`, carga real de 48 treinos do professor em 3 programas via `trainings.program`/`trainings.category` (novas colunas + índices). 4 commits de fix visual/comportamental no dropdown — extração do componente, redesign visual (laranja + texto branco, lado a lado), correção de overflow, e fix definitivo do corte de borda no mobile via `createPortal` (Caso 8 em `docs/PORTFOLIO_DEBUG_CASES.md`). ✅
- **Sessão 2026-07-10:** Navegação por pastas no seletor de treinos da turma (`AdminTurmaDetail.tsx` reaproveita `training_programs`, chamado de "pasta" na UI do professor — dois níveis: lista de pastas → treinos da pasta) + `ManageProgramsModal.tsx` (criar/renomear pasta, mover treino entre pastas). Exclusão permanente de turma: seção "Zona de Perigo", `deleteGroup()` faz hard delete real (`DELETE` direto, coberto pela policy `admin_all_groups`, sem Edge Function), cascade remove `group_plans`/`group_plan_trainings`/`schedules`, alunos ficam "SEM TURMA" (não são excluídos), confirmação exige digitar o nome exato da turma. ✅
- **Sessão 2026-07-11:** Auditoria de performance/confiabilidade (diagnóstico + 4 commits validados independentemente) — P1: service worker REST/Auth do Supabase `NetworkFirst` → `NetworkOnly` (fim do cache de dado obsoleto de até 24h mascarando falha de rede como dado válido, Caso 9 em `docs/PORTFOLIO_DEBUG_CASES.md`); P2: `useWeeklyPlan.ts` para de descartar o `error` de `schedules`/`checkins`/`prevCheckins` (propagava lista vazia silenciosa), `AlunoDashboard.tsx` espera `isLoading` do `useProgresso` também; P3: `AdminAlunos.tsx`/`AdminTurmas.tsx` trocam `{isLoading ? null : ...}` (tela branca) por `ListSkeleton.tsx` novo, `schedules`+`checkins` do modo flexível paralelizados via `Promise.all` em `useWeeklyPlan.ts` (decisão consciente de **não** paralelizar `weekly_plans`/`group_plans` — dependência real via `released_through_week`); P4: `AlunoChat`/`AlunoProgresso`/`AlunoPerfil`/`CheckinSheet` convertidos para `React.lazy`+`Suspense` (isola `recharts` num chunk só carregado sob demanda), logo PNG 454kB → WebP 512×512 34,7kB. Chunk `AlunoDashboard`: 438,69kB→33,36kB (gzip 117,79kB→9,58kB). ✅
**Lint:** `npm run lint` → 0 erros, 0 warnings ✅ (2026-07-11)
**Fase 3:** 100% completa ✅  
**Fase 5:** 100% completa ✅
**Vitest:** 22 testes passando ✅

### Próximos passos
- Configurar CORS no bucket R2 (Cloudflare Dashboard) para o upload de vídeo funcionar ponta a ponta
- Endereçar treinos órfãos (`program = NULL`) na navegação por pastas do `AdminTurmaDetail.tsx`
- Expandir testes de 22 para 50+ (hooks, componentes, fluxos críticos)
- SMTP externo (Resend ou AWS SES) antes de produção
- Service layer — abstrair chamadas Supabase para `src/lib/api.ts`
- Acessibilidade 89 → 95+ (focus indicators, ARIA labels, screen reader)
- Security scanning no CI (`npm audit`)
- Definir com o professor se o agente Strava também comenta direto na atividade (item 7 do `ARBO_FASE3.md`)

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
| Integração Strava | card na aba Perfil em `/aluno` | ✅ |

### Pendentes
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


### Task 53 (Vitest + Testes)
- Vitest instalado e configurado
- 3 arquivos de teste criados (11 testes no total)
- auth.test.ts — 4 testes de role/autenticação
- formatTime.test.ts — 4 testes de formatação de tempo
- trainingUtils.test.ts — 3 testes de labels e cores
- ci.yml atualizado para rodar npm test automaticamente
- npm test: 11 passed, 0 failed


### Task 54 (README.md Profissional)
- README.md criado com documentação atualizada do projeto Arbo, stack tecnológica, badges de status, setup local e métricas de qualidade Lighthouse.


### Task 55 (Modo Flexível de Turmas)
- Tabela `schedules` criada no Supabase com RLS + policies + GRANT + índices
- `groups.mode text DEFAULT 'fixo' CHECK (mode IN ('fixo', 'flexivel'))`
- `group_plan_trainings.day_of_week` nullable
- `GroupMode = 'fixo' | 'flexivel'` — valores em português (corresponde ao CHECK constraint do DB)
- `useScheduling.ts` — CRUD de agendamentos sem `any`, sem `window.confirm`
- `scheduleUtils.ts` + `scheduleUtils.test.ts` — 11 novos testes (total: 22)
- `DayPicker.tsx` — bottom sheet de seleção de dia
- `FlexibleTrainingCard.tsx` — card de treino modo flexível
- `ProfessorStatusGrid.tsx` — grid alunos × treinos (verde/laranja/cinza)
- `useWeeklyPlan.ts` — bifurcação fixo/flexível, `DayTraining.dayOfWeek` nullable, `scheduleId`
- `AlunoDashboard.tsx` — FlexibleTrainingCard para modo 'flexivel', sort null-safe
- `CheckinSheet.tsx` — planId `string | null`, vincula schedule ao checkin
- `AdminTurmaDetail.tsx` — tabs Status/Treinos, ProfessorStatusGrid integrado
- `CreateGroupModal` + `EditGroupModal` — seletor modo fixo/flexível



### Task 56 (Fix PWA Service Worker)
- vite.config.ts — `skipWaiting: true` e `clientsClaim: true` adicionados no workbox.
- Problema resolvido: após deploy, service worker assume imediatamente sem precisar fechar e reabrir o app.


### Task 57 (Corrigir findings pós Task 55)
- AlunoDashboard.tsx — toast.error adicionado quando agendamento falha.
- ProfessorStatusGrid.tsx — error state implementado e .limit(200) nas queries.
- index.css — --text-on-brand adicionada.
- DayPicker.module.css — #fff substituído por var(--text-on-brand).
- FlexibleTrainingCard.module.css — #fff substituído por var(--text-on-brand).
- FlexibleTrainingCard.tsx — cast DayOfWeek removido da lógica, mantido só na prop.


### Fix pós Task 57
- vercel.json — rewrites condicionais para evitar MIME type error ('text/html is not a valid JavaScript MIME type').
- Assets /assets/*, *.js, *.css servidos diretamente.
- Apenas rotas SPA redirecionam para index.html.


### Task 59 (Bugs visuais AdminConvites e AdminLayout)
- 23 ocorrências de `#fff`/`#ffffff` migradas para `var(--text-on-brand)` em 8 arquivos.
- AnimatePresence `mode="wait"` + `willChange` + `overflow-y: scroll` adicionados ao AdminLayout (causou regressão de 2s na troca de aba — corrigido em Task 59c).


### Task 59c (Fix navegação admin — 2026-06-11)
- `AdminLayout.tsx` — `AnimatePresence` + `motion.div` + import `framer-motion` removidos; `useLocation` removido (só servia de key para motion.div).
- `AdminLayout.module.css` — `background-color: var(--bg-primary)` adicionado ao `.main` (evita flash de fundo transparente no mount); `overflow-y: scroll` → `overflow-y: auto` (elimina layout shift de scrollbar fantasma); `@keyframes pageFadeIn 0.08s` (fade suave sem bloquear exit).
- `AdminLayout.tsx` — `useEffect` com prefetch das 5 rotas admin (`AdminAlunos`, `AdminTreinos`, `AdminTurmas`, `AdminFeedbacks`, `AdminConvites`) no mount do layout — chunks carregados silenciosamente, navegação sem delay após primeira visita.
- `useAdminAlunos.ts` — try/catch/finally adicionado (padrão igual ao `useAdminTreinos`); `isLoading` nunca fica preso em `true` em erros de rede.
- `useAdminTurmas.ts` — try/catch/finally adicionado; `setIsLoading(false)` consolidado no `finally` (antes havia `setIsLoading` duplicado em dois branches).

## Notas Finais (Sessão 2026-06-13)
**Média geral: 8.75/10**
- Segurança: 8.5/10 ✅
- Performance: 8.7/10
- Qualidade de código: 9.0/10 ✅
- UX / Bugs: 8.9/10 (piscadas admin corrigidas — testar Task 60 no celular)
- Arquitetura: 8.3/10
- PWA / Mobile: 8.5/10 ✅

### Lighthouse Mobile:
- Performance: 96
- Accessibility: 89
- Best Practices: 100
- SEO: 100

### Próximas tarefas para chegar em 9.0+
1. Verificar no celular se Task 60 eliminou completamente as piscadas (AdminAlunos, AdminTurmas, AdminTreinos)
2. Testes: expandir de 22 para 50+ testes (hooks, componentes, fluxos críticos)
3. Service layer — abstrair chamadas Supabase dos hooks para src/lib/api.ts
4. Acessibilidade 89 → 95+ (focus indicators, ARIA labels, screen reader)
5. Security scanning no CI (npm audit)
6. Push notifications (Web Push API)
7. Integração Strava via Edge Function + n8n
8. Sentry para monitoramento de erros em produção


### Sessão 2026-06-16 (Atualizações e Consultoria)
- **README.md:** Atualizado com screenshots reais do app (login, admin, treinos) e nova seção "Sobre o projeto" destacando o time de IA orquestrado.
- **STRATEGY.md:** Criado com plano estratégico de consultoria (nichada para assessorias esportivas) e parceria CrossFit/Hyrox.
- **PLAYBOOK.md:** Atualizado com lições das Tasks 59-60 (Navegação/Piscadas resolvidas sem AnimatePresence/wait), eficácia do Sonnet 4.6 (cirúrgico), State Hoisting vs React Router (Mox vs Arbo), e uso estratégico do Fable 5.
- **Notas Técnicas:** Fable 5 foi desabilitado pelo governo americano em 12/06/2026 (export control nacional).
- **Validação:** App testado no celular — navegação 100% fluida, "piscadas" e tela offline indesejada resolvidas.
- **Próximos passos:** Testar com professor esta semana; conversa sobre parceria CrossFit/Hyrox; implementar multi-admin caso o modelo se confirme.


### Sessão 2026-06-29 (Rebranding para Arbo Run)
- **Logo atualizado:** Substituição do logo antigo pelo novo logo Arbo Run em `Login.tsx` e `AdminLayout.tsx`.
- **Transparência e Crop:** Fundo original removido do logo do app (transparente). Ícones PWA gerados perfeitamente através de crop direto do miolo da imagem original (sem zoom artificial que criava franjas e dois tons de preto).
- **Ícones PWA:** Atualizados `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`.
- **Nome do App:** Atualizado para "Arbo Run" em todo o projeto, incluindo `index.html`, `offline.html` e `vite.config.ts`.

### Sessão 2026-06-29 (Tasks 63 e 64 + Bugfix Produção)
- **Task 63:** Adicionado campo de nome obrigatório no `SetPassword.tsx` para novos alunos; criado a RPC `get_user_email` e exibido o e-mail no `AdminAlunoDetail.tsx`; implementado o `VideoPlayer` no `AdminTreinos.tsx` e `AdminTurmaDetail.tsx`.
- **Task 64:** Implementado edição inline de nome no `AdminAlunoDetail.tsx` (mutação no Supabase e atualização imutável no state do React via custom hook, resolvendo erro do ESLint).
- **Fix Vercel CSP (Tela Branca do YouTube):** Corrigido o `vercel.json` adicionando a diretiva `frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;` ao header `Content-Security-Policy`. Sem isso, o app bloqueava iframes de vídeos.
- **Fix Regex do VideoPlayer:** Ampliada a regex no `VideoPlayer.tsx` para reconhecer links de YouTube Shorts (`shorts/`) e URLs contendo parâmetros extras ignorados (`?si=`).
- **Documentação de Portfólio:** Criado o artefato `docs/PORTFOLIO_DEBUG_CASES.md` registrando a proficiência e detalhamento do debug nos casos de Tipagem RPC (TS), CSP de Infra (Vercel) e React Immutability (Linter).

### Sessão 2026-06-30 (Item 1 Fase 3 — Calculadora de Pace)
- **Calculadora de Pace:** Implementado `PaceCalculator.tsx` (standalone modal/bottom-sheet).
- **Funcionalidades:** Cálculos cruzados de Pace, Tempo e Distância, além de conversão para km/h e tabela de projeção de provas clássicas (5k, 10k, 21k, 42k).
- **Integração:** Adicionado botão de atalho interativo no painel do Aluno (`AlunoProgresso.tsx`) e no painel do Admin (`AdminHome.tsx`).

### Sessão 2026-07-03 (Item 6 Fase 3 — Integração Strava)
- **Verificação prévia obrigatória:** antes de escrever qualquer SQL, consultado o schema real de `strava_connections`/`strava_activities` ao vivo via MCP Supabase (`pg_policies`, `information_schema.role_table_grants`, `pg_constraint`). Descoberto que as tabelas já existiam com colunas `user_id`/`token_expires_at` (o rascunho original pedia `student_id`/`expires_at`) e que `strava_connections` já estava corretamente travada — RLS ativo, zero policies, GRANT `authenticated` só `REFERENCES/TRIGGER/TRUNCATE`. Nenhuma migration foi aplicada; o SQL proposto originalmente (`GRANT ... TO authenticated`) teria revertido essa trava e exposto `access_token`/`refresh_token` ao cliente.
- **4 Edge Functions** (não 3 — a 4ª foi necessária pela trava confirmada acima): `strava-auth` (redirect OAuth via `Response.redirect`), `strava-callback` (troca `code` por token, `upsert` em `strava_connections` com `service_role`), `strava-sync` (renova token expirado, busca até 30 atividades no Strava, filtra 10 `Run`, `upsert` em `strava_activities`), `strava-connection` (GET status / DELETE desconectar — únicas formas do cliente saber se está conectado, já que a tabela é inacessível direto).
- **Frontend:** `useStravaConnection.ts` (hook — só `fetch` contra as Edge Functions, nunca `supabase.from('strava_connections')`), `StravaCallback.tsx` (rota pública `/strava/callback`, valida `state` CSRF via `sessionStorage`), card funcional no `AlunoPerfil.tsx` substituindo o placeholder "Em breve" (conectar, desconectar com `ConfirmModal`, sincronizar com spinner, lista de atividades), `AlunoDashboard.tsx` trata retorno `?strava=success` (muda pra aba Perfil + toast).
- **Segurança:** client secret nunca no frontend, JWT validado em toda Edge Function antes de qualquer uso de `service_role`, filtro explícito por `user.id` mesmo com `service_role` (que ignora RLS) para nunca vazar dado entre alunos, tokens do Strava nunca retornam em nenhuma resposta ao cliente.
- **Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅ · commit `325c876` em `master`.
