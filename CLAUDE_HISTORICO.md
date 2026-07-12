# CLAUDE_HISTORICO.md

Histórico detalhado de sessões de desenvolvimento do projeto Arbo.  
Para referência técnica atual, ver [CLAUDE.md](CLAUDE.md).

---

## O que foi feito em 2026-07-01 (Sessão de Bugfixing)

**Fix 1: Sincronização de Ciclos (Treinos não liberando no Aluno)**
- **Problema:** O Admin avançava a liberação do plano para as próximas semanas, mas o app do Aluno exibia "Conteúdo bloqueado".
- **Causa Raiz:** O Admin (`useAdminTurmaDetail.ts`) calculava a "semana atual" do ciclo baseando-se nas semanas transcorridas entre a data de início da turma (`starts_at`) e `new Date()` (hoje). Já o Aluno (`useWeeklyPlan.ts`) utilizava sempre a "segunda-feira da semana corrente" (`getMonday()`) como âncora. Isso gerava um dessincronismo no cálculo de datas caso o `starts_at` da turma caísse no meio da semana (ex: quarta-feira), deixando o aluno 1 semana "atrasado".
- **Resolução:** O hook `useWeeklyPlan.ts` foi refatorado para utilizar a **mesma matemática de ciclos** (`cycleIndex`, `weeksElapsed`, `cycleStartDate`) do painel Admin. A função `getGroupPlanWeekNumber` foi deletada por se tornar obsoleta.
- **Side-effect mitigado:** O TypeScript cache (`tsbuildinfo`) escondeu o erro de variável não-utilizada (`getGroupPlanWeekNumber`) localmente, mas gerou um bloqueio (TS6133) no CI da Vercel. A função não-utilizada foi removida e uma lição (`GEMINI_LESSONS.md`) foi adicionada sobre invalidação de cache.

**Fix 2: Campo de Chat ocultado (Aba Professor)**
- **Problema:** A `inputArea` para envio de mensagens na aba Professor sumiu inteiramente do AlunoDashboard.
- **Causa Raiz:** Modificações anteriores no wrapper global do AlunoDashboard (`.contentWrapper`) com `flex: 1` e `overflow: hidden` empurraram a base do chat para debaixo do menu fixo inferior (`BottomNav`). O padding aplicado in-line não era repassado adequadamente na árvore do flexbox no mobile, o que não resolvia o problema do overflow de elementos internos.
- **Resolução:** O estilo in-line do `AlunoDashboard.tsx` foi revertido (restaurando `styles.contentWrapper`). O `padding-bottom` (de `calc(76px + env(safe-area-inset-bottom, 16px))`) foi movido diretamente para a classe `.inputArea` no `AlunoChat.module.css`. O campo de digitação subiu, a área de fundo contorna a navbar fixada sem falhas visuais, e o clique/foco não é mais encoberto.

---

## O que foi feito em 2026-06-29

**Task 61: Feature de vídeo YouTube nos treinos**
- Coluna `video_url text` adicionada na tabela `trainings` no Supabase.
- Componente `VideoPlayer.tsx` criado, utilizando regex extrair o ID de diferentes formatos de link do YouTube.
- Formulário do admin (`TreinoFormPanel.tsx`) atualizado com o campo URL opcional e validação de formato.
- Componentes do Aluno (`TrainingCard` e `FlexibleTrainingCard`) ajustados para exibir os vídeos.
- Bugfix na exibição: Corrigido o hook `useWeeklyPlan.ts` (faltava o `video_url` no `.select()` nos joins de `trainings`) e no `useTreinoMutations.ts`.

**Task 62: Fix visibilidade de alunos recém-convidados no Admin**
- Diagnóstico revelou que alunos sem `group_id` ou `full_name` não recebiam tratamento visual adequado e desapareciam ao buscar ou filtrar turmas.
- O componente `AdminAlunos.tsx` foi atualizado com a opção `"Sem Turma"` (mapeada para `group:null`) na dropdown de filtros.
- O `AlunoRow` foi aprimorado com fallback no nome (`Novo Aluno (sem nome)`) e um badge visual vermelho `<span style={{ background: 'var(--red-accent)', ...}}>SEM TURMA</span>`.

**Task 63: 3 Melhorias de fluxo no painel Admin**
- **Cadastro (SetPassword.tsx):** Inserido campo obrigatório "Seu nome completo". Nome agora é capturado e gravado junto da senha via `update()` no Supabase. Isso resolve o problema de alunos fantasmas que ficavam sem nome no painel admin.
- **Visualização de Email:** Criada uma RPC segura `get_user_email` (`SECURITY DEFINER`) para contornar a limitação de não termos o e-mail na tabela `profiles`. `useAdminAlunoDetail.ts` e `AdminAlunoDetail.tsx` atualizados para exibir o email recuperado de `auth.users` apenas para usuários com role de admin.
- **Vídeo Player no Admin:** Importado botão de play iterativo (`PlayCircle`) da lucide-react para o `TreinoCard.tsx`, que agora inclui expansão inline animada do iframe de YouTube. Também acoplado no `SidePanel` do `AdminTurmaDetail.tsx`, deixando a biblioteca de treinos e turmas plenamente equipadas.

**Task 64: Edição de Perfil e Correção de RPC na Vercel**
- Corrigido erro de build na Vercel (`TS2345 never`) causado pela falta de mapeamento da nova RPC `get_user_email` nos tipos do Supabase. A solução adotada foi retirar a chamada do `Promise.all` (para não contaminar a inferência de tipos da tupla) e usar bypass completo no client: `(supabase as any).rpc(...)`.
- A lição sobre casting correto em RPC não mapeada foi registrada no `GEMINI_LESSONS.md`.
- Funcionalidade de edição de nome e visualização de e-mail agora estão completamente limpas no painel Admin.

**Task 65: UX Bugfix em Treinos Bloqueados (LockedScreen Auto-Fallback)**
- Diagnóstico: Relato de usuários que, mesmo após a liberação da semana pelo admin, o painel do aluno continuava "trancado". A causa era que o `weeksElapsed` avançava automaticamente a turma para a semana atual (ex: Semana 3), mas se o admin só havia liberado até a Semana 2, a lógica travava o aluno numa grande tela de cadeado "Conteúdo Bloqueado", sem que ele percebesse ser possível clicar na barra "S2" da interface.
- Solução: Implementado um elegante "Auto-Fallback" no `useWeeklyPlan.ts`. Se o `targetWeekNumber` atual for maior que a semana máxima liberada (`releasedThroughWeek`), o sistema automaticamente faz downgrade para a maior semana livre, evitando a barreira visual da `LockedScreen`. O estado de `activeWeek` no `AlunoDashboard.tsx` foi sincronizado de forma correta e nativa para refletir esse ajuste do hook.

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


### Task 59 (Bugs visuais — sessão anterior)
- 23 ocorrências de `#fff`/`#ffffff` migradas para `var(--text-on-brand)` em 8 arquivos.
- `AdminLayout.tsx` — `AnimatePresence mode="wait"` + `willChange` + `overflow-y: scroll` adicionados (tentativa de animar transição de abas — causou regressão de 2s na troca de aba → corrigido em Task 59c).


### Task 59c (Fix navegação admin — 2026-06-11)

**Problema:** Troca de aba no admin travava ~2s; piscada de fundo transparente no mount; React.lazy causava delay na primeira visita; hooks sem try/catch travavam em loading infinito em erros de rede.

**Diagnóstico Task 59b:**
- `AnimatePresence mode="wait"` força exit animation completa antes do enter → com React.lazy, sequência era: exit (0.12s) → aguarda exit → carrega chunk JS → PageLoader → enter (0.12s) = ~2s no pior caso
- `overflow-y: scroll` força scrollbar sempre visível = layout shift
- `willChange: 'opacity, transform'` cria compositor layers desnecessários

**Fixes implementados:**

1. **Background flash (AdminLayout.module.css):**
   - `background-color: var(--bg-primary)` adicionado ao `.main` — sem essa propriedade o `.main` montava transparente por alguns ms antes do CSS aplicar
   - `overflow-y: scroll` → `overflow-y: auto` — scrollbar só aparece quando necessário
   - `@keyframes pageFadeIn 0.08s ease-out` — fade suave de entrada, sem bloqueio de exit

2. **AnimatePresence removido (AdminLayout.tsx):**
   - `import { motion, AnimatePresence }` removido
   - `import { useLocation }` removido (só servia de key para `motion.div`)
   - `<AnimatePresence mode="wait"><motion.div ...>` → `<Outlet />` direto
   - Troca de aba agora é instantânea — sem sequência exit→enter

3. **Prefetch das rotas admin (AdminLayout.tsx):**
   - `useEffect(() => { import('./AdminAlunos'); import('./AdminTreinos'); import('./AdminTurmas'); import('./AdminFeedbacks'); import('./AdminConvites') }, [])` no mount do layout
   - Após primeira visita ao admin, todos os chunks JS das abas já estão em cache do browser
   - Navegação subsequente sem delay de carregamento de chunk

4. **Fix trava loading (useAdminAlunos.ts + useAdminTurmas.ts):**
   - `useAdminAlunos` não tinha try/catch — erros de rede deixavam `isLoading: true` para sempre
   - Ambos reestruturados com `try/catch/finally`; `finally { if (!cancelled) setIsLoading(false) }` garante que `isLoading` sempre resolve
   - Padrão igual ao `useAdminTreinos` que já estava correto

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅
**Status:** Aguardando teste no celular para confirmar se tremida residual foi eliminada

