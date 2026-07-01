# 🌳 Arbo — Briefing do Time de IA

> Última atualização: 2026-06-06
> Autor: Maxwell + Antigravity

---

## Quem somos

Somos um **time de 3**:
1. **Maxwell** — Consultor de automações de IA, dono do projeto, decisor final
2. **Claude Code** — Roda no WSL via VS Code terminal, forte em contexto e revisão de código
3. **Antigravity (Opus 4.6)** — Roda na GUI do VS Code, forte em implementação, design premium e análise completa

### Modelo de trabalho

| Etapa | Responsável | Ação |
|---|---|---|
| 1 | Claude Code | Resume estado atual do projeto (lê os .md) |
| 2 | Antigravity | Testa mesmo prompt (prova que entende o projeto igual) |
| 3 | Antigravity | Implementa a feature completa (design + spec + código) |
| 4 | Claude Code | Revisa o código implementado (TypeScript, padrões, segurança) |
| 5 | Ambos | Atualizam os .md + git push |

### Por que dois agentes?

- **Claude Code** é nativo do terminal WSL — excelente para revisão rápida e contexto
- **Antigravity** tem GUI, subagentes paralelos, geração de imagens, Chrome DevTools — excelente para implementação completa e design premium
- Juntos, cobrem **desenvolvimento + revisão** como um time real

---

## O Projeto

- **Nome:** Arbo
- **O que é:** App de assessoria esportiva para corrida
- **Público:** Professor de corrida que gerencia alunos, turmas e treinos digitalmente
- **Stack:** React 19 + TypeScript 6 + Vite 8 + Supabase (região São Paulo)
- **Repo:** https://github.com/maxwellnasci/arbo
- **Projeto Supabase:** `jhfkflnixzivuichmkie`
- **Branch:** `master`

### Ferramentas de design premium instaladas
- **lucide-react** — 1000+ ícones SVG modernos
- **framer-motion** — Animações e transições suaves
- **sonner** — Toasts/notificações estilo Apple
- **date-fns** — Formatação de datas em PT-BR

### Estado atual (2026-06-13)
- **Nota geral do projeto:** 8.75/10 — Meta: 9.0+
- **Tasks 39-61 concluídas** (incluindo Tasks 52-57, 59, 59c, 60, 61)
- **Próxima sessão:**
  - Verificar no celular se Task 60 eliminou completamente as piscadas admin.
  - Expandir testes de 22 para 50+ (hooks, componentes, fluxos críticos).
  - Service layer — abstrair chamadas Supabase para `src/lib/api.ts`.
  - Acessibilidade 89 → 95+.
- **App publicado:** **https://arbo.mxos.com.br** (Vercel, SPA routing)
- **23+ telas/features implementadas**, build e lint passando (`tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` ✅ — 0 erros)
- Fase 1 (Auth + Schema + UI base): ✅ 100%
- Fase 2 (Admin Turmas + Planos + Perfil Aluno + Etiquetas + Controle de Liberação + Nova Turma + Filtros + Invites): ✅ 100%
- Fase 3 (Treinos + Chat + Progresso + Perfil + PRs + Error Boundary + Code Splitting): ✅ **100%**
- Fase 5 (Redesign Premium Admin + Aluno + Dark/Light Mode + 10 bugs pós-redesign corrigidos): ✅ **100%**
- Task 38: Fix "Unexpected Application Error!" em produção (RouterErrorElement + sessionStorage guard) ✅
- Task 39: 5 Melhorias DeepSeek (RLS messages, sem select(*), paralelizar turmaDetail com joins, ConfirmModal premium, Workbox runtimeCaching + offline.html) ✅
- Task 40: Qualidade & Performance (N+1 mitigado no changeGroup em memória, eliminação de `select('*')` em mais 8 arquivos, correção das variáveis CSS de temas no ConfirmModal) ✅
- Task 41: Refatoração de Qualidade (select wildcard, 25+ hex hardcoded, novas CSS vars, Light Mode estendido, tipos explícitos DBGroupPlan/DBGroupPlanTraining) ✅
- Task 42: Micro-residuais de Qualidade (shadows centralizadas, hex residuais) ✅
- Task 59c: Navegação admin — AnimatePresence removido, background-color no .main, prefetch 5 rotas, try/catch/finally em hooks ✅
- Task 60: Fix piscada pós-carregamento — `listContainer.hidden = {}` (container visível imediatamente, stagger preservado), `setLoading(true)` removido do refetch em `useAdminTreinos` ✅
- Task 61: Feature de vídeo YouTube nos treinos — Coluna `video_url` criada, `VideoPlayer.tsx` implementado para YouTube, formulário `TreinoFormPanel` e cards de treino (`TrainingCard`, `FlexibleTrainingCard`) atualizados ✅
- Task 62: Fix visibilidade de alunos recém-convidados — Adicionada opção de filtro "Sem Turma" e badge visual vermelho no `AdminAlunos` para destacar alunos que completaram o cadastro mas ainda não possuem turma vinculada ✅
- Task 63: 3 Melhorias admin — Campo "nome" inserido e obrigatório na tela de `SetPassword.tsx`, email dos alunos resgatado via RPC `get_user_email` e exibido no painel `AdminAlunoDetail.tsx`, visualização expandível do `VideoPlayer` adicionada no `TreinoCard.tsx` (biblioteca de treinos) e `SidePanel` (`AdminTurmaDetail.tsx`) ✅
- Task 64: Editar nome do aluno no admin e correção da RPC `get_user_email` visível no perfil ✅

