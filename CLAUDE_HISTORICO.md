# CLAUDE_HISTORICO.md

Histórico detalhado de sessões de desenvolvimento do projeto Arbo.  
Para referência técnica atual, ver [CLAUDE.md](CLAUDE.md).

---

## O que foi feito em 2026-05-21
- `useWeeklyPlan.ts` — join N→1 retorna objeto, não array: `wpt.trainings[0]` → `wpt.trainings`
- `AlunoDashboard` redesign premium v2 (Bebas Neue, glow animado, bottom sheet, skeleton, PR tracking)
- `checkins.perceived_effort smallint` adicionado ao banco
- Padrão de JOINs documentado em CLAUDE.md e GEMINI.md

---

## O que foi feito em 2026-05-27
- Spec do painel admin salva em `docs/superpowers/specs/2026-05-27-admin-panel-design.md`
- Painel Admin Fase 1 implementada (AdminLayout, AdminHome, AdminAlunos, AdminFeedbacks, AdminConvites)
- FK ambíguo documentado: `profiles!checkins_student_id_fkey(*)`

---

## O que foi feito em 2026-05-30

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

---

## O que foi feito em 2026-05-31

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

---

## O que foi feito em 2026-06-01

**Refinamento visual de `/admin/treinos` (Claude Code):**
- `TreinoCard.tsx` — reescrito com inline styles dark: fundo `#1c1c1e`, pill de tipo colorida por categoria (corrida=#E8521A, hiit=#EF4444, recovery=#22C55E, forca=#3B82F6, mobilidade=#A855F7), pill de etiqueta com cor do banco, stats grid sobre `#111`
- `TreinoFormPanel.tsx` — convertido de Tailwind para inline styles dark; `as any` corrigido → `TrainingType`; `resetForm` movida antes do `useEffect`; setState via `async function load()` (padrão CLAUDE.md)
- `AdminTreinos.tsx` — removidas classes Tailwind; botão `+ Novo Treino` em `#E8521A`; busca dark; grid `auto-fill 260px`
- `AdminSidebar.tsx` — fix TS pré-existente: `disabled?: boolean` adicionado ao tipo dos links

**Implementação do Chat Admin ↔ Aluno (AntiGravity):**
- Schema: Tabela `messages` criada (id, student_id, admin_id, sender_id, content, deleted_by_student, deleted_by_admin, read_at) com RLS ativada e policies restritas por `role`. Realtime ativado.
- Hook `useChat.ts` — fetch, realtime subscription com supabase channel, soft delete. Bypass no eslint para initial fetch.
- UI Admin: `AdminChatPanel.tsx` + `AdminChatPanel.module.css` — Painel lateral framer-motion com glassmorphism, integrado ao perfil do aluno via botão "Mensagem".
- UI Aluno: `AlunoChat.tsx` + `AlunoChat.module.css` — View full page mobile-first, balões coloridos, soft delete. Aba Chat adicionada no `BottomNav` de `AlunoDashboard`.

**Fix (Claude Code — revisão):**
- `AdminAlunoDetail.tsx` — `<Toaster>` duplicado removido; `App.tsx` já possui o global. Eliminava toasts duplicados.

**Repositório:** https://github.com/maxwellnasci/arbo  
**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` → 0 erros ✅ (2026-06-01)

---

## O que foi feito em 2026-06-02

**Aba Progresso — `/aluno/progresso` (Claude Code):**
- `src/hooks/useProgresso.ts` — queries paralelas: recordes pessoais por categoria (`records`), histórico de check-ins com join `trainings`, cálculo de `paceHistory` (pace médio agrupado por mês), cálculo de `streak` (semanas consecutivas com check-in)
- `src/pages/aluno/AlunoProgresso.tsx` — badge de streak, grid de recordes pessoais (5km, 10km, 21km, 42km), gráfico `LineChart` com `CustomTooltip` formatado em min:seg/km, lista de histórico recente de check-ins
- `src/pages/aluno/AlunoProgresso.module.css` — CSS Modules dark mode
- `src/pages/aluno/AlunoDashboard.tsx` — aba `progresso` integrada ao BottomNav; renderiza `<AlunoProgresso studentId={user.id} />`

**Fix de compatibilidade recharts × Vite:**
- Downgrade `recharts` 3.8.1 → **2.15.4**: versão 3.x usa `victory-vendor` (CJS) que o Vite não consegue pre-bundlar corretamente → `require_isUnsafeProperty`. Versão 2.x é ESM nativa.
- `vite.config.ts` — `optimizeDeps.include: ['recharts']` removido (não efetivo e desnecessário com 2.x)

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

**Code Splitting (Opus 4.6):**
- `src/App.tsx` — todos os imports de páginas convertidos para `React.lazy()`, cada rota envolvida com `Suspense` + `PageLoader` (spinner laranja on-brand)
- Componentes estruturais (`ProtectedRoute`, `AdminRoute`, `AdminLayout`) ficam estáticos (necessários no primeiro render)
- Build gera chunks isolados: AdminHome 4KB, AdminTurmaDetail 24KB, AlunoDashboard 420KB, etc. — aluno nunca baixa código do admin

**Repositório:** https://github.com/maxwellnasci/arbo  
**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` → 0 erros ✅ (2026-06-02)

---

## O que foi feito em 2026-06-03

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

---

## O que foi feito em 2026-06-04

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

**PWA Completo (Gemini + fix Claude Code):**
- `vite.config.ts` — `vite-plugin-pwa` adicionado com `registerType: 'autoUpdate'`; manifest inline com `name`, `short_name`, `theme_color: #111111`, `background_color: #111111`, `display: standalone`, `orientation: portrait`, ícones 192×192 e 512×512
- `public/icon.svg` — ícone custom do Arbo: fundo `#111111`, letra "A" estilizada em `#E8521A` (corrida)
- `public/icon-192x192.png` e `public/icon-512x512.png` — ícones PNG derivados do SVG
- `index.html` — `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, `viewport-fit=cover` para safe area iOS
- Build gera `dist/sw.js` + `dist/workbox-*.js` (Workbox precache de 29 entradas, ~1.18MB)
- **Fix (Claude Code):** removidos `public/manifest.json` (redundante — plugin gera `manifest.webmanifest`), `public/icons.svg` (arquivo de template não relacionado ao projeto), `vite.config.js` (cópia compilada redundante do `.ts`)

**Correções UX Mobile (Gemini):**
- `index.html` — viewport atualizado: `maximum-scale=1.0, user-scalable=no` bloqueia pinch-to-zoom e double-tap zoom indesejados em iPhone/Android
- `src/index.css` — `html, body` recebem `overscroll-behavior: none` (elimina bounce/rubber-band do iOS) e `overflow: hidden` (contém o scroll no `#root`); `#root` muda de `min-height: 100svh` para `height: 100dvh` + `overflow-y: auto` + `-webkit-overflow-scrolling: touch` para scroll nativo suave no iOS

**Login redesign premium + ícones PWA + EditGroupModal (Gemini):**
- `src/components/Login.tsx` — usa `arbo-logo.png` do assets; ícones `Mail` e `Lock` da lucide nos inputs; card glassmorphism com `backdrop-filter: blur`
- `src/components/Login.css` — reescrito do zero: `radial-gradient` no fundo, glow laranja (`filter: blur(60px)`), inputs com ícone + border focus laranja, botão com gradiente e `transform: translateY(-2px)` no hover, estados disabled/error/info
- `public/icons/icon-192.png` + `public/icons/icon-512.png` — ícones PWA com arbo-logo (nova pasta `public/icons/`)
- `vite.config.ts` — caminhos de ícones atualizados para `icons/icon-192.png` e `icons/icon-512.png`
- `index.html` — `apple-touch-icon` atualizado para `/icons/icon-192.png`
- `src/pages/admin/AdminTurmaDetail.tsx` — header reformulado: flex layout com breadcrumb, nome da turma + pills de metadados (objetivo, frequência, status), botão "Editar" com ícone `Edit2` da lucide; `showEditModal` state + `<EditGroupModal>` integrado
- `src/components/admin/EditGroupModal.tsx` — novo componente: form completo para editar nome, objetivo, frequência, tipo de plano e status da turma; dark inline styles; atualiza `groups` via supabase update; toast de sucesso via `onSuccess()`

**Ajustes visuais no grid da semana e correção do header mobile (Gemini):**
- `src/pages/admin/AdminTurmaDetail.tsx`:
  - Header reestruturado em `flexDirection: 'column'`; título com `clamp(18px, 5vw, 24px)`; pills com `flexWrap: 'wrap'`; botão "Editar" integrado à linha de pills
  - `minHeight: '70vh'` removido do container principal do grid (revertido por causar altura excessiva)
- `public/icons/icon-192.png` e `public/icons/icon-512.png` — proporção da árvore/logo nos ícones PWA melhorada

**Convites e Error Boundary (Antigravity):**
- `invite-user/index.ts` — aceita `redirectTo` dinâmico do frontend; fallback para `resetPasswordForEmail` quando erro é `User already registered`
- `useInvite.ts` — `redirectTo` usa `window.location.origin`
- `ErrorBoundary.tsx` — auto-reload se erro for `Failed to fetch dynamically imported module`
- `SetPassword.tsx` — tela de sucesso comemorativa após definição de senha

**Análise dupla (DeepSeek V4 Pro + Claude Code) + correções de qualidade e segurança:**
- `useChat.ts` — padrão `async load()` + `cancelled` flag; cleanup combinado
- `AdminTurmaDetail.tsx` — 4 blocos `catch (e)` → `catch (e: unknown)` com `instanceof Error`
- `Login.tsx` — `handleForgotPassword` exibe erro ao usuário
- `DashboardRedirect.tsx` — refatorado para `async function load()` com try/catch/finally
- `AdminHome.tsx` — `profiles(*)` substituído por `count: 'exact', head: true`; 4 queries paralelas
- `useAlunoPerfil.ts` + `useAdminPRs.ts` — eslint-disable + `as any` removidos
- `AlunoChat.tsx` + `AdminChatPanel.tsx` — `actionError` state adicionado; `catch (e: unknown)`
- `AdminSidebar.tsx` — ternário `disabled` removido
- `invite-user/index.ts` — **Fix de segurança (Open Redirect):** `startsWith()` → `new URL()` + `allowedRedirectHosts.has(u.hostname)`; CORS dinâmico via `getCorsHeaders(origin)` com allowlist explícita
- **Domínio:** `arbo-weld.vercel.app` → `arbo.mxos.com.br` em toda a documentação e configs

**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` → 0 erros, 0 warnings ✅ (2026-06-04)

---

## O que foi feito em 2026-06-05

**Refinamento Visual Global + Modo Claro/Escuro (Fase 5):**
- `src/index.css` — refatorado para CSS Variables semânticas (`--bg-surface`, `--text-primary`, `--bg-card-green`, etc.) em `:root` (dark default) e `[data-theme="light"]`.
- `AdminLayout.tsx` — Remoção do ícone hamburger clássico no desktop. Adicionado logo Árvore minimalista + Menu interativo de Avatar (iniciais) com dropdown animado para Toggle de Tema e Logout. Persistência de tema via `localStorage`.
- `AdminTurmaDetail.tsx` e `AdminPRFeed` — Limpeza de hardcoded colors (`#1c1c1c`, `#fff`, `#000`) e substituição pelas novas CSS Variables.
- **Painel do Aluno Redesign Premium (Fase 5)** — reescrito `AlunoDashboard`, `AlunoProgresso`, `AlunoPerfil` e `AlunoChat` seguindo as variáveis do CSS global. Extraídos componentes base `CheckinSheet` e `LockedScreen`.

**Análise dupla de qualidade pós-redesign (Claude Code — 7 ângulos simultâneos):**
- Code review em 7 ângulos paralelos sobre o redesign da Fase 5: diff scan, removed-behavior auditor, cross-file tracer, CSS variables/dark mode, regressões de segurança, reuse/simplification, altitude
- 27 candidates identificados → 10 bugs confirmados/plausíveis após verificação independente

**10 bugs pós-redesign corrigidos (commit `ab8e4d9`):**
- `src/index.css` — `var(--text-h)` definida: `#ffffff` (dark) e `#18181b` (light) — h1/h2/code invisíveis em dark mode
- `AlunoDashboard.module.css` — `.stateCard`, `.errorText`, `.retryBtn` recriadas (deletadas no redesign)
- `LockedScreen.module.css` — `.cycleBarFuture` e `.cycleLabelFuture` adicionadas (bg: `var(--bg-surface)`, cor: `var(--text-tertiary)`)
- `AlunoChat.module.css` — `.inputArea` com `padding-bottom: calc(70px + env(safe-area-inset-bottom, 16px))` — chat não ficava mais atrás do BottomNav
- `AlunoDashboard.tsx` — `handleDelete` verifica erro do Supabase; `toast.error()` se falhar; `onCheckinSuccess()` só em sucesso
- `CheckinSheet.tsx` — `setTimeout` armazenado em `useRef`, limpo no `useEffect` cleanup no unmount (stale callback)
- `AdminTurmaDetail.tsx` — `useEffect` de treinos/tags verifica `.error` e seta `mutationError` se falhar; `color:'#ccc'`/`'#555'` → `var(--text-primary)`/`var(--text-secondary)` nos inputs/labels
- `AlunoProgresso.module.css` — `width:100%; max-width:100%; overflow:hidden` restaurados no `.chartContainer` (regressão Task 26)
- `AlunoProgresso.tsx` — `type?.toUpperCase()` com optional chaining — evita `TypeError` quando `type` é `null`

---

## O que foi feito em 2026-06-05 (Parte 2)

**Divisão do CLAUDE.md (commit `14d77bb`):**
- `CLAUDE.md` estava acima de 40k caracteres. Dividido em:
  - `CLAUDE.md` — referência técnica concisa (stack, padrões, estado atual, roadmap)
  - `CLAUDE_HISTORICO.md` (este arquivo) — todo o histórico de sessões
- Motivo: limite de contexto nos agentes. Leitura de ambos é necessária para contexto completo.

**Relatório de performance (análise, sem código — Claude Code):**

Achados identificados:
1. **N+1 em `useAdminAlunoDetail.ts`** — query ao banco para buscar grupo quando `allGroups` já está em memória
2. **3 round trips sequenciais em `useAdminTurmaDetail.ts`** — group → plan → trainings em cascata (~240-450ms no mobile)
3. **Checkins sem `limit()` em `useAdminAlunoDetail.ts:59` e `useProgresso.ts:43`** — histórico inteiro sem paginação
4. **`select('*')` em `useAdminAlunos.ts`** — traz todas as colunas quando apenas 6 são usadas
5. **Índices ausentes** — `checkins(student_id)`, `records(student_id, achieved_at)`, `group_plans(group_id, starts_at)`, `group_plan_trainings(group_plan_id)`, `messages(student_id)`, `profiles(role)`
6. **Query em `strava_connections` sempre falha** — RLS sem policy bloqueia silenciosamente; round trip desperdiçado em `useAlunoPerfil.ts`
7. **Logo sem dimensões** — causa layout shift (CLS) em Login e AdminLayout
8. **`useWeeklyPlan.ts` fallback** — até 5 queries sequenciais no path mais lento

7 índices criados no Supabase (SQL Editor):
```sql
CREATE INDEX IF NOT EXISTS idx_checkins_student_id ON checkins(student_id);
CREATE INDEX IF NOT EXISTS idx_records_student_id ON records(student_id);
CREATE INDEX IF NOT EXISTS idx_records_achieved_at ON records(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_plans_group_cycle ON group_plans(group_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_gpt_plan_id ON group_plan_trainings(group_plan_id);
CREATE INDEX IF NOT EXISTS idx_messages_student_id ON messages(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
```

Correções no código (itens 1, 3, 4, 6, 7) ainda **pendentes** para próxima sessão.

**Bug fix — toggle de liberação semanal (commit `ad42bda`):**
- `useGroupPlanMutations.ts`: `releaseThrough` aceita `0 | 1 | 2 | 3 | 4` (antes só `1 | 2 | 3 | 4`)
- `AdminTurmaDetail.tsx`:
  - `handleRelease` renomeado para `handleSetRelease(target: 0|1|2|3|4)` — direto, sem guard de bloqueio
  - Adicionado `handleChipClick(w: 1|2|3|4)`: `target = w === current ? w - 1 : w`
  - Chips S1–S4: `onClick` chama `onNavigate(w)` + `onChipRelease(w)`
  - WeekView recebe nova prop `onChipRelease: (week: 1|2|3|4) => void`
  - `onRelease` agora aceita `0 | 1 | 2 | 3 | 4` (banners Liberar Sn / Liberar tudo mantidos)

**Feature — Exclusão de aluno (commit `ad42bda`):**
- `supabase/functions/delete-user/index.ts` criada e deployada:
  - `{ userId: string }` no body
  - Valida JWT do admin via `app_metadata.role !== 'admin'` (nunca `user_metadata`)
  - `adminClient.auth.admin.deleteUser(userId)` via service_role
  - Proteção: `userId === user.id` → 400
  - CORS allowlist: `https://arbo.mxos.com.br`, `https://arbo-weld.vercel.app`, `localhost:5173/4173`
- `AdminAlunoDetail.tsx`:
  - Import: `Trash2` de lucide, `supabase` de `../../lib/supabase`
  - Estado: `showDeleteModal`, `isDeleting`, `deleteError`
  - `handleDeleteAluno()`: `getSession()` → `fetch delete-user` → `toast.success` → `navigate('/admin/alunos')`
  - Zona de perigo: botão vermelho outline com `Trash2`
  - Modal inline: fundo `rgba(0,0,0,0.8)`, card `var(--bg-surface)`, botão cancelar ghost, confirmar `#dc2626`

**Validação:** `tsc --noEmit` ✅ · `npm run lint` ✅ · `npm run build` ✅

**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` → 0 erros, 0 warnings ✅ (2026-06-05)