**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` ✅

### Task 61 (Feature de vídeo YouTube nos treinos — 2026-06-29)

**Problema:** Professores precisavam vincular vídeos do YouTube (técnicas, instruções) diretamente nos treinos diários para visualização in-app pelos alunos.

**Implementação:**
1. **Banco de Dados & Tipos:**
   - Adicionada coluna `video_url text` na tabela `trainings`.
   - Modificados os tipos (`database.types.ts`) para suportar a nova coluna no `Row`, `Insert` e `Update`.
2. **Hook de Admin (`useAdminTreinos.ts`):**
   - Atualizado o método `.select()` para buscar o campo `video_url`.
3. **Novo Componente (`VideoPlayer.tsx`):**
   - Criado componente flexível para extrair dinamicamente o ID do YouTube das URLs (`watch?v=`, `youtu.be/`, `embed/`).
   - Usa iframe com `aspect-ratio: 16/9` e responsividade 100% de largura seguindo o design system.
4. **Formulário de Treinos (`TreinoFormPanel.tsx`):**
   - Inclusão do campo opcional "URL do Vídeo".
   - Adicionada validação de regex; previne submissão se a string preenchida não contiver um ID válido do YouTube.
5. **Dashboard do Aluno (`TrainingCard` & `FlexibleTrainingCard`):**
   - Player incorporado sob as métricas de treinos fixos e flexíveis, renderizado se `video_url` for não nulo.

**Validação:** `tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` ✅
### Task 60 (Fix piscada pós-carregamento — 2026-06-13)

**Problema:** Nas páginas AdminAlunos, AdminTurmas e AdminTreinos, após os dados chegarem, o conteúdo "piscava" brevemente antes de estabilizar.

**Diagnóstico (causa raiz):**
- `listContainer.hidden = { opacity: 0 }` fazia o container da lista montar com `opacity: 0`. Existe 1-2 frames onde o container já ocupa o layout (loading text sumiu) mas está transparente — o fundo do app aparece brevemente. Isso era a "piscada".
- Em `useAdminTreinos.ts`, `setLoading(true)` era chamado dentro de `fetchTrainings()` a cada run. No refetch (após salvar/deletar treino), a sequência era: lista desaparece → "Carregando..." aparece → motion.div desmonta → dados chegam → motion.div remonta em opacity:0 → segunda piscada. `useAdminAlunos` e `useAdminTurmas` nunca tinham esse comportamento.

**Fixes implementados:**

1. **`AdminAlunos.tsx`, `AdminTurmas.tsx`, `AdminTreinos.tsx`:**
   - `listContainer.hidden` alterado de `{ opacity: 0 }` para `{}` (objeto vazio)
   - Container monta imediatamente visível (opacity 1 natural)
   - Propagação de variant string `"hidden"` para filhos continua funcionando — `motion.button`/`motion.div` com `variants={listItem}` ainda recebem `initial="hidden"` do pai, stagger preservado

2. **`useAdminTreinos.ts`:**
   - `setLoading(true)` removido de dentro de `fetchTrainings()`
   - `loading` começa como `true` via `useState(true)` — carregamento inicial funciona igual
   - Refetch agora mantém dados anteriores visíveis enquanto busca novos (padrão consistente com `useAdminAlunos` e `useAdminTurmas`)

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅

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

---

## O que foi feito em 2026-06-05 (Parte 4)

**Sistema de Etiquetas/Tipos inline (Gemini — implementação inicial):**
- Schema: tabela `training_types` criada no Supabase com RLS e GRANT: `id uuid PK`, `name text NOT NULL UNIQUE`, `is_custom boolean DEFAULT true`, `created_by uuid FK profiles(id)`, `created_at timestamptz`
- Migration `20260606010118` aplicada: `trainings.type` migrado de `training_type` enum para `text` — permite tipos personalizados livres
- `TreinoFormPanel.tsx` — campos de Tipo e Etiqueta com seleção inline + criação de novo tipo/etiqueta diretamente no formulário (sem sair da tela); color picker de 8 cores para etiquetas
- `AdminTreinos.tsx` — painel "Gerenciar Etiquetas e Tipos" colapsável com lista + botão de exclusão individual para cada etiqueta/tipo
- `AdminTurmaDetail.tsx` — integração do mesmo sistema inline no `CreateTrainingForm` da turma

**10 correções (Claude Code — code review + fixes, commit `c65ef16`):**
1. **`try/catch` em chamadas Supabase** removido — Supabase JS nunca lança; verificar `{error}` do retorno
2. **`cancelled` flag** adicionada no `useEffect` de carga de tags/tipos em `AdminTreinos.tsx` — previne setState em componente desmontado
3. **User guard** em `handleCreateTag`/`handleCreateType` — `if (!user) { toast.error('Sessão expirada'); return null }`
4. **UNIQUE constraint** `training_types_name_unique` aplicada via migration `20260606020000` — previne tipos duplicados; código trata código `23505` com mensagem amigável
5. **Hex hardcoded** em `TreinoFormPanel` substituídos por CSS vars: `#111` → `var(--bg-input)`, `#fff` → `var(--text-primary)`, `#333` → `var(--border-subtle)`, etc.
6. **`.eq('is_custom', true)`** adicionado à query de `training_types` — distingue tipos embutidos dos personalizados
7. **`refetch()` desnecessário** removido dos handlers de delete em `AdminTreinos.tsx` — atualização otimista via `setState` é suficiente
8. **`TAG_COLORS` e labels extraídos** para `src/lib/trainingUtils.ts` — fonte única compartilhada entre `TreinoFormPanel` e `AdminTurmaDetail`; helpers `insertTag()` e `insertTrainingType()` também centralizados
9. **`TrainingType` como branded union** em `src/lib/types.ts`: `'corrida' | 'hiit' | 'recovery' | 'forca' | 'mobilidade' | (string & {})` — preserva autocomplete e aceita valores custom
10. **Mutations movidas para componente pai** — `TreinoFormPanel` agora recebe `onCreateTag: (name, color) => Promise<Tag | null>` e `onCreateType: (name) => Promise<TrainingCustomType | null>`; Supabase não é chamado dentro do componente presentacional

**Arquivos criados/modificados:**
- `src/lib/trainingUtils.ts` (NOVO) — `TAG_COLORS`, `TRAINING_TYPE_OPTIONS`, `TRAINING_TYPE_LABELS`, `insertTag()`, `insertTrainingType()`
- `supabase/migrations/20260606020000_training_types_unique_name.sql` (NOVO — deve ser aplicado manualmente)
- `src/lib/types.ts` — `TrainingType` alterado para branded union; `Tag` e `TrainingCustomType` adicionados
- `src/components/admin/TreinoFormPanel.tsx` — props async, CSS vars, sem Supabase direto
- `src/pages/admin/AdminTreinos.tsx` — useEffect com cancelled, error handling, handleCreate com user guard
- `src/pages/admin/AdminTurmaDetail.tsx` — deduplicação via trainingUtils, mutations no pai

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅

---

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

---

### O que foi feito em 2026-06-06 (Claude Code)

**Task 38 — Fix "Unexpected Application Error!" em produção (commit `7535ce1`):**

**Root cause:** `createBrowserRouter` (React Router v6 data router API) tem um error boundary interno que captura erros de rota **antes** de propagá-los ao `ErrorBoundary` externo (class component). A lógica de reload em `ErrorBoundary.componentDidCatch` era completamente inacessível para falhas de carregamento de chunk — o router interceptava e exibia a tela padrão "Unexpected Application Error!" da React Router.

**Trigger:** Após novo deploy Vite (conteúdo com novos content-hash nos nomes dos chunks), usuários com o service worker PWA cacheando `index.html` antigo recebiam "Failed to fetch dynamically imported module" quando o browser tentava carregar chunks inexistentes. O React Router capturava esse erro internamente.

**Fix — `RouterErrorElement` em `src/App.tsx`:**
- Função componente `RouterErrorElement` usa `useRouteError()` (hook React Router) para acessar o erro capturado pelo router
- Detecta 5 padrões de chunk error: `Failed to fetch dynamically imported module`, `Importing a module script failed`, `Failed to load module script`, `Unable to preload CSS`, `error loading dynamically imported module`
- Chunk error → auto-reload uma vez; guard `sessionStorage` com chave `'arbo_chunk_reload'` evita loop infinito; exibe `<PageLoader />` enquanto aguarda reload
- Outros erros → tela amigável com mensagem e botão "Recarregar a página" (nunca tela em branco)
- Adicionado como `errorElement` em rota raiz wrapper (`path: undefined`) em `createBrowserRouter`

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅

**Task 39 — 5 Melhorias DeepSeek (Antigravity):**
1. **Segurança (RLS):** Políticas estritas (SELECT/INSERT/UPDATE) na tabela `messages` baseadas em `student_id` e role admin.
2. **Performance (`select('*')`):** Remoção de wildcard select em hooks (`useAdminAlunoDetail`, `useProgresso`, `useChat`, `useWeeklyPlan`, `useAdminTurmas`, `trainingUtils`), substituindo por colunas explícitas.
3. **Performance (`useAdminTurmaDetail`):** Substituição da cascata de requisições por 1 requisição única com Deep Joins otimizada.
4. **UX Premium (`ConfirmModal`):** Componente `<ConfirmModal />` criado para substituir `window.confirm` em `AdminTreinos.tsx`.
5. **PWA Avançado:** Configurado `runtimeCaching` no Workbox (NetworkFirst para API) e página de fallback `public/offline.html`.

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅

**Task 40 — Limpeza de Qualidade & Performance Pós-Task 39 (Antigravity):**
1. **Performance (`select('*')`):** 10 remoções simultâneas em 8 arquivos (`useProgresso`, `useWeeklyPlan`, `useAlunoPerfil`, `useAdminFeedbacks`, `useAdminPRs`, `AdminConvites`, `AdminTurmaDetail` e `AdminTreinos`), economizando banda.
2. **Performance (N+1 no changeGroup):** Erradicado recarregamento de DB em `useAdminAlunoDetail.ts`, operando agora estritamente com `allGroups` já cacheados na memória.
3. **Qualidade CSS (ConfirmModal):** Adequação para o design system (`var(--bg-surface)`, `var(--red-accent)`) + injeção de `--red-accent` oficial no `index.css` suportando light e dark mode fluídos.
4. **Resiliência PWA:** Removido rastros de `screenshots` não existentes do `vite.config.ts`, extirpando falsos `404` no browser.

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅

**Task 41 — Refatoração de Qualidade e Suporte Light Mode (Antigravity):**
1. **Performance (Select Wildcards Remanescentes):**
   - Substituição de seletor wildcard no [useAdminTreinos.ts](file://wsl.localhost/Ubuntu/home/max/arbo/src/hooks/useAdminTreinos.ts) `.select('*, tag:tags(*)')` por colunas explícitas.
   - Remoção de `.select()` sem argumentos (wildcard implícito) em insert/update no [useTreinoMutations.ts](file://wsl.localhost/Ubuntu/home/max/arbo/src/hooks/useTreinoMutations.ts).
2. **CSS Variables & Design System:**
   - Adicionadas variáveis CSS de suporte no [index.css](file://wsl.localhost/Ubuntu/home/max/arbo/src/index.css): `--orange-subtle`, `--orange-border`, `--red-subtle`, `--red-border`, `--blue-accent`, `--blue-subtle`, `--backdrop-bg` (para os temas Claro e Escuro).
   - Erradicação de 25+ cores hexadecimais/RGBA hardcoded em [AdminTurmaDetail.tsx](file://wsl.localhost/Ubuntu/home/max/arbo/src/pages/admin/AdminTurmaDetail.tsx).
   - Ajustes no [ConfirmModal.tsx](file://wsl.localhost/Ubuntu/home/max/arbo/src/components/ui/ConfirmModal.tsx): substituição de `#3b82f6` por `var(--blue-accent)`, hover do cancelar por `var(--bg-surface-hover)`, e backdrop por `var(--backdrop-bg)`.
3. **Melhorias de Light Mode:**
   - Varredura de hexadecimais em componentes estruturais e páginas chave ([ErrorBoundary.tsx](file://wsl.localhost/Ubuntu/home/max/arbo/src/components/ErrorBoundary.tsx), [ProtectedRoute.tsx](file://wsl.localhost/Ubuntu/home/max/arbo/src/components/ProtectedRoute.tsx), [App.tsx](file://wsl.localhost/Ubuntu/home/max/arbo/src/App.tsx) - PageLoader/RouterErrorElement, e [SetPassword.tsx](file://wsl.localhost/Ubuntu/home/max/arbo/src/pages/SetPassword.tsx)) para garantir transição suave e coerência com o tema claro.
4. **TypeScript e Tipagem:**
   - Otimizados os casts de relações aninhadas no [useAdminTurmaDetail.ts](file://wsl.localhost/Ubuntu/home/max/arbo/src/hooks/useAdminTurmaDetail.ts), introduzindo os tipos explícitos `DBGroupPlan` e `DBGroupPlanTraining` em vez de `as unknown as`.
   - Adicionada documentação detalhando o motivo do filtro de ciclo permanecer no lado do cliente.

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros, 0 warnings ✅ · `npm run build` ✅

**Task 42 — Correção de Micro-residuais de Qualidade (Antigravity):**
1. **Padronização de CSS & Sombra (index.css):**
   - Injetadas variáveis de sombra `--shadow-modal` e `--shadow-card` em `:root` (dark) e `[data-theme="light"]` (light), permitindo contrastes mais leves no tema claro.
2. **ErrorBoundary.tsx:**
   - Substituição de `#d14312` por `var(--orange)` no hover do botão de recarga (controlando o estado visual através de `opacity: 0.9` e `opacity: 1`).
   - Substituição da sombra de box shadow hardcoded por `var(--shadow-card)`.
3. **SetPassword.tsx:**
   - Correção de cor do texto de erro `#ff6b6b` em favor de `var(--red-accent)`.
4. **ConfirmModal.tsx:**
   - Substituição da string concat frágil `${getButtonColor()}15` por um mapa semântico `subtleMap` (`--red-subtle`, `--orange-subtle`, `--blue-subtle`) acoplado ao tipo do modal (`type`).
   - Substituição do box shadow fixado por `var(--shadow-modal)`.
5. **App.tsx:**
   - Adaptada a sombra do card de erro em `RouterErrorElement` para utilizar a variável global `var(--shadow-card)`.

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros, 0 warnings ✅ · `npm run build` ✅

---

### Notas Finais da Sessão 2026-06-06:
- **Nota final do projeto:** 7.9/10 (subiu de 6.9 para 7.9 na sessão)
- **Tasks 39-42 concluídas**
- **Meta:** chegar em 8.5+ de média geral nas próximas rodadas.
- **Próxima sessão planeada:**
  1. Migrar os estilos inline/CSS remanescentes para **CSS Modules**: `Login.css`, `AdminChatPanel.module.css`, `CreateGroupModal.tsx`, `EditGroupModal.tsx`, `AnamnesisForm.tsx`, `TreinoCard.tsx`, `AlunoDashboard.module.css`.
  2. Implementar filtro server-side no Deep Join do `useAdminTurmaDetail.ts` se possível, ou otimizar a estrutura de consultas.
  3. Adicionar cláusula `limit()` explícita em todas as consultas SQL/Supabase que não possuem paginação nativa.
  4. Executar auditoria de performance e PWA via Lighthouse para identificar oportunidades de otimização de velocidade e SEO.

### Task 43 (Migra��o CSS Vars e Performance Server-side)
- 7 arquivos CSS migrados para design system (Login, AdminChatPanel, CreateGroupModal, EditGroupModal, AnamnesisForm, TreinoCard, AlunoDashboard)
- Novas vari�veis: --purple-accent, --purple-subtle, --yellow-accent, --yellow-subtle
- useAdminTurmaDetail.ts � filtro server-side no Deep Join
- useAdminAlunos.ts � limit(200)
- useChat.ts � limit(100) com ordena��o correta
- AdminConvites.tsx � limit(100)

### Task 44 (Limpeza de hardcoded residuais)
- AdminConvites.tsx � #ff3b3011, #ff3b3044, #ff6b6b ? CSS vars
- AdminTurmas.tsx � #ff6b6b, #2e2e2e, #444 ? CSS vars
- AdminFeedbacks.tsx � #ff6b6b ? var(--red-accent)
- AdminAlunoDetail.tsx � 5 hardcoded substitu�dos por CSS vars

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

### Task 47 (Security Headers — Claude Code)
- `vercel.json` — bloco `headers` adicionado preservando `rewrites` (SPA fallback) existente
- `Content-Security-Policy`: `default-src 'self'`; `script-src 'self' 'unsafe-inline' 'unsafe-eval'`; `style-src` + Google Fonts; `img-src self data: blob:`; `connect-src` Supabase + Resend; `frame-ancestors 'none'`
- `X-Frame-Options: DENY` — proteção contra clickjacking
- `X-Content-Type-Options: nosniff` — impede MIME type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — limita vazamento de URL em cross-origin

**Notas finais da sessão 2026-06-06:**
- Segurança: 8.2/10
- Performance: 8.6/10
- Qualidade: 8.8/10
- UX/Bugs: 8.5/10
- Arquitetura: 8.0/10
- PWA/Mobile: 8.3/10
- **Média geral: 8.4/10** (subiu de 7.9 para 8.4 — meta 8.5+ próxima sessão)

**Próxima sessão:**
- Lighthouse audit (meta score 90+)
- SMTP externo (Resend ou AWS SES)
- CI/CD GitHub Actions
- Vitest — primeiros testes unitários
- README.md público


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


## Notas Finais (Sessão 2026-06-07)
**Média geral: 8.75/10**
- Segurança: 8.5/10 ✅
- Performance: 8.7/10
- Qualidade de código: 9.0/10 ✅
- UX / Bugs: 8.8/10
- Arquitetura: 8.3/10
- PWA / Mobile: 8.5/10 ✅

### Lighthouse Mobile:
- Performance: 96
- Accessibility: 89
- Best Practices: 100
- SEO: 100

### Próximas tarefas para chegar em 9.0+
1. Testes: expandir de 11 para 50+ testes (hooks, componentes, fluxos críticos)
2. Service layer — abstrair chamadas Supabase dos hooks para src/lib/api.ts
3. Acessibilidade 89 → 95+ (focus indicators, ARIA labels, screen reader)
4. Security scanning no CI (npm audit)
5. Push notifications (Web Push API)
6. Integração Strava via Edge Function + n8n
7. Sentry para monitoramento de erros em produção

---

### Task 55 (Modo Flexível de Turmas — Gemini implementou, Claude Code revisou)

**Contexto:** Turmas agora têm dois modos: `'fixo'` (plano semanal com dias fixos) e `'flexivel'` (aluno agenda o dia de cada treino).

**Schema Supabase (aplicado no dashboard):**
- Tabela `schedules`: `id uuid PK, student_id uuid FK profiles(id), group_plan_training_id uuid FK group_plan_trainings(id), scheduled_day_of_week smallint CHECK(scheduled_day_of_week >= 1 AND <= 6), checkin_id uuid FK checkins(id) NULL, completed_at timestamptz NULL, created_at timestamptz, updated_at timestamptz`
  - RLS habilitada, policies: aluno SELECT/INSERT/UPDATE próprios; admin SELECT todos do grupo
  - GRANT SELECT, INSERT, UPDATE, DELETE para `authenticated`
  - Índices: `schedules(student_id)`, `schedules(group_plan_training_id)`
- `groups.mode text NOT NULL DEFAULT 'fixo' CHECK (mode IN ('fixo', 'flexivel'))`
- `group_plan_trainings.day_of_week` agora nullable (`integer | null`) — NULL em modo flexível

**Tipos TypeScript:**
- `GroupMode = 'fixo' | 'flexivel'` (CRÍTICO: em português, corresponde ao CHECK do DB — era `'fixed'`/`'flexible'` e causaria rejeição silenciosa)
- `ScheduleStatus = 'pendente' | 'agendado' | 'concluido'`
- `Schedule = Database['public']['Tables']['schedules']['Row']` (alias do DB, não interface manual)
- `DayTraining.dayOfWeek: number | null` — null = flexível sem agendamento
- `DayTraining.scheduleId?: string` — preenchido no modo flexível

**Novos arquivos:**
- `src/hooks/useScheduling.ts` — `fetchSchedules`, `scheduleTraining`, `rescheduleTraining`, `deleteSchedule`; sem `any`, sem `window.confirm`, Supabase error via `.error` property
- `src/lib/scheduleUtils.ts` — `getScheduleStatus(schedule: unknown): 'pendente' | 'concluido' | 'agendado'`
- `src/test/scheduleUtils.test.ts` — 11 testes (total Vitest: 22)
- `src/components/aluno/DayPicker.tsx` + `DayPicker.module.css` — bottom sheet de seleção de dia
- `src/components/aluno/FlexibleTrainingCard.tsx` + module — card de treino com DayPicker integrado
- `src/components/admin/ProfessorStatusGrid.tsx` — grid alunos × treinos com badge de status (verde=concluído, laranja=agendado, cinza=pendente); `scheduleMap` com chave `${student_id}-${group_plan_training_id}`

**Arquivos modificados:**
- `src/hooks/useWeeklyPlan.ts` — bifurcação fixo/flexível; busca `groups.mode` em paralelo; fetch de schedules do aluno para modo flexível; `flatMap` para mapear `DayTraining` com `scheduleId`
- `src/hooks/useAdminTurmaDetail.ts` — `mode` adicionado ao SELECT de `groups`
- `src/components/aluno/CheckinSheet.tsx` — `planId: string | null`; captura `newCheckinId` no INSERT; atualiza `schedule.checkin_id + completed_at` atômicamente
- `src/pages/aluno/AlunoDashboard.tsx` — renderiza `FlexibleTrainingCard` para modo 'flexivel'; sort null-safe `(a.dayOfWeek ?? 99) - (b.dayOfWeek ?? 99)`; `handleScheduleUpdate` chama `rescheduleTraining` ou `scheduleTraining`; null guard em `DAY_NAMES[dayOfWeek]`; `plan.id` → `plan?.id ?? null`
- `src/pages/admin/AdminTurmaDetail.tsx` — tab "Status" (ProfessorStatusGrid) + tab "Treinos" (lista); modo flexível exibe lista simples sem grade por dia
- `src/components/admin/CreateGroupModal.tsx` + `EditGroupModal.tsx` — seletor modo fixo/flexível

**Correções críticas (Claude Code code review — 10 findings):**
1. `GroupMode = 'fixed' | 'flexible'` → `'fixo' | 'flexivel'` em 6 arquivos (12 ocorrências) — evitava rejeição silenciosa do CHECK constraint
2. `ProfessorStatusGrid` completamente reescrito — query correta, props `GroupTrainingEntry`, chave de scheduleMap correta
3. `useScheduling` completamente reescrito — sem JOIN inválido `training:trainings`, sem `as any`, Supabase `.error` pattern
4. `scheduleUtils.ts` — `any` → `unknown` com type guard
5. CSS modules: `var(--surface)` → `var(--bg-surface)`, `var(--border)` → `var(--border-default)`, `#22c55e` → `var(--green-accent)`, `rgba(34,197,94,0.15)` → `var(--green-subtle)`
6. `Student.full_name` → `string | null` (Supabase retorna nullable)
7. `WeeklyPlanTraining` import removido (não usado)
8. `.map().filter()` predicate → `.flatMap()` (TypeScript não estreita dentro de type predicates complexos)
9. `DAY_NAMES[null]` → null guard com fallback `'—'`
10. 9 erros de lint em 3 arquivos corrigidos (no-explicit-any, no-unused-vars)

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅ · `npm test` → 22 passed ✅

---

## Sessão 2026-06-13 (Task 61) — Eliminação definitiva de piscadas

### Problema
As abas Admin (Alunos, Turmas, Treinos) tinham piscadas visuais ao carregar. A Home funcionava perfeitamente — animação sutil de fade-in + slide-up nos cards.

### Causa raiz (descoberta após 7 iterações)
3 causas simultâneas:

1. **Troca de árvore DOM:** `{isLoading ? <p>Carregando...</p> : <Lista>}` causava unmount/remount completo. Supabase responde em ~50ms, interrompendo qualquer animação de skeleton.

2. **`startTransition` duplo:** hooks chamavam `startTransition` separado para `setData` e `setIsLoading`, criando transições React conflitantes com framer-motion no mount.

3. **Stagger de cards:** `staggerChildren: 0.06` × N cards criava cascata de opacidade que o olho percebia como flicker.

### Solução (7 commits)

| Commit | O quê |
|---|---|
| `3a23289` | Remove `navigateFallback`/`navigateFallbackDenylist` do workbox; `cacheId: 'arbo-v3'`; `startTransition` nos hooks |
| `72ce3a6` | Skeletons no lugar de "Carregando..." (tentativa 1 — não resolveu) |
| `957d98b` | Remove `initial="hidden"` do conteúdo real (tentativa 2 — não resolveu) |
| `0feb1c1` | `{isLoading ? null : <motion.div>}` — sem troca de árvore ✅ |
| `d06be91` | Script nuclear limpa SWs antigos + `cacheId: 'arbo-v4'` |
| `da899f4` | `sessionStorage` → `localStorage` (bug: reload infinito no iOS PWA) |
| `2242f27` | **Remove `startTransition`** dos 3 hooks (React 18 já bateia) |
| `7267609` | **Remove stagger** — container anima inteiro (`y:16→0, 0.35s, easeOut`); itens são HTML puro (`<button>`/`<div>`) |

### Arquitetura final

```
isLoading === true  →  null (não renderiza nada)
isLoading === false →  <motion.div
                         initial={{ opacity: 0, y: 16 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ duration: 0.35, ease: 'easeOut' }}
                       >
                         {items.map(item => <ItemHTMLPuro />)}
                       </motion.div>
```

- **Container:** animação única (fade-in + slide-up), igual AdminHome
- **Itens:** elementos HTML puros — sem `motion.*`, sem variants, sem stagger
- **Hooks:** `setState` direto, sem `startTransition`
- **SW:** `cacheId: 'arbo-v4'`, script de limpeza 1× com `localStorage`

### Lições aprendidas
- `startTransition` não é inócuo — com framer-motion pode causar conflitos de render
- Stagger em listas com muitos itens parece flicker, não animação
- `isLoading ? null : <Content />` é melhor que `isLoading ? <Skeleton /> : <Content />` quando os dados chegam rápido
- `sessionStorage` não persiste em PWA standalone no iOS — usar `localStorage` para flags únicas
- Problemas visuais de "piscada" geralmente são unmount/remount, não performance

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅


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

### Sessão 2026-07-02 (Correções Críticas no Painel do Aluno)
- **Chat Layout:** Corrigido o `padding-bottom` do `.inputArea` no chat (`AlunoChat.module.css`). Ajustado de `76px` para `110px`, seguindo o mesmo recuo do contêiner principal para evitar que o ícone de envio seja cortado pelo `<BottomNav>` ou em telas com safe-area complexa.
- **Lógica de Treinos Trancados:** Refatorado `useWeeklyPlan.ts`. O plano individual (override) agora é consultado **antes** do plano da turma. Isso garante que se um admin alocou um plano diretamente para o aluno (exceção), o sistema ignora a trava (`isLocked: true`) que estaria ativa baseada no `released_through_week` do plano da turma.
- **Modo Flexível (Dia da Semana Null):** Corrigido o fallback do dia da semana (`dayOfWeek`) no modo flexível. Quando não agendado, agora retorna estritamente `null`, evitando herdar o slot original invisível configurado pelo admin, preservando a lógica de lista do componente `FlexibleTrainingCard`.
- **Validação:** Rodado `tsc --noEmit` e `vite build` sem erros para garantir 100% de confiabilidade.

### Sessão 2026-07-02 (Follow-up — Causa Raiz Real dos Bugs do Aluno)

A sessão anterior (Gemini) tinha corrigido a *comparação* de liberação de semana (`weekNumber <= released_through_week`) e mexido no CSS do chat, mas o app continuou quebrado em produção: chat sem área de digitar, e semanas liberadas pelo admin não apareciam pro aluno. Esta sessão investigou o código real e o banco de dados diretamente (via MCP Supabase) em vez de assumir que o fix anterior estava correto.

**Bug 1 — Chat sem área de digitar (regressão de CSS):**
O commit anterior trocou `padding: 16px 24px calc(76px + safe-area)` do `.inputArea` (`AlunoChat.module.css`) por `calc(16px + safe-area)`. Como o `<BottomNav>` do `AlunoDashboard` é `position: fixed` (sobreposto, fora do fluxo do flexbox), remover essa folga fez o formulário de envio ficar posicionado exatamente atrás da barra fixa — visível no código, mas inacessível na tela. Restaurado o padding original de 76px.

**Bug 2 — "Semanas liberadas" não refletiam no aluno (causa raiz real, não era a comparação):**
A lógica `targetWeekNumber > releasedThrough` (bloqueado) / `n <= releasedThroughWeek` (liberado) em `useWeeklyPlan.ts` e `LockedScreen.tsx` já estava correta. O sintoma persistia porque **a fonte do dado estava errada**, não a comparação:

1. Consultado o Supabase diretamente (`groups`, `group_plans`) e descoberto que a turma do aluno de teste (`Turma 5K Manhã`) tinha `groups.starts_at = NULL`.
2. Sem uma âncora fixa, o cálculo de ciclo (`origin = groupData.starts_at ?? todayMonday` no aluno, `?? toDateString(new Date())` no admin) recalculava a partir de "hoje" — uma referência que muda todo dia e diverge entre admin e aluno.
3. Isso fez o fluxo de criação de plano (`ensureGroupPlan`, que dá match exato em `starts_at`) criar um **novo `group_plans` a cada sessão do admin em dia diferente**, em vez de reaproveitar o existente. Resultado: 5 registros de plano para a mesma turma (`05-30`, `06-04`, `06-28`, `06-30`, `07-02`), cada um com seu próprio `released_through_week`.
4. A query do aluno (correção anterior) buscava por uma janela de 7 dias e pegava o registro `.order('starts_at', { ascending: false }).limit(1)` — ou seja, o **mais recente** dentro da janela. Quando dois planos caíam na mesma janela (`2026-06-30`, liberado até semana 4, e `2026-07-02`, liberado só até semana 1 — criado num teste posterior), o aluno sempre recebia o mais novo e "errado".

**Correção aplicada:**
- `useWeeklyPlan.ts`: `order('starts_at', { ascending: true })` — pega o primeiro plano da janela do ciclo, não o mais recente, coerente com o fato de `ensureGroupPlan` sempre dar match exato no início do ciclo.
- SQL direto no Supabase: `UPDATE groups SET starts_at = ...` para as 2 turmas afetadas (`Turma 5K Manhã` → `2026-06-30`, alinhado ao plano já liberado até semana 4; `Rumo aos 10 k` → `2026-07-02`, sem aluno vinculado ainda mas corrigido preventivamente).
- `CreateGroupModal.tsx`: campo "Início" deixou de ser opcional — vem pré-preenchido com a data de hoje e é `required` no submit, prevenindo que turmas novas nasçam com `starts_at NULL`.

**Lição:** um bug de "condição errada" reportado pelo usuário pode já estar corrigido no código e o sintoma continuar idêntico — a causa real pode estar numa camada abaixo (qual linha do banco está sendo lida), não na lógica que a manipula. Necessário consultar o banco diretamente para confirmar a hipótese antes de aplicar mais um fix cego na mesma função.

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅ · commits `d0e29d1` e `82dad4b` em `master`.

### Sessão 2026-07-02 (Follow-up 2 — Modo Flexível sem Liberação de Semana)

Usuário testou no celular após o fix anterior e reportou dois pontos: o chat ainda precisava "subir mais um pouco", e turmas em modo flexível continuavam com tudo bloqueado mesmo o professor tentando liberar.

**Chat:** o padding restaurado na sessão anterior (`76px`) era o valor histórico antigo. O resto do app (`AlunoDashboard.module.css .container`) usa `110px` de folga acima do `BottomNav` fixed. Alinhado o `.inputArea` do chat pro mesmo valor, por consistência.

**Modo flexível bloqueado — causa raiz real:**
Leitura direta de `AdminTurmaDetail.tsx` mostrou que o componente bifurca em dois branches JSX totalmente separados por `group.mode`:
- `mode === 'fixo'` → renderiza `WeekView`, que tem os chips S1–S4 de liberar semana (`onChipRelease`/`onRelease`, ligados a `handleChipClick`/`releaseThrough`).
- `mode === 'flexivel'` → renderiza uma lista plana de treinos com só um botão "+ Adicionar Treino". **Nenhum controle de liberação existia nesse branch.**

Ou seja, `released_through_week` para turmas flexíveis só podia ser alterado manualmente no banco — a feature nunca foi implementada quando o modo flexível foi criado (Task 55). Isso não era um bug de lógica invertida como os anteriores: era ausência total de feature num dos dois branches.

Investigação revelou um segundo problema na mesma área: o botão "+ Adicionar Treino" do modo flexível chamava `openSlot(1, 1)` fixo — todo treino novo ia pra Semana 1, sem exceção. Mesmo se o professor liberasse S2–S4 (via SQL direto, contornando o bug acima), não havia como colocar conteúdo nelas pela UI.

**Correção:**
- Chips S1–S4 adicionados ao branch flexível, reaproveitando `handleChipClick`/`releasing`/`plan?.released_through_week` — mesmo toggle bidirecional já usado no modo fixo, zero lógica nova.
- Lista de treinos do modo flexível reestruturada: agrupada por `weekNumber` (1 a 4), cada seção com seu próprio "+ Adicionar Treino · Semana N" chamando `openSlot(w, 1)`.

**Lição:** nem todo sintoma parecido ("aluno vê tudo bloqueado") tem a mesma causa. Na sessão anterior era dado errado sendo lido; nesta, era feature nunca implementada num dos dois branches de um componente bifurcado. Vale sempre conferir se os dois caminhos de um `if`/ternário condicional por `mode` têm paridade de funcionalidade, não só de layout.

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅ · commit `9535055` em `master`. Documentado como Caso 6 em `docs/PORTFOLIO_DEBUG_CASES.md` (commit `f06b5bc`).

### Sessão 2026-07-03 (Integração Strava — OAuth + Edge Functions)

Pedido: implementar OAuth do Strava com SQL de criação de `strava_connections`, 3 Edge Functions (`strava-auth`, `strava-callback`, `strava-sync`) e UI no `AlunoPerfil`.

**Verificação antes de escrever qualquer código:** em vez de assumir que o SQL pedido estava correto, consultado o banco ao vivo via MCP Supabase (`pg_policies`, `information_schema.role_table_grants`, `pg_constraint`, `information_schema.columns`) para o projeto `jhfkflnixzivuichmkie`. Resultado:
- `strava_connections` e `strava_activities` **já existiam**, com colunas `user_id`/`token_expires_at` — não `student_id`/`expires_at` como o pedido original assumia. Um `CREATE TABLE IF NOT EXISTS` seria um no-op silencioso, e a policy seguinte (`student_id = auth.uid()`) quebraria por coluna inexistente.
- `strava_connections` já estava com RLS ativo, **zero policies**, e GRANT para `authenticated` só `REFERENCES/TRIGGER/TRUNCATE` (nem SELECT) — bloqueio total pro cliente, documentado no CLAUDE.md como decisão intencional ("acesso exclusivo por Edge Functions com `service_role`").
- O SQL pedido (`GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + policies de self-management) reverteria essa trava e exporia `access_token`/`refresh_token` do Strava direto ao cliente, além de permitir ao próprio usuário forjar sua conexão via INSERT/UPDATE direto.

**Decisão:** nenhuma alteração de schema/RLS/GRANT foi aplicada. Toda leitura/escrita em `strava_connections` passa por Edge Functions com `service_role`, sempre filtrando explicitamente por `user.id` (nunca confiando só no bypass de RLS do `service_role` para isolar dados entre alunos — princípio aplicado em `strava-sync` e `strava-connection`).

**4 Edge Functions, não 3:** como `strava_connections` está travada pro cliente, o hook do frontend não teria como saber se o aluno está conectado nem desconectá-lo sem violar essa trava. Adicionada `strava-connection` (GET = status via `{ isConnected, athleteId, connectedAt }`, nunca os tokens; DELETE = desconectar) além das 3 pedidas.

**strava-auth:** monta a URL de autorização (`STRAVA_CLIENT_ID` + `SITE_URL` de `Deno.env`) e responde com `Response.redirect(url, 302)`. Chamada via `window.location.href` (navegação de página inteira, não `fetch`) — por isso não valida JWT nem tem CORS: a identidade do aluno só é resolvida depois, no `strava-callback`, através do `Authorization` header daquela chamada (essa sim via `fetch`, autenticada).

**strava-callback:** valida JWT (`userClient.auth.getUser(token)`), troca `code` por tokens em `POST https://www.strava.com/oauth/token`, grava com `service_role` via `upsert({ user_id: user.id, ... }, { onConflict: 'user_id' })` — a constraint `UNIQUE(user_id)` já existia na tabela.

**strava-sync:** busca a conexão do próprio usuário, renova o `access_token` via `grant_type=refresh_token` se `token_expires_at` já passou, busca até 30 atividades recentes (`per_page=30`, já que a API do Strava não filtra por tipo), filtra as últimas 10 do tipo `Run`, e grava em `strava_activities` via `upsert(..., { onConflict: 'strava_id' })` (a coluna já tem `UNIQUE`).

**Frontend:**
- `useStravaConnection.ts` — único ponto de contato do app com o Strava; só faz `fetch` contra as Edge Functions com o JWT da sessão atual, nunca `supabase.from('strava_connections')`.
- `StravaCallback.tsx` (rota pública `/strava/callback`, fora do `ProtectedRoute`) — proteção CSRF: `state` é um `crypto.randomUUID()` gerado no clique de "Conectar" (guardado em `sessionStorage`), comparado contra o `state` que o Strava devolve na URL de retorno antes de prosseguir com a troca de código.
- `AlunoPerfil.tsx` — placeholder "Em breve" substituído por card funcional: status real, Conectar/Desconectar (`ConfirmModal`, nunca `window.confirm`), "Sincronizar atividades" com spinner, lista das últimas atividades (nome, km, pace, data).
- `AlunoDashboard.tsx` — trata o retorno `?strava=success` da URL: muda pra aba Perfil, mostra toast de sucesso, limpa a query string via `setSearchParams({}, { replace: true })`.
- `useAlunoPerfil.ts` — campo `strava_connected` (placeholder hardcoded em `false`, sem consumidor após a troca) removido.

**Lição de processo:** pedidos de infraestrutura que incluem SQL pronto para copiar/colar merecem verificação contra o estado real do banco antes de aplicar — especialmente quando o SQL cria policies/grants que abrem acesso. Neste caso a verificação evitou tanto um erro de sintaxe (coluna inexistente) quanto uma regressão de segurança real (exposição de tokens OAuth).

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ (após ajustar o `useEffect` de `AlunoDashboard.tsx` para rodar o `setState` dentro de uma função `async` interna, mesmo padrão já usado nos hooks do projeto, e não passar no `react-hooks/set-state-in-effect`) · `npm run build` ✅ · commit `325c876` em `master`.

### Sessão 2026-07-04 (Deploy Strava + Bug de GRANT ausente no `service_role`)

Após o deploy das 4 Edge Functions (`strava-auth`, `strava-callback`, `strava-sync`, `strava-connection` via `npx supabase functions deploy ... --project-ref jhfkflnixzivuichmkie`), o usuário reportou erro `"Erro ao salvar conexão com o Strava"` ao voltar do OAuth do Strava.

**Achado 1 (deploy):** todas as 4 functions subiram com `verify_jwt: true` por padrão do CLI — o que quebra `strava-auth`, já que ela é invocada por navegação direta do navegador (`window.location.href`), sem header `Authorization`. Corrigido com redeploy `--no-verify-jwt` só nessa function. Confirmado via `list_edge_functions`: `strava-auth` v2 (`verify_jwt: false`), as outras 3 em v1 (`verify_jwt: true`, como deveria ser — chamadas via `fetch` com JWT).

**Achado 2 (causa raiz do erro reportado):** investigação de logs mostrou que `strava-connection` também falhava com 500 em **100%** das chamadas, mesmo sendo a function mais simples das 4 (só um `.select()`). Tentativas de capturar o `console.error()` real via MCP `get_logs`, CLI (`supabase functions logs` — **não existe** como subcomando nesta versão do CLI) e Management API direta (`function_logs`/`edge_logs`) só retornaram logs de gateway e eventos de ciclo de vida (`shutdown`), sem o texto do erro — provável atraso de ingestão do Logflare. O usuário conferiu direto no Dashboard e trouxe o erro real: `"permission denied for table strava_connections"`.

**Verificação do código antes de aceitar a hipótese inicial** (de que o `adminClient` estaria usando a `anon key` por engano): grep nas 3 functions confirmou que todas já criavam `adminClient` corretamente com `SUPABASE_SERVICE_ROLE_KEY`, nunca com a anon key — a hipótese do usuário não batia com o código real.

**Causa raiz real, confirmada via SQL ao vivo:**
```sql
-- service_role tinha só isso em strava_connections (sem SELECT/INSERT/UPDATE/DELETE):
service_role → REFERENCES, TRIGGER, TRUNCATE
-- e rolbypassrls = true, rolsuper = false
```
`BYPASSRLS` só pula a checagem de *policy* (linha por linha) — é uma camada totalmente separada do GRANT de tabela no Postgres. Sem `GRANT SELECT, INSERT, UPDATE, DELETE ON strava_connections TO service_role`, mesmo o client correto com a service role key certa esbarra em "permission denied", porque a checagem de GRANT acontece **antes** da checagem de RLS e não tem exceção pra `BYPASSRLS`.

**Correção:** `GRANT SELECT, INSERT, UPDATE, DELETE ON strava_connections TO service_role;` aplicado manualmente pelo usuário no SQL Editor do Supabase. Resolveu o erro. `authenticated`/`anon` continuam sem nenhum GRANT de CRUD na tabela — a trava de segurança original não foi alterada, só a permissão que faltava pro `service_role`.

**Lição registrada em `GEMINI_LESSONS.md` (item 13):** ao criar uma tabela pensada pra ser acessada só via `service_role` (sem policies de RLS), é preciso GRANT explícito pro `service_role` também — não é automático, mesmo ele tendo `BYPASSRLS`. Verificar sempre com `information_schema.role_table_grants` antes de assumir que "o código usa a key certa" resolve um erro de permissão.

**Status:** Integração Strava ✅ totalmente funcional em produção — OAuth, sincronização de atividades e desconexão testados e operando corretamente após o GRANT.

### Sessão 2026-07-04 (Task 68 — Strava Fase 2, Upload de Vídeo R2 e Agente DeepSeek)

Três entregas na mesma sessão, cada uma validada (`tsc --noEmit`, `npm run lint`, `npm run build` — 0 erros) e deployada antes de passar para a próxima.

**1) Strava Fase 2 — card profissional + painel admin**

- **Fix (atividades sumindo ao recarregar):** `checkStatus()` só populava `isConnected`, nunca `activities` — a lista existia só em memória e sumia a cada reload até o aluno clicar manualmente em "Sincronizar". Corrigido em `useStravaConnection.ts`: extraída `fetchActivities()` reutilizável, e o `useEffect` de mount agora chama `checkStatus()` e, se `isConnected === true`, dispara `fetchActivities()` automaticamente. Novo estado `isLoadingActivities` isolado de `isSyncing` (loading automático do mount ≠ loading do botão manual).
- **Card profissional no `AlunoPerfil.tsx`:** header com ícone + badge de status (verde "Conectado"/cinza "Desconectado") + "Desde [data]" (usa `connectedAt`, que a Edge Function já retornava mas o hook descartava). Lista de atividades com ícone `Footprints`, data PT-BR sem sufixo "-feira" (ex: "Segunda, 30 jun"), distância/pace/duração, máximo 5 + "Ver mais". Botão "Desconectar" discreto (texto vermelho) separado do botão de sync.
- **Painel admin (`AdminAlunoDetail.tsx`):** nova seção "Atividades Strava". `strava-sync` v2 aceita corpo opcional `{ studentId }` — exige `role=admin` no JWT do chamador (403 caso contrário) e troca `user.id` por `targetUserId` nas 3 operações (leitura de conexão, refresh de token, upsert de atividades). Hook novo `useAdminStravaActivities.ts` expõe `notConnected` (derivado da mensagem 404 `"Nenhuma conexão com o Strava encontrada."`) para diferenciar "aluno nunca conectou" de falha de rede.
- **Nota de arquitetura:** o pedido previa "admin só acessa alunos da sua turma", mas o app não tem esse conceito — é modelo de professor único, `/admin/*` já é global por `role=admin`. Implementada checagem por role, consistente com o resto do painel.
- Deploy `strava-sync` v2 via MCP Supabase (`verify_jwt: true` mantido) — CLI local seguia sem login.

**2) Upload de Vídeo — Cloudflare R2**

- Bucket `arbo-videos` criado no R2 (10GB grátis), domínio público `videos.mxos.com.br` configurado e ativo.
- **Desvio de arquitetura documentado:** o pedido original previa a Edge Function `r2-upload` recebendo o arquivo via `multipart/form-data` e proxiando os bytes até o R2. Trocado por **presigned URL** (SigV4 via `aws4fetch`, `region: 'auto'`) — o browser faz o `PUT` direto no R2. Motivo: Edge Functions (Deno Deploy) têm limites de memória/tempo incompatíveis com proxiar até 500MB; é também o padrão que a própria Cloudflare recomenda para upload de arquivos grandes do browser. Credenciais nunca saem do servidor.
- `r2-upload/index.ts`: valida JWT + `role=admin`, valida `contentType`/`fileSize` (≤500MB), sanitiza `filename`/`trainingId` (remove acentos, previne path traversal), retorna `{ uploadUrl, publicUrl, key }` para `videos/{trainingId}/{filename}`.
- `TreinoFormPanel.tsx`: toggle "Link YouTube"/"Upload de vídeo", dropzone com progresso via `XMLHttpRequest` (`fetch` não expõe progresso de upload), preview do nome + botão remover. Para treino ainda não salvo (sem `id`), usa `crypto.randomUUID()` como pasta temporária no R2 — decisão pragmática documentada.
- `VideoPlayer.tsx`: detecta `videos.mxos.com.br` → `<video>` nativo (MIME inferido pela extensão: mp4/webm/mov); YouTube → iframe como antes.
- `vercel.json`: CSP atualizada — `media-src` para tocar o vídeo, `connect-src https://*.r2.cloudflarestorage.com` para o PUT direto do browser (sem isso ambos seriam bloqueados pelo navegador).
- **Pendências fora do meu acesso:** configurar CORS no bucket R2 (Cloudflare Dashboard) permitindo `PUT` das origens do app; teste ponta a ponta com vídeo real. Exclusão do objeto no R2 ao remover vídeo não implementada (só limpa `video_url`, igual ao YouTube) — fora do escopo pedido.

**3) Agente DeepSeek — análise automática de atividades Strava**

- Tabela `strava_analysis` (`student_id`, `activity_id` bigint, `activity_name`, `distance_m` integer, `moving_time_seconds`, `average_speed`, `summary`/`analysis`/`tip` text, `UNIQUE(student_id, activity_id)`), RLS com policy única `student_id = auth.uid() OR private.is_admin()` — mesmo helper usado em `profiles`/`anamnesis`, nunca reimplementado com subquery em `profiles`.
- **Bug pego na revisão do SQL antes de aplicar (não incidente em produção):** o rascunho original tinha as `CREATE POLICY` corretas mas faltava `GRANT SELECT ON strava_analysis TO authenticated`. RLS não substitui GRANT — são camadas separadas no Postgres, exatamente a mesma classe do incidente da sessão anterior com `strava_connections`/`service_role` (acima). Sem essa linha, tanto aluno quanto admin receberiam `permission denied` (42501) mesmo com as policies certas. Corrigido e apresentado para aprovação antes de aplicar — só depois de "SQL aplicado" + `DEEPSEEK_API_KEY` confirmada é que a function foi deployada e o código commitado. Lição registrada em `GEMINI_LESSONS.md` item 14.
- `strava-analyze/index.ts`: recebe `{ activity }` no formato já usado pelo app (`StravaActivitySummary` — não os campos brutos do Strava), calcula `distance_m`/`moving_time_seconds`/`average_speed` server-side, checa se já existe análise para `(student_id, activity_id)` antes de gastar uma chamada de API, chama `https://api.deepseek.com/chat/completions` (`deepseek-chat`) com prompt fixo em PT-BR pedindo JSON com `summary`/`analysis`/`tip`, faz parsing defensivo (remove ```json fences que o modelo às vezes inclui mesmo instruído a não usar markdown) e grava via `upsert(..., { onConflict: 'student_id,activity_id' })`.
- `useStravaConnection.ts`: após `fetchActivities()` (mount automático ou "Sincronizar" manual), dispara análise da atividade mais recente em paralelo sem bloquear a lista (`latestAnalysis`, `isAnalyzing`).
- `useAdminStravaActivities.ts`: leitura direta de `strava_analysis` via RLS admin (`latestAnalysis`).
- Card "Análise do seu último treino" (`AlunoPerfil.tsx`) e "Última análise automática" (`AdminAlunoDetail.tsx`) — borda esquerda laranja, ícones lucide (`Bot`, `BarChart3`, `Lightbulb`, `Target`).
- Depois do SQL aplicado: `database.types.ts` regenerado via MCP Supabase (`generate_typescript_types`, CLI local sem login) e removido o cast `as any` temporário que existia em `useAdminStravaActivities.ts` enquanto a tabela não estava nos tipos gerados.
- **Incidente evitado durante a regeneração de tipos:** `npx supabase gen types ... > database.types.ts` falhou por falta de login no CLI, e o redirect (`2>&1`) sobrescreveu o arquivo inteiro (1032 linhas) com a mensagem de erro antes de eu notar. Recuperado na hora com `git checkout -- src/lib/database.types.ts` — nada tinha sido commitado ainda, zero perda. Lição: `2>&1 > arquivo` é perigoso quando o comando pode falhar; preferir rodar sem redirect primeiro ou usar a tool MCP equivalente quando disponível.
- Testado e funcionando em produção com dados reais.

**Credenciais configuradas nesta sessão (Vercel + Supabase Secrets):** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `DEEPSEEK_API_KEY`.

**Caso de portfólio:** 7º estudo de caso adicionado em `docs/PORTFOLIO_DEBUG_CASES.md` — GRANT `authenticated` ausente identificado preventivamente na revisão do SQL, antes de aplicar, com base no padrão do incidente anterior.

**Status:** Strava Fase 2 ✅ · Upload de Vídeo R2 ✅ (pendente CORS no bucket) · Agente DeepSeek ✅ em produção.

### Sessão 2026-07-09 (Biblioteca de treinos dinâmica + fixes de dropdown)

**Contexto:** `/admin/treinos` tinha 4 pills fixas de programa (`Todos`/`Do Zero aos 5km`/`Aperfeiçoando os 5km`/`Rumo aos 10km`), hardcoded em `PROGRAM_OPTIONS`. Não escalava — cada nova biblioteca do professor exigiria código novo.

**Schema:** tabela `training_programs` criada (`id uuid PK`, `name text NOT NULL`, `slug text NOT NULL` único, `description text` nullable, `color text NOT NULL DEFAULT 'orange'` com `CHECK IN ('orange','green','yellow','red')`, `created_by uuid`, `created_at`/`updated_at timestamptz`). RLS com duas policies — `"Admins gerenciam programas"` (`FOR ALL`, `private.is_admin()` — mesmo helper de `strava_analysis`, nunca subquery em `profiles`) e `"Todos autenticados leem programas"` (`FOR SELECT`, `true`). `GRANT SELECT, INSERT, UPDATE, DELETE` completo — não só `SELECT` — porque a policy é `FOR ALL`; faltar o grant de escrita teria reproduzido o mesmo bug de GRANT incompleto das Tasks 67/68. 3 programas existentes migrados como seed (`do_zero_5k`/verde, `aperfeicoando_5k`/amarelo, `rumo_10k`/laranja). `trainings.program` continua `text` livre, **sem FK** — casamento com `training_programs.slug` feito inteiramente no frontend (confirmado por grep: nenhuma `FOREIGN KEY` referenciando `training_programs` em `trainings`).

**Frontend:**
- `src/hooks/useTrainingPrograms.ts` (novo) — hook único (lista + `createProgram`/`deleteProgram`/`updateProgramName`), separado do par `useAdminTreinos`/`useTreinoMutations` por o volume de dados ser pequeno. `createProgram` gera o `slug` no client (normaliza acentos, minúsculas, `_` no lugar de espaço).
- `src/components/admin/NewProgramModal.tsx` (novo) — modal "Nova Biblioteca"/"Nova pasta" com nome, descrição e color picker de 4 cores, mesmo chrome do `ConfirmModal`/`TreinoFormPanel`.
- `src/pages/admin/AdminTreinos.tsx` — pills fixas trocadas por dropdown "Biblioteca de Treinos"; seção "Gerenciar Etiquetas e Tipos" virou "Gerenciar Etiquetas, Tipos e Bibliotecas" com 3ª coluna para excluir bibliotecas (`<ConfirmModal />`) — excluir uma biblioteca não apaga os treinos que a usam, eles só perdem a badge/filtro (`program` fica órfão, sem cascade).
- `src/components/admin/TreinoCard.tsx` — badge de programa passa a receber o objeto `TrainingProgram` já resolvido via prop (pai monta `Map<slug, TrainingProgram>`).
- `src/components/admin/TreinoFormPanel.tsx` — novo `<select>` "Biblioteca" (`Nenhuma biblioteca` + lista dinâmica); `program` passa a ser enviado no payload de criação/edição (antes não era enviado).
- `src/lib/trainingUtils.ts` — `PROGRAM_OPTIONS/LABELS/COLORS/BG_COLORS/BORDER_COLORS` (slug-keyed, hardcoded) removidos; substituídos por `PROGRAM_COLOR_OPTIONS`/`PROGRAM_COLOR_LABELS`/`PROGRAM_COLOR_VAR_MAP` (as 4 cores genéricas → trio de CSS vars).

**48 treinos em 3 programas (mesma sessão):** duas colunas novas em `trainings` — `category text` (método: intervalado, fartlek, contínuo, progressivo, pirâmide, regenerativo, teste, ritmo) e `program text`, mais índices `idx_trainings_program`/`idx_trainings_category`. Conteúdo extraído de 3 arquivos Word do professor (`DO ZERO AOS 5 KM.docx`, `APERFEIÇOANDO OS 5 KM.docx`, `RUMO AOS 10 KM.docx`) via `python-docx` + regex, convertido em SQL revisado antes de aplicar. `/admin/treinos` ganhou também um dropdown de filtro por categoria, usando o mesmo componente `FilterDropdown`.

**4 commits de fix visual/comportamental no dropdown (mesma sessão, iterativos):**
1. `01a7dae` — extraído o dropdown hand-rolled (com `useRef` + `mousedown` outside-click próprio em `AdminTreinos.tsx`) para um componente reutilizável `FilterDropdown.tsx`, usado tanto pelo filtro de Biblioteca quanto pelo de Categoria.
2. `260adde` — redesign visual: os dois dropdowns lado a lado (`flex: 0 0 auto` em vez de `flex: 1 1 200px`), trigger com fundo laranja sólido e texto branco (`var(--text-on-brand)`) em vez do estilo outline anterior.
3. `75a602b` — corrigido corte visual da borda laranja: container pai ganhou `overflowX: 'hidden'` + `padding: '0 16px'` no lugar de `overflowX: 'auto'`, que cortava o anel de foco/hover do dropdown ao rolar horizontalmente no mobile.
4. `ae53308` — fix definitivo do corte no mobile (ver Caso 8 em `docs/PORTFOLIO_DEBUG_CASES.md`): o painel do dropdown (`position: absolute`) ainda era clipado por um ancestral com `overflow` restrito. Resolvido renderizando o painel via `createPortal` direto no `document.body` com `position: fixed`, posição calculada em `getBoundingClientRect()` do gatilho e detecção de colisão com a borda direita da viewport.

**Validação (todos os commits):** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅.

### Sessão 2026-07-10 (Navegação por pastas na Turma + Exclusão permanente de turma)

**Navegação por pastas no seletor de treinos da Turma (`6e8f5f4`):** o painel lateral de adicionar treino em `AdminTurmaDetail.tsx` (`SidePanel`) antes mostrava duas listas fixas — "Usados neste ciclo" e "Outros treinos" — misturando todos os treinos de todas as bibliotecas. Reestruturado para navegação em dois níveis, reaproveitando `training_programs` (mesma tabela da sessão de 09/07, chamada de "pasta" na UI do professor):
- Nível 1 (raiz): lista de pastas (`allPrograms`, com dot colorido por `PROGRAM_COLOR_VAR_MAP`); busca filtra por nome da pasta.
- Nível 2 (dentro de uma pasta): `programTrainings = allTrainings.filter(t => t.program === selectedProgram)`; botão "← Pastas" volta ao nível 1; busca filtra por título do treino.
- Botão "Gerenciar Pastas" no rodapé do nível 1 abre o novo `ManageProgramsModal.tsx` — criar pasta (reaproveita `NewProgramModal`), renomear pasta (`Pencil` + `onUpdateProgramName`), e mover um treino existente entre pastas (dois `<select>` — treino de origem e pasta de destino — chamando `updateTraining({ id, program: newSlug })` via `useTreinoMutations`).
- **Gap observado (não corrigido nesta sessão):** treinos com `program = NULL` (sem pasta) não aparecem em nenhum lugar da navegação por pastas — a lista de nível 1 itera só `allPrograms`, sem uma entrada sintética "sem pasta"/"treinos gerais", e o dropdown "Mover para" do `ManageProgramsModal` também só lista pastas reais, sem opção de tirar um treino de uma pasta. Um treino órfão só é alcançável hoje editando-o diretamente em `/admin/treinos` (fora do contexto da turma). Vale endereçar numa próxima sessão se o professor sentir falta.

**Exclusão permanente de turma (`0ef531c`):** seção "Zona de Perigo" adicionada ao final de `AdminTurmaDetail.tsx` — hard delete real via `supabase.from('groups').delete().eq('id', targetGroupId)` (novo `deleteGroup()` em `useGroupPlanMutations.ts`), **sem Edge Function** — a policy `admin_all_groups` (`FOR ALL`, `private.is_admin()`) já cobre `DELETE` para o admin autenticado, diferente da exclusão de aluno (Task 34) que precisa de `service_role` porque mexe em `auth.users`. Cascade do banco cuida do resto: `group_plans`/`group_plan_trainings`/`schedules` dependentes são removidos, e `profiles.group_id` (FK `ON DELETE SET NULL`) vira `NULL` para os alunos matriculados — eles não são excluídos, só ficam "SEM TURMA" (mesmo badge do filtro da Task 62). Confirmação por digitação exata do nome da turma (`deleteConfirmText !== group.name` bloqueia o botão), modal inline no mesmo padrão visual do `ConfirmModal` (não reaproveitado diretamente porque exige o campo de texto extra).

**Validação (ambos os commits):** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅.

### Sessão 2026-07-11 (Auditoria e correção de Performance/Confiabilidade — 4 etapas)

**Contexto:** usuário relatou que abas do app às vezes demoravam a carregar ou apareciam com informação faltando, normalizando ao trocar de aba e voltar. Sessão dividida em diagnóstico (sem código) seguido de 4 commits independentes, cada um validado (`tsc --noEmit`, `npm run lint`, `npm run build`) e enviado antes do próximo.

**Diagnóstico:** Hipótese de corrida entre sessão de auth e fetch de dados foi descartada (`ProtectedRoute` já bloqueia render até `isLoading` do `AuthContext` resolver; nenhum listener de `visibilitychange`/`focus` existe no código — o "conserta ao voltar de aba" vem de remount das abas do aluno, que são `useState` local, não de refetch). A causa real combinava três fatores: cache do service worker mascarando falha de rede como dado válido (ver Caso 9), 3 queries em `useWeeklyPlan.ts` que descartavam o campo `error` do Supabase e silenciosamente viravam lista vazia, e loading de admin renderizando `null` (tela branca) em vez de skeleton.

**P1 (`50d74de`) — Service worker não cacheia mais dado de API:** em `vite.config.ts`, REST (`/rest/v1/`) e Auth (`/auth/v1/`) do Supabase trocados de `NetworkFirst` (timeout 30s, validade até 24h/1h) para `NetworkOnly`. Storage mantido em `NetworkFirst` por ser arquivo estático, não dado de aplicação. Ver Caso 9 em `docs/PORTFOLIO_DEBUG_CASES.md`.

**P2 (`a190764`) — Erros de schedules/checkins não são mais silenciosos:** em `useWeeklyPlan.ts`, 3 queries (`schedules` do modo flexível, `checkins` do plano de grupo, `prevCheckins` da semana anterior) descartavam o campo `error` da resposta do Supabase e tratavam falha como lista vazia — o dashboard renderizava sem agendamentos/check-ins sem nenhum aviso. Agora todas propagam o erro (`if (error) throw error`), reaproveitando o retry com backoff exponencial e a tela de erro com "Tentar novamente" que já existiam em `fetchWithRetry`/`AlunoDashboard.tsx`. `AlunoDashboard.tsx` também passou a esperar `isLoading` do `useProgresso` (antes ignorado) antes de sair do skeleton — evita mostrar streak/recordes zerados por um instante.

**P3 (`9535b04`) — Skeleton no admin + paralelização de queries:** `AdminAlunos.tsx`/`AdminTurmas.tsx` renderizavam `{isLoading ? null : ...}` (tela branca por segundos, decisão da Task 61b para eliminar piscadas com dados que chegavam rápido — mas mascarava lentidão de rede real). Trocado por `ListSkeleton.tsx` (novo componente `src/components/ui/`, linhas pulsantes no formato dos cards reais). Em `useWeeklyPlan.ts`, `schedules` (modo flexível) e `checkins` do plano de grupo passaram a rodar via `Promise.all` — dependem só de `rawTrainings`/`userId`, não um do outro. **Decisão consciente de não paralelizar:** `weekly_plans` com `group_plans`, porque quando nenhuma semana é selecionada explicitamente (caso mais comum), o fallback de semana liberada (`targetWeekNumber`) depende do `released_through_week` que só vem depois de `group_plans` resolver — paralelizar quebraria esse fallback.

**P4 (`623c9f9`) — Lazy load das abas do aluno + logo otimizado:** `AlunoChat`, `AlunoProgresso`, `AlunoPerfil` e `CheckinSheet` eram importados estaticamente em `AlunoDashboard.tsx` — todo aluno baixava o `recharts` (usado só pela aba Progresso) mesmo sem nunca abri-la. Convertidos para `React.lazy` + `Suspense` (fallback `SkeletonLoader` nas abas, `null` no `CheckinSheet` por ser um bottom-sheet que abre por clique). Logo (`src/assets/arbo-run-logo.png`, 1024×1024, 454 kB) convertido para WebP 512×512 qualidade 90 (34,7 kB) via ImageMagick, preservando o fundo transparente — 512px mantém margem de nitidez de sobra para o maior uso real (160×160 no Login). Imports em `Login.tsx` e `AdminLayout.tsx` atualizados para `arbo-run-logo.webp`.

**Resultado (build de produção):**
- chunk `AlunoDashboard`: 438,69 kB → 33,36 kB (gzip 117,79 kB → 9,58 kB) — `recharts` isolado em chunk próprio, carregado só sob demanda.
- logo: 453,92 kB → 34,7 kB.

**Validação (todos os 4 commits):** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅. Build final também servido via `vite preview` e testado com `curl` (chunks e logo retornando 200).

### Sessão 2026-07-11 (tarde) — Auditoria de segurança de produção (Fable 5) + 5 bloqueadores corrigidos

**Contexto:** uma auditoria de segurança completa em produção, rodada por outro agente (Fable 5) antes desta sessão, confirmou o que já estava correto — RLS habilitado em 21/21 tabelas, segredos (`SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`, credenciais R2) nunca expostos ao client, zero vetor de XSS, JWT validado em todas as Edge Functions antes de qualquer uso de `service_role`, 0 vulnerabilidade de dependência em produção — e apontou 5 bloqueadores reais para corrigir antes de considerar o app pronto para produção com dados sensíveis de verdade. Trabalhado um bloqueador por vez, cada um validado (`tsc --noEmit`, `npm run lint`, `npm run build` → 0 erros) e testado manualmente em produção antes do commit/push seguinte — decisão deliberada de não acumular tudo num commit só, para isolar exatamente qual mudança quebraria algo, se quebrasse.

**Passo 0 (`eb8491f`) — Baseline do schema versionado:** `supabase/migrations/` tinha só 3 arquivos (`training_types` x2, `strava_analysis`) — todo o resto do schema real de produção (`profiles`, `trainings`, `groups`, `schedules`, `training_programs`, RLS, grants, triggers) só existia no banco, nunca versionado, fruto de meses de SQL aplicado direto no SQL Editor. `supabase db pull` não pôde ser usado direto: o CLI precisou de login (token de acesso pessoal fornecido pelo usuário via variável de ambiente), e o `db pull` inicial falhou porque o histórico de migrations remoto (`supabase_migrations.schema_migrations`) divergia dos arquivos locais — resolvido com `supabase migration repair` para reconciliar as duas pontas antes de puxar o schema completo. Uma migration (`set_user_role_to_app_metadata`, o trigger que copia `role` de `user_metadata` para `app_metadata`) existia no histórico remoto sem arquivo local correspondente — reconstruída a partir da definição real da função via SQL (`pg_get_functiondef`) em vez de simplesmente marcada como "revertida", para preservar o histórico. Resultado: um único arquivo de baseline (`20260711214804_baseline_producao.sql`, 2089 linhas) com 21 tabelas, 65 RLS policies, funções, triggers e grants — revisado antes de commitar (confirmado zero linha suspeita/incompleta) e substituindo os 3 arquivos antigos, cujo conteúdo já está incluído no baseline. A partir daqui, toda mudança de banco é uma migration nova (`supabase migration new <nome>` + `supabase db push`), nunca SQL solto.

**Bloqueador 1 (`8e40af5`, crítico) — Escalada de privilégio via UPDATE em `profiles`:** a policy `profiles_update` permite `id = auth.uid()` (necessário para o aluno editar nome/avatar), mas RLS controla **quais linhas**, não **quais colunas**, um usuário pode tocar — o mesmo UPDATE que edita `full_name` também deixava o aluno setar `role='admin'` ou `group_id` para qualquer turma via PATCH direto no client REST, sem nenhuma trava de coluna. Corrigido com uma trigger `BEFORE UPDATE` (`private.prevent_self_privilege_escalation()`) que bloqueia mudança de `role`/`group_id` quando `NOT private.is_admin()`, usando a mesma fonte de verdade (`app_metadata` via JWT) das policies — não `profiles.role`, que é justamente a coluna sendo protegida. Aproveitado para migrar 3 policies legadas (`training_types`, `schedules`, `messages`) que ainda liam `profiles.role` via subquery direta, para `private.is_admin()`.

Teste manual em produção, sem tocar em dado real: usuário de teste descartável criado via `INSERT INTO auth.users` (o que dispara `handle_new_user()` e cria o `profiles` correspondente automaticamente), removido ao final da mesma sessão de teste. Simulação de JWT via `SELECT set_config('request.jwt.claims', '...', true)` — sem essa simulação, testar a policy via SQL direto rodaria como `postgres` (superuser, bypassa RLS), sem exercitar o caminho real. Confirmado: aluno tentando `UPDATE role='admin'` recebe a exceção `Não autorizado a alterar role` (idem para `group_id`); edição de `full_name` continua funcionando sem restrição; admin consegue alterar `role`/`group_id` de aluno normalmente. Ver Caso 10 em `docs/PORTFOLIO_DEBUG_CASES.md`.

**Bloqueador 2 (`b71b502`, crítico) — Exclusão de aluno falhava com dado associado, ferindo LGPD:** `checkins.student_id`, `records.student_id`, `weekly_plans.student_id`, `strava_activities.user_id` e `strava_connections.user_id` eram `NO ACTION` (padrão implícito, sem `ON DELETE` explícito) — `delete-user` (que chama `auth.admin.deleteUser()`, cascateando via `profiles_id_fkey ON DELETE CASCADE`) falhava com 500 sempre que o aluno tinha qualquer checkin, record, plano semanal ou atividade Strava, e não havia forma de excluir de fato o histórico de um aluno que pedisse para ser esquecido. Trocadas para `ON DELETE CASCADE` — decisão: dado operacional do aluno é removido de fato junto com o aluno, não anonimizado, cumprindo direito ao esquecimento. Segundo nível avaliado antes de aplicar (`checkins.plan_id → weekly_plans`, `records.checkin_id → checkins`, ambas `NO ACTION`): não precisaram de ajuste, porque checkins/records/weekly_plans de um mesmo aluno são todos removidos juntos na mesma operação de cascade — o checkin que referencia o plano do próprio aluno (e o record que referencia o checkin do próprio aluno) já estão no mesmo lote de exclusão.

Teste manual em produção: aluno de teste descartável criado com 1 checkin + 1 record reais; `DELETE FROM auth.users` (a mesma operação de banco que `auth.admin.deleteUser()` executa por trás) completou sem erro, e `profiles`/`checkins`/`records` do aluno de teste confirmados removidos via SELECT. Não foi possível testar o clique real no botão "Excluir aluno" pelo navegador (sem sessão admin autenticada disponível no ambiente da sessão) — ficou como pendência explícita para teste manual do usuário em produção.

**Bloqueador 3 (`8d7716f`, alto) — `records_select` vazava recorde de terceiros:** a policy estava com `USING (true)` — qualquer aluno autenticado lia o recorde pessoal (`records`) de qualquer outro aluno via query direta ao Supabase, sem nenhuma restrição. Corrigida para `(student_id = auth.uid()) OR private.is_admin()`, mesmo padrão do resto do schema.

Teste manual em produção: dois alunos de teste descartáveis, cada um com 1 record; consulta simulando o JWT do aluno A (`SET LOCAL ROLE authenticated` + `request.jwt.claims`) retornou só o record de A, não o de B; simulando JWT de admin, ambos apareceram.

**Bloqueador 5 (`a0b1590`, alto) — Sem monitoramento de erro em produção:** `@sentry/react` instalado, `src/lib/sentry.ts` com `initSentry()` condicional — sem `VITE_SENTRY_DSN`, é no-op (app funciona normalmente, build não quebra). `ErrorBoundary.componentDidCatch` reporta a exceção capturada via `Sentry.captureException`, incluindo o `componentStack` do React. Validado que o build/dev/preview rodam normalmente sem a DSN configurada antes de considerar a integração pronta.

**Relatório final dos 5 bloqueadores entregue ao usuário** com hash de cada commit, confirmação de cada teste manual, instruções de onde configurar `VITE_SENTRY_DSN` (Vercel → Environment Variables, Production + Preview) — e um aviso de segurança à parte: o token de acesso pessoal do Supabase usado para autenticar o CLI foi colado em texto puro no chat pelo usuário; recomendada a revogação/rotação dele em `supabase.com/dashboard/account/tokens`.

**Fixes de acompanhamento na mesma sessão, depois do usuário configurar a DSN do Sentry no Vercel:**

1. **Redeploy vazio** (`c199370`) para a env var entrar em vigor. Verificação de que o Sentry ficou de fato ativo em produção **sem gerar erro de teste manual**: bundle final buscado via `curl`, DSN completa (`https://<key>@o<org>.ingest.us.sentry.io/<project>`) encontrada literalmente embutida no JS — prova de que `import.meta.env.VITE_SENTRY_DSN` foi corretamente resolvida em build-time pela Vercel e que `Sentry.init()` roda com config válida (o `initSentry()` só chama `Sentry.init` quando a DSN não é vazia).

2. **Bug reportado à parte, no meio da verificação do Sentry** (`a540dbd`): print do modal de Check-in mostrando o botão de confirmar sumido, campo "Observações" como último elemento visível. Investigação (parcialmente delegada a um subagente Explore para levantar contexto, refinada com leitura direta do código): `CheckinSheet.tsx` renderiza um `<div>` `position: fixed; inset: 0` (`overlay`) que, no modo de turma fixo, é filho de **dois** `motion.div` aninhados (`TrainingCard` tem seu próprio `animate={{y:0}} whileHover={{scale:1.01}}`, e é por sua vez filho de outro `motion.div` no map da lista) — Framer Motion aplica `transform` inline sempre que usa `animate`/`whileHover` com `x`/`y`/`scale`, mesmo em repouso, e qualquer ancestral com `transform` vira o *containing block* de um descendente `position: fixed`, fazendo `inset: 0` resolver contra a caixinha pequena do card em vez da viewport inteira — o sheet fica espremido e o botão sai da área renderizável. No modo de turma flexível o mesmo `CheckinSheet` não tinha o bug, porque uma sessão anterior já tinha içado seu estado pra fora do `motion.div` da lista (renderizado como irmão de `<main>`) — sem replicar a correção pro modo fixo. Varredura ampla encontrou o mesmo bug latente (não reportado ainda) no `DayPicker` via `FlexibleTrainingCard`, e confirmou que `PaceCalculator`, `NewProgramModal` e `ManageProgramsModal` estavam seguros (fixed aplicado no próprio elemento mais externo, ou montados fora de qualquer ancestral animado). Corrigido com o mesmo padrão já usado no `FilterDropdown.tsx` (Caso 8): `createPortal(..., document.body)` em `CheckinSheet.tsx` e `DayPicker.tsx`, escapando de qualquer ancestral transformado independente de onde forem montados no futuro. Diagnóstico completo apresentado e aprovado pelo usuário antes de qualquer mudança de código.

3. **CSP bloqueando o Sentry** (`ad3a7bf`): usuário testou em produção (`throw new Error` no console) e confirmou que nenhum evento chegava no painel do Sentry, mesmo com a DSN correta. `connect-src` em `vercel.json` não incluía os domínios de ingest do Sentry — adicionados `https://*.ingest.us.sentry.io https://*.sentry.io`.

4. **Causa raiz real de "Sentry ainda não recebe erro mesmo após o fix do CSP"** (`877fde7`): investigação em 5 pontos, sem depender de teste manual no navegador do usuário. (1) `curl -I` em produção confirmou que o CSP servido pelo header HTTP já estava correto — servidor nunca foi o problema. (2) Sem meta tag de CSP duplicada no `index.html`. (3) **Causa raiz encontrada**: `vite-plugin-pwa` aplica `navigateFallback: "index.html"` por padrão (confirmado lendo o próprio source em `node_modules`) quando não configurado explicitamente — isso gera um `NavigationRoute(createHandlerBoundToURL("index.html"))` no Workbox, fazendo **toda** navegação (inclusive hard refresh) ser servida do `index.html` **precacheado**, com os headers HTTP congelados de quando aquele arquivo foi cacheado pela primeira vez. Como mudar só o `vercel.json` não altera os *bytes* do `index.html`, sua revisão de precache nunca muda entre deploys — o Workbox nunca refaz o fetch, e qualquer navegador que já tinha o SW instalado antes do fix ficaria preso na CSP antiga para sempre, em qualquer deploy futuro que só mexesse em headers. Confirmado também que `Vercel` já resolve o fallback de rotas da SPA via `rewrites` no `vercel.json` — a rota do SW era redundante para roteamento, só existia por ser o default da lib. (4) Config do `Sentry.init()` revisada — nenhuma integration desativada, `GlobalHandlers` (`window.onerror`/`unhandledrejection`) ativo por padrão. (5) Testado de forma automatizada, sem depender do navegador: extraída a DSN completa do bundle de produção e enviado um envelope de teste via `curl` direto pro endpoint de ingest do Sentry — HTTP 200, confirmando que o DSN/projeto funcionavam e a única camada quebrada era o cache do Service Worker no navegador do usuário. Corrigido com `navigateFallback: undefined` + nova regra `runtimeCaching` (`NetworkFirst`, `networkTimeoutSeconds: 5`) para requisições de navegação, e bump de `cacheId` (`arbo-v5` → `arbo-v6`) para invalidar de imediato o cache de quem já tinha o SW antigo instalado — usuário só precisou fechar e reabrir o app uma vez (`skipWaiting`+`clientsClaim` já cuidam do resto). Ver Caso 11 em `docs/PORTFOLIO_DEBUG_CASES.md` — categoria diferente do Caso 9 (aquele era cache de *dado* de API; este é cache do próprio *documento* de navegação, mais traiçoeiro porque nem hard refresh resolve).

**Validação (todos os commits da sessão):** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅ em cada um, individualmente, antes do commit seguinte.

### Sessão 2026-07-12 — Fix do modo preview, Domingo como 7º dia, e 2 bugs de layout medidos com Playwright

**Contexto:** quatro tarefas sequenciais na mesma sessão, cada uma com diagnóstico próprio antes da correção, validadas individualmente (`tsc --noEmit`, `npm run lint`, `npm run build` → 0 erros) e commitadas em separado.

**1 (`3483c4b`) — Modo preview ("Testar como Aluno") não conseguia agendar nem fazer check-in:** causa raiz — `/preview-aluno` monta `<AlunoDashboard previewStudentId="00000000-0000-0000-0000-000000000000">` dentro de `<AdminRoute />`, então o admin navega com a própria sessão (JWT real dele), mas todo `student_id` gravado é o UUID fixo do "Aluno Demo". A única policy de escrita em `schedules` (`"Aluno CRUD próprio schedule"`) e a de `INSERT` em `checkins` (`checkins_insert`) exigem `student_id = auth.uid()` — como `auth.uid()` (admin) ≠ `student_id` (Aluno Demo), o INSERT era rejeitado com `42501` (new row violates row-level security policy), mostrado ao usuário só como o toast genérico "Erro ao agendar treino". Confirmado com `auth.users`: `demo@arborun.com` existe mas `last_sign_in_at IS NULL` — nunca foi logado de fato, só existe pra essa rota de preview funcionar via `student_id` fixo. Corrigido com 2 policies novas, escopadas **exclusivamente** a esse UUID (migration `20260712220044`): `"Admin escreve schedules do Aluno Demo"` (`FOR ALL`) e `"Admin insere checkin do Aluno Demo"` (`FOR INSERT` — único gap em `checkins`, `UPDATE`/`DELETE` já tinham bypass `OR private.is_admin()`). Deliberadamente **não** libera admin para escrever em nome de qualquer aluno real — testado com 6 simulações de RLS via `SET LOCAL request.jwt.claims` direto em produção (admin→Aluno Demo ✅, aluno real→si mesmo ✅ sem regressão, admin→aluno real ❌ continua bloqueado), todas com `ROLLBACK`, sem persistir dado de teste. `useScheduling.ts` também passou a reportar falhas de agendamento ao Sentry (além do `console.error`), pra erros de RLS/banco em produção aparecerem no painel em vez de só no console do navegador de quem testou.

**2 (`7843943`) — Domingo adicionado como 7º dia agendável:** decisão de convenção — Domingo = dia `7`, não `0`, apesar de `Date.getDay()` do JS retornar `0` pra domingo. Motivo: pelo menos 2 lugares do código já usavam `?? 0`/`?? null` como sentinela de "sem dia atribuído" (`useAdminTurmaDetail.ts` no sort de `group_plan_trainings`, `FlexibleTrainingCard.tsx` no `scheduledDay`) — se domingo fosse `0`, um treino agendado pra domingo ficaria indistinguível de um treino sem dia nenhum. `dayDate()`/`weekRange()` em `AdminTurmaDetail.tsx` também já calculavam o fim da semana como `cycleStart + 6` (o 7º dia), reforçando que 1-7 já era a convenção implícita. Ajustados: `DayOfWeek` type (`1|2|3|4|5|6` → `...|7`), `DAY_NAMES`/`DAYS_LABEL` em 3 componentes, `ProfessorStatusGrid.tsx`, e normalização de `todayDow` em `AlunoDashboard.tsx` (`jsDow === 0 ? 7 : jsDow`, já que `getDay()` nativo não sabe da convenção do app). CHECK constraints de `schedules.scheduled_day_of_week` e `group_plan_trainings.day_of_week` ampliadas de `1-6` pra `1-7` (migration `20260712221536`, aplicada em produção). Layout do `DayPicker.tsx`: grid 2 colunas, com o botão de Domingo ocupando a linha inteira (`grid-column: 1/-1`) em vez de ficar solo numa grade de 3 colunas com espaço vazio ao lado.

**3 (`1807d66`) — WeekView do admin cortando dias no mobile:** causa raiz — grid de 7 colunas com `min-width: 490px` fixo, sem `box-sizing` declarado (default `content-box` do browser), somando os `16px+16px` de padding por cima: ~522px de conteúdo real numa viewport de ~341px (`.main` com 16px de padding cada lado). O `overflowX: 'auto'` do wrapper até funcionava como scroll, mas sem indicador visual — lia como corte, não como "arraste pra ver mais". Corrigido removendo `min-width` e o wrapper de scroll, seguindo o padrão já usado no `MonthView` (que nunca teve esse problema): as 7 colunas (`1fr` cada) encolhem pra caber na largura real disponível. Ajuste extra necessário: título do treino, sem truncamento nenhum antes, quebraria em várias linhas numa coluna de ~44px — adicionado o mesmo truncamento por tamanho de string que o `MonthView` já usava (aqui 12 caracteres, mais agressivo que os 14 do `MonthView` por causa da fonte maior, 10px vs 8px).

**4 (`13c670e` + `67e133b`) — DayPicker cortando TER/QUI/SÁB/DOM na borda direita — 2 diagnósticos por leitura de CSS erraram, só a medição real achou:** primeira rodada de diagnóstico (leitura isolada do CSS de `.grid`/`.dayBtn`/`.fullWidth`) concluiu "matemática correta, sem bug" — `.fullWidth` só define `grid-column`, `.dayBtn` mantinha todas as propriedades visuais, nenhuma sobrescrita encontrada. Aplicado mesmo assim um hardening defensivo em `.dayBtn` (`width:100%`, `box-sizing:border-box`, `text-align:center`, tornando explícito o que antes dependia de comportamento implícito do browser/grid) — não resolveu, o sintoma persistiu, confirmado por print do usuário pela segunda vez, depois de descartar cache do Service Worker como causa (fechar/reabrir o app). Na terceira rodada, medição real com Playwright + Chromium headless (viewport 375px, o mesmo usado no diagnóstico do WeekView) revelou a causa raiz de verdade: `.modal` (o container pai do grid, não o grid em si) tinha `width: 100%` + `padding: 16px 20px` **sem** `box-sizing` declarado — `content-box` somava os 40px de padding horizontal por cima dos 100%, `.modal.right` media **415px numa viewport de 375px**. O `.grid` filho, esticando via `align-items:stretch` do flex pai, herdava esse excesso de 20px, e a coluna direita (TER/QUI/SÁB) e o botão full-width (DOM) ficavam com o lado direito cortado. Corrigido com `box-sizing: border-box` em `.modal`; medição repetida depois do fix confirmou `.modal.right = 375` (exato) e nenhum botão ultrapassando a viewport. Ver Caso 12 em `docs/PORTFOLIO_DEBUG_CASES.md` — a lição central: leitura de CSS isolada não pega bug que só existe na composição de elementos ancestrais diferentes; medição do layout renderizado de verdade (Playwright/`getBoundingClientRect`) resolveu o que duas rodadas de análise teórica não conseguiram.

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅, individualmente em cada um dos 5 commits.

**Pendências conhecidas, fora do escopo desta sessão:** achados extra do advisor de segurança do Supabase — `search_path` mutável em `update_updated_at_column`/`update_group_plans_updated_at` (risco baixíssimo, nenhuma é `SECURITY DEFINER`); RPCs `SECURITY DEFINER` expostas via REST (`handle_new_user`/`rls_auto_enable`/`set_profile_role`/`set_user_role` são funções de trigger/event-trigger — Postgres bloqueia chamada direta fora desse contexto, risco zero mesmo aparecendo no advisor; `get_user_email` já tem guarda interna de admin, risco baixo); proteção de senha vazada (HaveIBeenPwned) desligada no Supabase Auth — risco médio, fix trivial (toggle em Authentication → Settings → Password Security, sem código).