### O que foi feito em 2026-05-31
- Perfil do Aluno (`/admin/alunos/:id`) implementado — 3 tabs (check-ins, recordes, anamnese), métricas, dropdown de turma, framer-motion.
- Sistema de Etiquetas Personalizadas (tabela `tags`, pills nos treinos, form inline com 8 cores). Lint zerado.
- Controle de Liberação do Plano — `released_through_week` no banco, chips S1–S4 com `✓`/`🔒` + banner de liberação no admin, `LockedScreen` no AlunoDashboard (boas-vindas, resumo da semana anterior, barra de ciclo).
- Biblioteca de Treinos (`/admin/treinos`) implementada via colaboração Gemini + DeepSeek V4 Pro como subagente.

### O que foi feito em 2026-06-01
- **Refinamento visual de `/admin/treinos`** (Claude Code): convertido de Tailwind/light para inline styles dark; pills de tipo coloridas por categoria; `TreinoFormPanel` com dark theme e fix de lint (`as any` → `TrainingType`, padrão `async load()`); fix TS pré-existente no `AdminSidebar`. tsc + build + lint: 0 erros.
- **Chat Direto Admin ↔ Aluno** (Antigravity): Tabela `messages` criada com RLS e tempo real; `useChat.ts` hook com subscription; `AdminChatPanel` SidePanel elegante usando glassmorphism e framer-motion; Aba Chat em `AlunoDashboard` com UI mobile-first premium (balões coloridos, soft delete, auto scroll).
- **Fix `<Toaster>` duplicado** (Claude Code): `AdminAlunoDetail` renderizava Toaster local em conflito com o global em `App.tsx`. Removido — eliminava toasts duplicados. tsc + lint: 0 erros.

### O que foi feito em 2026-06-02
- **Aba Progresso `/aluno/progresso`** (Claude Code): `useProgresso.ts` — queries paralelas de recordes, histórico de check-ins, cálculo de pace médio por mês e streak semanal. `AlunoProgresso.tsx` — badge de streak, grid de recordes (5km/10km/21km/42km), gráfico LineChart recharts com CustomTooltip formatado, histórico recente. CSS Modules dark. Integrado ao BottomNav do AlunoDashboard.
- **Fix recharts × Vite** (Claude Code): downgrade 3.8.1 → 2.15.4 — versão 3.x usa `victory-vendor` (CJS) que causa `require_isUnsafeProperty` com Vite; 2.x é ESM nativa sem workarounds. `vite.config.ts` limpo.
- **Aba Perfil `/aluno/perfil`** (Gemini + revisão Claude Code): `useAlunoPerfil.ts` — queries paralelas profile/groups + strava_connections (placeholder RLS); padrão `async load()`, `cancelled` flag. `AlunoPerfil.tsx` — avatar com fallback, dados pessoais (nível, turma), card Strava placeholder, logout. `AlunoDashboard.tsx` — substitui `ProfileMenu` inline por `<AlunoPerfil>`. Revisão Claude Code: `padding-bottom: 96px` no CSS para BottomNav.
- **Notificações de PR no admin** (Gemini + revisão Claude Code): `useAdminPRs.ts` + `AdminPRFeed.tsx` — feed dos 5 recordes mais recentes no `AdminHome`, clicável para `/admin/alunos/:id`. `AdminHome.tsx` — `fetchStats` refatorada com `cancelled` flag e `try/finally`. tsc + lint: 0 erros.

### O que foi feito em 2026-06-05 (Parte 2)
- **Análise dupla de qualidade pós-redesign** (Claude Code — 7 ângulos paralelos): diff scan, removed-behavior auditor, cross-file tracer, CSS variables/dark mode, regressões de segurança, reuse/simplification, altitude. 27 candidates → 10 bugs confirmados.
- **10 bugs pós-redesign corrigidos** (Claude Code): `var(--text-h)` indefinida (h1/h2/code invisíveis em dark mode); `.stateCard`/`.errorText`/`.retryBtn` deletadas no redesign; `.cycleBarFuture`/`.cycleLabelFuture` ausentes no `LockedScreen`; input do chat atrás do BottomNav; `handleDelete` sem error handling; `setTimeout` sem cleanup; queries de treinos/tags sem verificação de `.error`; hardcoded `#ccc`/`#555` nos inputs do admin; overflow do chart removido; `type?.toUpperCase()` null safety. tsc + build + lint: 0 erros ✅

### O que foi feito em 2026-06-04
- **Correções UX Mobile** (Gemini): `overscroll-behavior: none` + `overflow: hidden` em `html/body` (elimina bounce iOS); `maximum-scale=1.0, user-scalable=no` no viewport (bloqueia zoom indesejado); `#root` com `height: 100dvh` + `overflow-y: auto` + `-webkit-overflow-scrolling: touch`. tsc + lint: 0 erros ✅
- **PWA Completo** (Gemini + fix Claude Code): `vite-plugin-pwa` instalado; manifest com nome, cores e ícones do Arbo; ícone SVG custom "A" em laranja `#E8521A`; PNGs 192×192 e 512×512; service worker Workbox com precache de 29 entradas; meta tags iOS (`apple-touch-icon`, `viewport-fit=cover`); fix Claude Code: removidos `manifest.json` redundante, `icons.svg` de template e `vite.config.js` duplicado. tsc + build + lint: 0 erros ✅
- **Responsividade Mobile** (Gemini): Menu hamburguer no painel admin com sidebar drawer animado; tabelas scrolláveis horizontalmente; `flexWrap` nos forms; media queries para `AdminAlunoDetail`; safe area inset no perfil do aluno; fix do container recharts no progresso. tsc + lint: 0 erros ✅
- **Login redesign premium + ícones PWA + EditGroupModal** (Gemini + fix Claude Code): `Login.tsx`/`Login.css` reescritos com glassmorphism, glow laranja, logo Arbo e ícones lucide; novos ícones PWA com arbo-logo em `public/icons/`; header da turma reformulado com breadcrumb + pills de metadados + botão "Editar"; `EditGroupModal.tsx` (novo) para editar dados da turma; `vite.config.js` redundante removido (Claude Code). tsc + lint: 0 erros ✅
- **Ajustes visuais no grid da semana, vista mês e ícones PWA** (Gemini): `AdminTurmaDetail.tsx` — `minHeight: '70vh'` no grid, `flex: 1` + `flexDirection: column` em colunas e células para crescimento proporcional na vista mês. Ícones `icon-192.png` e `icon-512.png` com proporção da árvore melhorada. tsc + lint: 0 erros ✅
- **Correção do header mobile e reversão da altura do grid** (Gemini): `AdminTurmaDetail.tsx` — header refatorado para `flexDirection: 'column'` (linha de navegação+toggle separada do bloco da turma); título com `clamp(18px, 5vw, 24px)`; pills de metadados com `flexWrap: 'wrap'`; botão "Editar" integrado como pill (`marginLeft: 'auto'`); `minHeight: '70vh'` revertido (causava altura excessiva na vista de treinos). tsc + lint: 0 erros ✅
- **Convites e Error Boundary** (Antigravity): `invite-user` com fallback para reset de senha (re-convite infinito); `useInvite` usando `window.location.origin`; ErrorBoundary com auto-reload para `Failed to fetch dynamically imported module`; Tela de Sucesso premium em `SetPassword.tsx`. tsc + lint: 0 erros ✅
- **Correções de qualidade e segurança (Parte 8 — análise dupla DeepSeek + Claude Code):** `useChat` refatorado (padrão `async load()` + Realtime no mesmo effect); `AdminTurmaDetail` catch blocks corrigidos; `DashboardRedirect` fix TS; `AdminHome` queries otimizadas com `count: 'exact', head: true`; eslint-disable + `as any` eliminados em 4 arquivos; `actionError` UI em chats; `useTreinoMutations` sem catch morto; `AdminSidebar` ternário disabled removido; `invite-user` **Open Redirect corrigido** (`new URL()` + hostname exato, nunca `startsWith()`); CORS dinâmico com allowlist. tsc + build + lint: 0 erros ✅

### O que foi feito em 2026-06-03
- **Deploy no Vercel:** App publicado em **https://arbo.mxos.com.br** com SPA routing via `vercel.json`
- **Implementação em Paralelo** (Antigravity + Subagentes):
  - **Nova Turma:** `CreateGroupModal.tsx` — modal com form (nome, objetivo, frequência, tipo de plano, data de início); cria registro na tabela `groups`; botão `+ Nova Turma` em `AdminTurmas.tsx`
  - **Error Boundary:** `ErrorBoundary.tsx` — class component global com fallback elegante e botão "Tentar novamente"; integrado em `App.tsx` envolvendo todas as rotas
  - **Tabela `invites`:** criada no Supabase (id, email, role, status, invited_by, created_at) com RLS + policies + GRANT; Edge Function `invite-user` registra no banco; `AdminConvites.tsx` exibe log completo
  - **Filtros em Alunos:** busca por nome + filtro por Turma (dinâmico, vem do banco) e Nível; filtragem via `useMemo` sobre lista local em `AdminAlunos.tsx`
- **Types regenerados:** `database.types.ts` atualizado com tabela `invites` após criar no Supabase
- **Fix de lint (Claude Code):** `AdminConvites.tsx` — `useEffect` refatorado para `async function load()` com `cancelled` flag

### O que foi feito em 2026-06-05 (Parte 3 — Claude Code)

**Divisão do CLAUDE.md:**
- `CLAUDE.md` dividido em dois: `CLAUDE.md` (referência técnica concisa) + `CLAUDE_HISTORICO.md` (histórico completo de todas as sessões). Todos os agentes devem ler `CLAUDE_HISTORICO.md` para contexto de decisões passadas.

**Relatório de performance (análise, sem código):**
- N+1 em `useAdminAlunoDetail` — busca grupo do banco quando já está em memória
- 3 round trips sequenciais em `useAdminTurmaDetail` (group → plan → trainings)
- Checkins sem `limit()` em `useAdminAlunoDetail` e `useProgresso`
- `select('*')` desnecessário em `useAdminAlunos`
- Query em `strava_connections` sempre falha por RLS (round trip desperdiçado)
- Imagem logo sem dimensões → layout shift (CLS)
- 7 índices SQL criados no Supabase: `checkins(student_id)`, `records(student_id)`, `records(achieved_at DESC)`, `group_plans(group_id, starts_at)`, `group_plan_trainings(group_plan_id)`, `messages(student_id)`, `profiles(role)`

**Bug fix — toggle de liberação semanal:**
- `useGroupPlanMutations.ts`: `releaseThrough` agora aceita `0 | 1 | 2 | 3 | 4`
- `AdminTurmaDetail.tsx`: chips S1–S4 fazem toggle — clicar em semana ativa reduz a N-1; S1 ativo → bloqueia tudo (0). Lógica: `target = w === current ? w - 1 : w`

**Feature — Exclusão de aluno:**
- `supabase/functions/delete-user/index.ts` criada e deployada: valida JWT admin, `service_role` para deleteUser, CORS allowlist, anti-auto-exclusão
- `AdminAlunoDetail.tsx`: botão "Excluir aluno" (zona de perigo, vermelho/outline) + modal de confirmação (título, texto irreversível, ghost cancelar, vermelho `#dc2626` confirmar) + `toast.success` + `navigate('/admin/alunos')`

**Validação:** `tsc --noEmit` ✅ · `npm run lint` ✅ · `npm run build` ✅

### O que foi feito em 2026-06-05 (Parte 4 — Gemini + Claude Code)

**Sistema de Etiquetas/Tipos inline (Task 36 — Gemini):**
- Schema: tabela `training_types` (`id uuid PK`, `name text NOT NULL UNIQUE`, `is_custom boolean DEFAULT true`, `created_by uuid FK`) com RLS + GRANT SELECT, INSERT, DELETE para `authenticated`
- `trainings.type` migrado de enum `training_type` para `text` (migration `20260606010118`)
- `TreinoFormPanel.tsx` — campos de Tipo e Etiqueta com criação inline: seleciona existente ou abre mini-form para criar novo; color picker de 8 cores para etiquetas
- `AdminTreinos.tsx` — painel colapsável "Gerenciar Etiquetas e Tipos" com lista + exclusão
- `AdminTurmaDetail.tsx` — mesmo sistema inline integrado no `CreateTrainingForm` da turma

**10 correções (Task 37 — Claude Code — code review completo):**
- `src/lib/trainingUtils.ts` criado: `TAG_COLORS`, `TRAINING_TYPE_OPTIONS`, `TRAINING_TYPE_LABELS`, `insertTag()`, `insertTrainingType()` — fonte única compartilhada
- `try/catch` ao redor de chamadas Supabase removidos (Supabase JS nunca lança; usar `{error}`)
- `cancelled` flag adicionada no `useEffect` de carga de tags/tipos
- User guard (`if (!user)`) nos handlers de criação
- UNIQUE constraint `training_types_name_unique` + tratamento de código `23505`
- Hex hardcoded em `TreinoFormPanel` → CSS vars semânticas
- `.eq('is_custom', true)` na query de tipos
- `refetch()` desnecessário removido dos handlers de delete
- `TrainingType` como branded union `'corrida' | ... | (string & {})`
- Mutations de etiqueta/tipo movidas para os pais (`AdminTreinos`, `AdminTurmaDetail`); `TreinoFormPanel` recebe callbacks async

**Validação:** `tsc --noEmit` ✅ · `npm run lint` → 0 erros ✅ · `npm run build` ✅

### O que foi feito em 2026-06-06
- **Fix "Unexpected Application Error!" em produção (Task 38 — Claude Code):** `RouterErrorElement` adicionado como `errorElement` na rota raiz do `createBrowserRouter` — detecta falhas de chunk PWA (`Failed to fetch dynamically imported module`) e faz auto-reload uma vez com guard `sessionStorage` para evitar loop. Outros erros exibem tela amigável em vez de tela padrão do React Router. Root cause: data router API capturava erros antes do `ErrorBoundary` externo. Commit `7535ce1`.
- **5 Melhorias DeepSeek (Task 39 — Antigravity):** SQL de RLS para tabela `messages` gerado; Remoção de wildcard select em hooks via mapeamento `database.types.ts`; Paralelização otimizada em `useAdminTurmaDetail` com Deep Joins ao invés de cascata; Modal premium `<ConfirmModal />` em `AdminTreinos` extinguindo `window.confirm`; Estratégias `NetworkFirst`/`CacheFirst` em `vite-plugin-pwa` (Workbox) e fallback `offline.html` para experiência offline sem interrupções. Build + Lint 100% limpo.
- **Limpeza de Qualidade (Task 40 — Antigravity):** Fechamento de gargalos menores remanescentes detectados — N+1 queries banidas no `useAdminAlunoDetail` (`changeGroup`); mais 10 `select('*')` substituídos por colunas exatas pelo sistema (`useWeeklyPlan`, `AdminTurmaDetail` etc.); refatoração do `<ConfirmModal />` para usar `var(--red-accent)` recém injetada globalmente e `var(--bg-surface)`; remoção de imagens faltantes (404) no Array de PWA screenshoots no Vite.
- **Refatoração de Qualidade e Suporte Light Mode (Task 41 — Antigravity):** Remoção de select wildcard em `useAdminTreinos.ts` / `useTreinoMutations.ts`; 25+ hex hardcoded substituídos por CSS variables em `AdminTurmaDetail.tsx`; novas variáveis CSS de suporte no `index.css`; `<ConfirmModal />` padronizado; suporte a Light Mode estendido para `ErrorBoundary`, `ProtectedRoute`, `PageLoader`, `RouterErrorElement`, `SetPassword`; e tipos explícitos `DBGroupPlan`/`DBGroupPlanTraining` em `useAdminTurmaDetail.ts`.
- **Micro-residuais de Qualidade (Task 42 — Antigravity):** Erradicação de hex em `ErrorBoundary.tsx` (#d14312 e sombra), `SetPassword.tsx` (#ff6b6b), `ConfirmModal.tsx` (background subtleMap e sombra) e `App.tsx` (sombra de erro); novas variáveis de sombra `--shadow-modal` e `--shadow-card` no `index.css`.

### Notas Finais da Sessão 2026-06-06
- **Nota final do projeto:** 7.9/10 (subiu de 6.9 para 7.9 na sessão) — Meta: 8.5+ de média geral.
- **Tasks 39-42 concluídas**
- **Próxima sessão planeada:**
  - Migrar os estilos inline/CSS remanescentes para **CSS Modules**: `Login.css`, `AdminChatPanel.module.css`, `CreateGroupModal.tsx`, `EditGroupModal.tsx`, `AnamnesisForm.tsx`, `TreinoCard.tsx`, `AlunoDashboard.module.css`.
  - Otimizar filtro server-side no Deep Join (`useAdminTurmaDetail.ts`).
  - Adicionar `limit()` nas queries sem paginação.
  - Executar auditoria Lighthouse no PWA.

---

## Arquivos de contexto do time

| Arquivo | Quem lê | Conteúdo |
|---|---|---|
| `CLAUDE.md` | Claude Code | Regras técnicas, padrões Supabase, estado atual, roadmap |
| `CLAUDE_HISTORICO.md` | Todos | Histórico detalhado de todas as sessões de desenvolvimento (2026-05-21 em diante) |
| `GEMINI.md` | Gemini | Mesmo conteúdo do CLAUDE.md adaptado para Gemini |
| `ANTIGRAVITY.md` | Antigravity + Claude Code | Este arquivo — briefing do time, fluxo de trabalho, preferências |
| `ARBO_FASE2.md` | Todos | Documentação de produto completa (Fase 2 e 3) |

> **Importante:** `CLAUDE.md` foi dividido em duas partes em 2026-06-05: `CLAUDE.md` contém apenas referências técnicas e estado atual; `CLAUDE_HISTORICO.md` contém todo o histórico de sessões. Ler ambos para contexto completo.

### Regra de ouro
Após cada sessão de trabalho, **atualizar os .md** com o que foi feito. Isso mantém todos os agentes sincronizados.

---

## Setup do Ambiente (Antigravity)

- **WSL:** Ubuntu 24.04 — Node v22 (nvm), npm, Python 3.12, Git, GCC, Make, curl, gh CLI, supabase CLI
- **Windows:** Node v24, npm 11, Python 3.11, Git 2.54
- **GitHub:** Token PAT configurado no remote URL
- **Supabase:** CLI autenticado, projeto linkado
- **Comandos WSL:** `wsl -e bash -lic "comando"` (login shell para carregar nvm)
- **Sudo sem senha:** `wsl -u root -e bash -c "comando"`

---

## Preferências do Maxwell

- Respostas sempre em **português brasileiro**
- Prioriza **funcionalidade > perfeição**, mas sem abrir mão de segurança
- Quer **design super premium** — animações, ícones, toasts, micro-interações
- Confia no time de IA, mas quer **aprovar cada ação** no terminal
- Primeiro projeto full-stack — código limpo e documentação são prioridade
- Filosofia: **personalização dentro do grupo** — não impõe, favorece a experiência

---

## Padrões técnicos (resumo — detalhes no CLAUDE.md)

- **Auth:** `app_metadata.role` (nunca `user_metadata`)
- **Tipo Record:** usar `PersonalRecord` (palavra reservada TS)
- **Join N→1:** retorna objeto, não array (`wpt.trainings`, não `wpt.trainings[0]`)
- **FK ambíguo:** usar nome explícito (`profiles!checkins_student_id_fkey(*)`)
- **RLS:** obrigatório em todas as tabelas
- **Edge Functions:** para lógica sensível (convites, service_role)
- **Gerar tipos:** `npx supabase gen types typescript --project-id jhfkflnixzivuichmkie > src/lib/database.types.ts`
- **Validar:** `npx tsc --noEmit` + `npm run build`

---

## 🎨 Comandos de Qualidade Visual

Utilize os comandos abaixo para acionar a revisão e melhoria visual pelo AntiGravity (baseado nas diretrizes modernas ativadas no ambiente):

- *"Faça uma auditoria visual e de design system na tela X"*
- *"Revise a qualidade do CSS no componente Y seguindo práticas modernas"*
- *"Aplique efeito WOW na tela X — micro-animações, hover effects, paleta premium"*

---

## 🔍 Melhorias Identificadas pelo Antigravity (2026-05-31)

> Seção mantida pelo Antigravity. Cada melhoria identificada fica documentada aqui para o time avaliar e implementar no momento certo. O Claude Code pode ler esta seção e ajudar a priorizar ou implementar.

### 🔴 Prioridade Alta (fazer em breve)

| # | Melhoria | Por quê | Quando |
|---|---|---|---|
| 1 | ~~**Code Splitting (lazy loading)**~~ ✅ | ~~Build gera chunk >500KB.~~ Implementado: `React.lazy()` + `Suspense` em todas as rotas. Chunks isolados por rota. | ✅ Concluído 2026-06-02 |
| 2 | ~~**Error Boundary**~~ ✅ | ~~Se um componente quebra, o app inteiro morre (tela branca).~~ `ErrorBoundary.tsx` global implementado com fallback elegante e retry. | ✅ Concluído 2026-06-03 |
| 3 | ~~**Git config no WSL**~~ ✅ | ~~`user.name` e `user.email` não configurados.~~ Resolvido — commits com `Max <maxwellngg@gmail.com>`. | ✅ Resolvido |

### 🟡 Prioridade Média (quando houver tempo)

| # | Melhoria | Por quê | Quando |
|---|---|---|---|
| 4 | **README.md real** | Ainda é o template padrão do Vite ("React + Vite"). Deveria ter descrição do Arbo, como rodar, stack, screenshots. Importante para o GitHub ficar profissional. | Quando publicar |
| 5 | ~~**PWA (Progressive Web App)**~~ ✅ | ~~O Arbo é focado em corrida/mobile.~~ Implementado: `vite-plugin-pwa`, manifest, service worker Workbox, ícones custom. | ✅ Concluído 2026-06-04 |
| 6 | **SMTP externo** | Supabase gratuito limita 3-4 emails/hora (convites, recuperação de senha). Antes de produção, configurar Resend ou AWS SES para não travar convites. | Antes de lançar |
| 7 | **CSS unificado** | Mix de abordagens (global CSS em `index.css`, CSS Modules em `AlunoDashboard.module.css`, CSS em `Login.css`). Padronizar para CSS Modules em todos os componentes — mais organizado e sem conflito de nomes. | Refatoração geral |
| 8 | ~~**Ícone do app / Favicon**~~ ✅ | ~~Ainda usa o SVG padrão do Vite.~~ Ícone Arbo custom com logo, PNGs 192×192 e 512×512 em `public/icons/`. | ✅ Concluído 2026-06-04 |
| 9 | **Domínio customizado** | App no ar em arbo-weld.vercel.app. Apontar domínio próprio no Vercel para URL profissional ao compartilhar com alunos. | Antes de lançar |

### 🟢 Prioridade Baixa (futuro)

| # | Melhoria | Por quê | Quando |
|---|---|---|---|
| 9 | **Testes automatizados (Vitest)** | Zero testes. Adicionar Vitest + Testing Library para hooks e componentes críticos (auth, RLS, mutations). Evita quebrar o que já funciona. | Quando estabilizar |
| 10 | **CI/CD (GitHub Actions)** | Sem deploy automatizado. Configurar pipeline que roda `tsc + build + testes` a cada push e deploya automaticamente. | Produção |
| 11 | **Monitoramento (Sentry)** | Sem tracking de erros em produção. Quando alunos reais usarem, precisamos saber quando e onde o app quebra. | Pós-lançamento |
| 12 | **Otimização de imagens** | Assets (logo, hero) não otimizados. Converter para WebP + lazy loading. Melhora velocidade no celular. | Performance sprint |

---

*Este arquivo é compartilhado entre todos os agentes do time. Manter atualizado após cada sessão.*

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

### Task 47 (Security Headers)
- `vercel.json` — bloco `headers` adicionado preservando `rewrites` existente
- Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy configurados

**Notas finais 2026-06-06:** Média geral 8.4/10 (Segurança 8.2 · Performance 8.6 · Qualidade 8.8 · UX 8.5 · Arquitetura 8.0 · PWA 8.3)
**Próxima sessão:** Lighthouse audit · SMTP externo · CI/CD GitHub Actions · Vitest · README.md


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
- `.github/workflows/ci.yml` criado com lint, typescript e build em branches e PRs para master
- `npm test` integrado ao pipeline após Vitest ser instalado na Task 53
- Nota: push remoto de workflows requer PAT com escopo `workflow`

### Task 53 (Vitest + Testes Automatizados)
- Vitest instalado e configurado com `vitest.config.ts`
- 3 arquivos de teste criados (11 testes no total):
  - `auth.test.ts` — 4 testes de role/autenticação
  - `formatTime.test.ts` — 4 testes de formatação de tempo
  - `trainingUtils.test.ts` — 3 testes de labels e cores
- `npm test`: 11 passed, 0 failed

### Task 54 (README.md Profissional)
- `README.md` criado com descrição do Arbo, stack tecnológica, badges de status, setup local e métricas Lighthouse

### Task 59c (Fix navegação admin — 2026-06-11)
- `AnimatePresence mode="wait"` removido do `AdminLayout.tsx` — era a causa do delay de ~2s na troca de abas (exit animation bloqueava mount do novo componente + lazy load do chunk)
- `background-color: var(--bg-primary)` adicionado ao `.main` — elimina flash de fundo transparente no mount
- `overflow-y: scroll` → `auto` — elimina layout shift de scrollbar fantasma
- `@keyframes pageFadeIn 0.08s` — transição suave sem custo de exit
- Prefetch silencioso das 5 rotas admin no `useEffect` do `AdminLayout` — chunks JS baixados em background na primeira visita
- `useAdminAlunos.ts` + `useAdminTurmas.ts` — try/catch/finally adicionado; `isLoading` nunca trava em `true`

**Lição:** `AnimatePresence mode="wait"` + React.lazy é combinação perigosa — o "wait" força exit completa antes de o novo módulo sequer começar a montar/carregar. Para SPAs com code splitting, prefira CSS keyframes unidirecionais (só enter, sem exit).


### Task 55 (Modo Flexível de Turmas — Gemini + revisão Claude Code)
**Schema Supabase:**
- Tabela `schedules`: `id uuid PK, student_id uuid FK profiles, group_plan_training_id uuid FK group_plan_trainings, scheduled_day_of_week smallint CHECK(1-6), checkin_id uuid FK checkins NULL, completed_at timestamptz NULL, created_at, updated_at`
- `groups.mode text NOT NULL DEFAULT 'fixo' CHECK (mode IN ('fixo', 'flexivel'))`
- `group_plan_trainings.day_of_week` agora nullable (NULL = modo flexível sem dia fixo)
- RLS + GRANT SELECT, INSERT, UPDATE, DELETE para `schedules`
- `GroupMode = 'fixo' | 'flexivel'` — valores em português (correspondentes ao CHECK constraint)

**Frontend:**
- `useScheduling.ts` — hook CRUD de agendamentos (sem `any`, sem `window.confirm`)
- `scheduleUtils.ts` + `scheduleUtils.test.ts` — `getScheduleStatus()` + 11 testes (total: 22)
- `DayPicker.tsx` + `DayPicker.module.css` — bottom sheet para selecionar dia
- `FlexibleTrainingCard.tsx` + module — card de treino modo flexível com DayPicker integrado
- `ProfessorStatusGrid.tsx` — grid alunos × treinos com status (verde/laranja/cinza)
- `useWeeklyPlan.ts` — bifurcação fixo/flexível, busca schedules, `DayTraining.scheduleId`
- `AlunoDashboard.tsx` — renderiza `FlexibleTrainingCard` para modo 'flexivel', sort null-safe `(a.dayOfWeek ?? 99) - (b.dayOfWeek ?? 99)`
- `CheckinSheet.tsx` — planId `string | null`, atualiza `schedule.checkin_id` + `completed_at` após checkin
- `AdminTurmaDetail.tsx` — tab Status (ProfessorStatusGrid) + tab Treinos, modo flexível exibe lista simples
- `CreateGroupModal.tsx` + `EditGroupModal.tsx` — seletor modo fixo/flexível

**Correções críticas (Claude Code code review):**
- `GroupMode = 'fixed' | 'flexible'` → `'fixo' | 'flexivel'` (12 ocorrências em 6 arquivos) — evita rejeição silenciosa pelo CHECK constraint do DB
- `ProfessorStatusGrid` completamente reescrito (props corretas, query sem JOIN inválido, scheduleMap com chave `${student_id}-${group_plan_training_id}`)
- `useScheduling` reescrito (sem `any`, sem JOIN `training:trainings`, Supabase error via `.error`, sem `window.confirm`)
- CSS modules: `var(--surface)` → `var(--bg-surface)`, `#22c55e` → `var(--green-accent)`, etc.
- `tsc + lint + build + test`: 0 erros, 22 testes passando


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

**Notas Finais Sessão 2026-06-07:** Média geral 8.75/10 (Segurança 8.5 · Performance 8.7 · Qualidade 9.0 · UX 8.8 · Arquitetura 8.3 · PWA 8.5)
**Lighthouse Mobile:** Performance 96 · Accessibility 89 · Best Practices 100 · SEO 100
**Próximas tarefas:** 50+ testes Vitest · service layer `src/lib/api.ts` · Acessibilidade 89→95+ · security scan CI · Push notifications · Strava · Sentry



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
