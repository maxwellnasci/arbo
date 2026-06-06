# Arbo — Documentação Fase 2

> Gerado em 2026-05-29 | Atualizado em 2026-06-06 (sessão 13)
> Histórico detalhado de sessões: [CLAUDE_HISTORICO.md](CLAUDE_HISTORICO.md)

---

## Estado atual (2026-06-06)

| Área | Status |
|------|--------|
| Schema + RLS | ✅ 17 tabelas (`invites` adicionada), enums, triggers, policies, GRANTs |
| Auth stack | ✅ AuthContext, rotas protegidas por role, convite via Edge Function + log na tabela `invites` |
| Dashboard do Aluno `/aluno` | ✅ Dados reais, redesign premium (Bebas Neue, glow, bottom sheet, skeleton, PR tracking) |
| Painel Admin Fase 1 | ✅ AdminLayout, AdminHome, AdminAlunos, AdminFeedbacks, AdminConvites |
| Schema Fase 2 | ✅ `profiles.role`, `profiles.group_id`, tabela `groups` com RLS |
| `/admin/turmas` lista | ✅ Hook `useAdminTurmas`, componente `AdminTurmas`, sidebar ativada |
| `/admin/turmas/:id` | ✅ Completo: componente, rota, TurmaRow clicável, fallback aluno, build |
| `/admin/alunos/:id` | ✅ Perfil completo do aluno, histórico, PRs e design premium |
| Sistema de Etiquetas | ✅ Tabela `tags`, pills coloridas nos cards, form inline com 8 cores |
| Controle de Liberação | ✅ `released_through_week`, chips admin `✓`/`🔒`, `LockedScreen` no aluno |
| `/admin/treinos` | ✅ CRUD completo + visual dark refinado (pills de tipo, inline styles, padrão do projeto) |
| Chat Admin ↔ Aluno | ✅ Tabela `messages` (RLS + Realtime), SidePanel Admin, Aba Chat no Aluno, Framer Motion |
| `/aluno/progresso` — Aba Progresso | ✅ `AlunoProgresso.tsx`, `useProgresso.ts`, gráfico recharts 2.x, recordes pessoais, histórico, streak |
| `/aluno/perfil` — Aba Perfil | ✅ `AlunoPerfil.tsx`, `useAlunoPerfil.ts`, avatar, dados pessoais, Strava placeholder, logout |
| Notificações de PR no admin | ✅ `AdminPRFeed.tsx`, `useAdminPRs.ts`, feed de recordes recentes no `AdminHome` |
| Botão Nova Turma | ✅ `CreateGroupModal.tsx` funcional, cria registro em `groups` |
| Error Boundary global | ✅ `ErrorBoundary.tsx` com fallback elegante e retry, envolvendo todas as rotas |
| Tabela `invites` + log | ✅ Schema no Supabase, RLS, Edge Function atualizada, log visível em `/admin/convites` |
| Filtros em `/admin/alunos` | ✅ Busca por nome + filtro por Turma (dinâmico) e Nível |
| **Deploy** | ✅ **https://arbo.mxos.com.br** (Vercel, SPA routing) |
| **Responsividade Mobile** | ✅ Menu hamburguer no admin, sidebar drawer, tabelas scrolláveis, safe area, fix recharts (2026-06-04) |
| **PWA Completo** | ✅ `vite-plugin-pwa`, ícone custom "A" em laranja, service worker Workbox, meta tags iOS/Android (2026-06-04) |
| **Correções UX Mobile** | ✅ Bounce iOS eliminado, zoom bloqueado, layout `100dvh` com scroll nativo (2026-06-04) |
| **Login redesign premium** | ✅ Glassmorphism, logo Arbo, glow laranja, ícones lucide, botão com gradiente (2026-06-04) |
| **Ícones PWA com logo Arbo** | ✅ `public/icons/icon-192.png` e `icon-512.png`, `vite.config.ts` atualizado (2026-06-04) |
| **Modal edição de turma** | ✅ `EditGroupModal.tsx` — editar nome, objetivo, frequência, tipo de plano e status (2026-06-04) |
| **Header da turma** | ✅ Breadcrumb + pills de metadados (objetivo, frequência, status) + botão Editar (2026-06-04) |
| **Header mobile da turma + reversão do grid** | ✅ Header em `flexDirection: column`, título `clamp(18px, 5vw, 24px)`, pills com `flexWrap: wrap`, botão Editar integrado como pill; `minHeight: '70vh'` revertido no grid (2026-06-04) |
| **Convites e UX Premium** | ✅ Reenvio de convites via fallback (reset senha), Error Boundary com auto-reload, Tela de Sucesso no SetPassword (2026-06-04) |
| **Correções qualidade + segurança** | ✅ 16 fixes (padrões async/catch, `as any`, código morto) + Open Redirect em `invite-user` corrigido com `new URL()` (2026-06-04) |
| **Domínio customizado** | ✅ **https://arbo.mxos.com.br** (2026-06-04) |
| **Lint** | ✅ `npm run lint` → 0 erros, 0 warnings (2026-06-04) |
| **Fase 3** | ✅ **100% completa** |
| **Redesign Premium Admin (Fase 5)** | ✅ AdminLayout com avatar+tema, todas as telas admin com CSS vars semânticas, dark/light mode (2026-06-05) |
| **Redesign Premium Aluno (Fase 5)** | ✅ AlunoDashboard, AlunoProgresso, AlunoPerfil, AlunoChat, CheckinSheet e LockedScreen extraídos (2026-06-05) |
| **DESING.md** | ✅ Design system completo na raiz: paleta, tipografia, variáveis CSS, animações (2026-06-05) |
| **10 bugs pós-redesign** | ✅ var(--text-h), classes CSS deletadas, cycleBarFuture, chat offset, handleDelete, setTimeout, overflow, null safety (2026-06-05) |
| **Lint pós-redesign** | ✅ `npm run lint` → 0 erros, 0 warnings (2026-06-05) |
| **CLAUDE.md dividido** | ✅ `CLAUDE.md` (referência técnica) + `CLAUDE_HISTORICO.md` (histórico completo de sessões) (2026-06-05) |
| **Toggle liberação semanal (bug fix)** | ✅ Chips S1–S4 agora bidirecionais: permite bloquear semanas já liberadas. Lógica: `w === current ? w-1 : w` (2026-06-05) |
| **Exclusão de aluno** | ✅ Edge Function `delete-user` (JWT admin, service_role, CORS allowlist) + modal de confirmação em `AdminAlunoDetail` (2026-06-05) |
| **7 índices SQL de performance** | ✅ `checkins(student_id)`, `records(student_id)`, `records(achieved_at DESC)`, `group_plans(group_id, starts_at)`, `group_plan_trainings(group_plan_id)`, `messages(student_id)`, `profiles(role)` — criados no Supabase (2026-06-05) |
| **Relatório de performance** | ✅ N+1 em `useAdminAlunoDetail`, select wildcard, checkins sem limit, query strava_connections, layout shift logo — **correções no código pendentes** (2026-06-05) |
| **Sistema de Etiquetas/Tipos inline (Task 36)** | ✅ Tabela `training_types` (RLS + UNIQUE), `trainings.type` migrado para `text`, criação inline no formulário de treino, painel de gerenciamento em `/admin/treinos` (2026-06-05) |
| **10 correções sistema etiquetas/tipos (Task 37)** | ✅ `trainingUtils.ts` extraído, CSS vars, cancelled flag, UNIQUE constraint, `is_custom` filter, branded union `TrainingType`, mutations no pai (2026-06-05) |
| **Fix "Unexpected Application Error!" (Task 38)** | ✅ `RouterErrorElement` como `errorElement` na rota raiz do `createBrowserRouter` — chunk errors → auto-reload com guard `sessionStorage`; outros erros → tela amigável. Root cause: data router API captava erros antes do `ErrorBoundary` externo (2026-06-06) |
| **5 Melhorias DeepSeek (Task 39)** | ✅ RLS messages, remoção de select(*), paralelizar turmaDetail com Deep Joins, ConfirmModal premium em AdminTreinos, Workbox runtimeCaching + offline.html (2026-06-06) |
| **Limpeza Perf/Qualidade (Task 40)** | ✅ Mais 10 `select('*')` removidos, mitigação N+1 no `changeGroup` (resolução em RAM), ConfirmModal adaptado ao Design System com `--red-accent` nativo e PWA Manifest limpo de falsas imagens (2026-06-06) |

**Repositório:** https://github.com/maxwellnasci/arbo

---

## Fase 2 — Visão Geral

### 1. Schema — ✅ CONCLUÍDO (2026-05-30)

#### Coluna `role` em `profiles` ✅
- Adicionada com `CHECK ('aluno'|'admin')`
- Backfill de usuários existentes via `app_metadata`
- Trigger `tr_set_profile_role` (BEFORE INSERT) popula para novos usuários

#### Coluna `group_id` em `profiles` ✅
- FK nullable para `groups.id`, `ON DELETE SET NULL`

#### Tabela `groups` ✅
- Campos: `id`, `name`, `goal`, `frequency`, `plan_type`, `starts_at`, `is_active`, `created_at`, `updated_at`
- RLS habilitado: admin (tudo), aluno (SELECT de ativas)
- GRANT: SELECT, INSERT, UPDATE, DELETE para `authenticated`
- Trigger `update_groups_updated_at`

---

### 2. Telas do Painel Admin

#### `/admin/turmas` ✅ CONCLUÍDO (2026-05-30)
- Lista todas as turmas com nome, objetivo, frequência, plano, status e nº de alunos
- Hook `useAdminTurmas` com `GroupWithCount` e duas queries paralelas
- Botão "+ Nova Turma" presente (desabilitado — aguarda modal)

#### `/admin/turmas/:id` ✅ CONCLUÍDO (2026-05-30)
- Schema: `group_plans` + `group_plan_trainings` com RLS, policies, GRANTs
- Tipos: `GroupPlan`, `GroupPlanTraining` em `src/lib/types.ts`
- Hook `useAdminTurmaDetail` — fetch do grupo, cálculo do ciclo de 4 semanas, trainings do ciclo
- Hook `useGroupPlanMutations` — addTraining, removeTraining, createAndAddTraining (com `ensureGroupPlan` lazy)
- Página `AdminTurmaDetail.tsx` — WeekView (‹›, 6 colunas, dots), MonthView (4 semanas compactas), SidePanel (busca/criação/remoção), CreateTrainingForm
- `App.tsx` — rota `turmas/:id` registrada + import de `AdminTurmaDetail`
- `AdminTurmas.tsx` — `TurmaRow` clicável com `useNavigate` + seta `›`
- `useWeeklyPlan.ts` — fallback: aluno sem plano individual usa plano da turma
- `npm run build` ✅

**Spec:** `docs/superpowers/specs/2026-05-30-turma-detail-design.md`  
**Plano:** `docs/superpowers/plans/2026-05-30-turma-detail.md`

Grid do plano mensal:
- Visualização por **semana** (padrão) ou **mês** (toggle)
- Professor monta treinos diretamente no app (cria ou reutiliza da biblioteca)
- Ciclo de 4 semanas calculado automaticamente a partir de `groups.starts_at`
- Controle de liberação: ✅ `released_through_week`, chips S1–S4, banner admin, `LockedScreen` aluno

#### `/admin/alunos/:id` ✅ CONCLUÍDO
- Perfil completo do aluno renderizado com métricas agregadas
- Histórico de check-ins detalhado e records pessoais
- Anamnese exposta em UI amigável
- Modificação de turma no próprio perfil (select)

---

### 3. Sistema de Treinos

#### Tipo do treino
Campo `tipo` em cada treino:
- **Grupo** — treino base aplicado à turma
- **Individual** — treino ajustado para um aluno específico

Identificação visível no card do treino tanto no admin quanto no app do aluno.

#### Etiquetas personalizadas (MVP)
- Admin cria suas próprias etiquetas
- Exemplos: `Fase de Base`, `Semana de Choque`, `Pico de Volume`, `Semana de Teste`
- Etiqueta aparece no card do treino do aluno
- Aluno entende o contexto do ciclo sem precisar perguntar

#### Lógica de ciclos
- Ciclos de **4 semanas fixas**
- No plano grupo: sem ajuste no meio do ciclo — mudanças só na próxima planilha
- No plano individual: professor tem mais flexibilidade para ajustar

---

### 4. Experiência do Aluno no Plano

#### Visualização toggle
- Botão na tela alterna entre **Mês** e **Semana**
- Disponível tanto no app do aluno quanto no painel do admin
- Padrão sugerido: vista por semana (foco no imediato)

#### Flexibilidade
- Aluno pode mudar o **dia** do treino na semana
- Aluno pode mudar o **treino em si**
- Na prática, como o professor passa passo a passo, o aluno tende a seguir — a liberdade existe mas o contexto guia

#### Inscrição
- No cadastro, aluno escolhe:
  - Objetivo: `5k | 10k | 21k | evoluir 10k | evoluir 21k`
  - Frequência: `2x` ou `3x` por semana
  - Plano: grupo (valor acessível) ou individual (valor premium)

---

### 5. Sistema de Mensagens

#### Chat admin ↔ aluno (MVP) - ✅ CONCLUÍDO
- Texto simples
- Histórico completo salvo
- Admin e aluno podem excluir mensagens individualmente (soft delete)
- UI Premium com glassmorphism e micro-animações
- Tempo real via Supabase Realtime

#### Regras de retenção (a definir)
- Possibilidade futura: mensagens expiram conforme o plano do aluno
- MVP: histórico completo sem expiração

---

### 6. Notificações (MVP)

| Evento | Onde aparece |
|--------|-------------|
| Aluno bate PR | Badge/contador no menu do admin |
| Nova mensagem | Notificação no app |
| Aluno finalizou planilha | Painel admin (resumo semanal) |

---

## Fase 3 — ✅ CONCLUÍDA (2026-06-02)

| Tela | Descrição |
|------|-----------|
| `/admin/treinos` | ~~Biblioteca de treinos — CRUD completo + visual dark refinado~~ ✅ |
| Mensagem direta | ~~Chat admin ↔ aluno — schema: tabela `messages`~~ ✅ |
| ~~`/aluno/progresso`~~ | ~~Histórico, recordes, gráfico de pace~~ ✅ |
| ~~`/aluno/perfil`~~ | ~~Dados pessoais, Strava placeholder, logout~~ ✅ |
| ~~Notificações de PR~~ | ~~Feed de recordes recentes no `AdminHome`~~ ✅ |

---

## Telas do Aluno — Concluídas

| Tela | Descrição |
|------|-----------|
| ~~`/aluno/progresso`~~ | ~~Histórico de check-ins, recordes pessoais (5km, 10km...), gráfico de evolução de pace~~ ✅ |
| ~~`/aluno/perfil`~~ | ~~Dados pessoais, conexão Strava, logout~~ ✅ |

---

## Próximos Passos Imediatos

| Prioridade | Item | Descrição |
|-----------|------|-----------|
| ~~🔴 Alta~~ | ~~**Ícone do app / favicon**~~ | ✅ Concluído — ícones com logo Arbo, PNGs 192×192 e 512×512 em `public/icons/` |
| ~~🔴 Alta~~ | ~~**PWA completo**~~ | ✅ Concluído — `vite-plugin-pwa`, service worker Workbox, instalável |
| ~~🔴 Alta~~ | ~~**Login redesign premium**~~ | ✅ Concluído — glassmorphism, logo, glow, lucide icons, gradiente |
| ~~🔴 Alta~~ | ~~**Modal edição de turma**~~ | ✅ Concluído — `EditGroupModal.tsx`, header da turma reformulado |
| ~~🟡 Média~~ | ~~**Domínio customizado**~~ | ✅ arbo.mxos.com.br (2026-06-04) |
| ~~🔴 Alta~~ | ~~**Toggle liberação semanal (bug fix)**~~ | ✅ Chips S1–S4 bidirecionais (2026-06-05) |
| ~~🔴 Alta~~ | ~~**Exclusão de aluno**~~ | ✅ Edge Function + modal de confirmação (2026-06-05) |
| ~~🔴 Alta~~ | ~~**Correções de performance no código**~~ | ✅ Concluído nas Tasks 39, 40 e 41 (N+1, limit, select wildcard, layout shift logo) |
| 🟡 Média | **Etiquetas + tipos inline nos formulários de treino** | Botão de seleção de etiqueta e tipo integrado inline no form de criação/edição de treino |
| 🟡 Média | **Integração Strava** | Edge Function via n8n para OAuth + importação de atividades |
| 🟢 Baixa | **SMTP externo** | Resend ou AWS SES para não travar com limite de 3-4 emails/hora do Supabase gratuito |

## Futuro — Base já estruturada no MVP

| Feature | Descrição |
|---------|-----------|
| Integração Strava | IA analisa desempenho e organiza evolução do aluno automaticamente |
| Push notification | PR e mensagens chegam no celular do professor |
| Import de planilha | Professor importa plano do Excel direto pro app |
| Etiquetas avançadas | Sistema de tags mais elaborado com cores e categorias |
| Mensagens por plano | Disponibilidade e histórico variam conforme o plano contratado |

---

## Contexto do Negócio

- **Foco do app:** corrida (não força, mesmo que o professor atenda os dois)
- **Modelo de turmas:** grupos por nível — 5k, 10k, 21k, evoluir 10k, evoluir 21k
- **Filosofia:** personalização dentro do grupo — não impõe, favorece a experiência do aluno
- **Check-in:** professor confia no registro do aluno, sem aprovação manual
- **Feedback:** professor acompanha feedbacks no app e treinos pelo Strava quando quiser
- **LGPD:** admin pode editar dados do aluno com consentimento, para fins legítimos de prestação de serviço

---

## Ordem de desenvolvimento

```
1.  ✅ Schema: coluna role + group_id + tabela groups
2.  ✅ /admin/turmas — lista
3.  ✅ /admin/turmas/:id — grid plano mensal + toggle semana/mês
4.  ✅ Sistema de etiquetas personalizadas
5.  ✅ Controle de liberação do plano (por semana ou tudo de uma vez)
6.  ✅ /admin/alunos/:id — perfil do aluno
7.  ✅ /admin/treinos — biblioteca de treinos CRUD + visual dark refinado
8.  ✅ Chat admin ↔ aluno (Tabela messages, RLS, Realtime, interface premium)
9.  ✅ /aluno/progresso — Aba Progresso (histórico, recordes, gráfico recharts, streak)
10. ✅ /aluno/perfil — Aba Perfil (dados pessoais, Strava placeholder, logout)
11. ✅ Notificações de PR no painel (AdminPRFeed, feed de recordes recentes)
12. ✅ Code Splitting (React.lazy + Suspense em todas as rotas)
13. ✅ Deploy no Vercel (arbo.mxos.com.br)
14. ✅ Botão Nova Turma (CreateGroupModal)
15. ✅ Error Boundary global (ErrorBoundary.tsx)
16. ✅ Tabela invites + log em /admin/convites
17. ✅ Filtros em /admin/alunos (nome + turma + nível)
18. ✅ Ajustes visuais no grid da semana, vista mês e proporção dos ícones PWA
19. ✅ Correção responsividade mobile do header da turma + reversão da altura do grid
20. ✅ Reenvio infinito de convites (fallback reset senha), Auto-reload no ErrorBoundary e Tela de Sucesso Premium
21. ✅ Correções de qualidade e segurança pós-análise dupla (DeepSeek + Claude Code): 16 fixes de padrões async/catch/tipos + Open Redirect em invite-user + domínio arbo.mxos.com.br
22. ✅ Refinamento Visual Global + Modo Claro/Escuro (Fase 5): Migração para variáveis CSS, criação de paleta Light Mode sem branco puro, header com Avatar Menu e Tema Persistente em localStorage.
23. ✅ Redesign Premium completo do Painel Admin (Fase 5): AdminLayout com avatar menu + toggle tema, CSS vars em todas as telas admin. DESING.md criado com design system completo.
24. ✅ Redesign Premium completo do App do Aluno (Fase 5): AlunoDashboard, AlunoProgresso, AlunoPerfil, AlunoChat + CheckinSheet e LockedScreen extraídos como componentes. CSS vars semânticas dark/light.
25. ✅ 10 bugs pós-redesign corrigidos: var(--text-h) indefinida, classes CSS deletadas, cycleBarFuture ausente, chat offset, handleDelete sem error handling, setTimeout sem cleanup, error handling em queries admin, hardcoded colors, overflow do chart, null safety no toUpperCase().
26. ✅ CLAUDE.md dividido em `CLAUDE.md` (técnico) + `CLAUDE_HISTORICO.md` (histórico de sessões). Todos os agentes devem ler ambos.
27. ✅ Bug fix: toggle bidirecional de liberação semanal — `useGroupPlanMutations` aceita `0|1|2|3|4`; `AdminTurmaDetail` com `handleChipClick` para toggle; chips S1–S4 permitem bloquear semanas já liberadas.
28. ✅ Feature: Exclusão de aluno — Edge Function `delete-user` (Deno, service_role, CORS allowlist, anti-auto-exclusão); `AdminAlunoDetail` com zona de perigo, botão Trash2, modal de confirmação, toast + redirect.
29. ✅ Performance: Relatório completo (8 achados) + 7 índices SQL criados no Supabase. Correções no código (N+1, limit, select wildcard) pendentes para próxima sessão.
30. ✅ Task 41 — Refatoração de Qualidade: select explícito em useAdminTreinos/useTreinoMutations; 25+ hex hardcoded → CSS vars em AdminTurmaDetail; suporte a Light Mode estendido para ErrorBoundary/ProtectedRoute/PageLoader/RouterErrorElement/SetPassword; e tipos explícitos DBGroupPlan/DBGroupPlanTraining em useAdminTurmaDetail.
31. ✅ Task 42 — Correção de Micro-residuais: ErrorBoundary hover (#d14312 → var(--orange)), SetPassword (#ff6b6b → var(--red-accent)), ConfirmModal (subtleMap para backgrounds, sombra var(--shadow-modal)), App.tsx (sombra var(--shadow-card)), index.css (centralização de shadows).

---

## Fase 5 — Tema Claro/Escuro & Refinamento Visual (2026-06-05)

| Tarefa | Descrição | Status |
|--------|-----------|--------|
| **Variáveis CSS Semânticas** | Refatoração do `index.css` para padronizar tokens (`--bg-surface`, `--text-primary`, etc) e dar suporte a múltiplos temas. | ✅ Concluído |
| **Paleta Light Mode** | Definição de `[data-theme="light"]` evitando fundo branco puro e utilizando contrastes dinâmicos e tons de laranja/verde sutis nos backgrounds de painéis. | ✅ Concluído |
| **Header Admin Renovado** | Remoção do hamburger menu legado, inclusão do logo minimalista árvore + texto Arbo e menu interativo via Avatar para Logout/Tema. | ✅ Concluído |
| **Persistência de Tema** | Estado do tema salvo localmente via `localStorage` para UX contínua. | ✅ Concluído |
| **Limpeza de Hardcoded Colors** | Adaptação de `AdminTurmaDetail` (Grid Painel da Semana) e `AdminPRFeed` para usar variáveis, corrigindo bugs de contraste no Modo Claro. | ✅ Concluído |

---

## Notas Finais da Sessão 2026-06-06
- **Nota final do projeto:** 7.9/10 (subiu de 6.9 para 7.9 na sessão) — Meta: 8.5+ de média geral.
- **Tasks 39-42 concluídas**
- **Planejamento da Próxima Sessão:**
  - Migrar os estilos inline/CSS remanescentes para **CSS Modules**: `Login.css`, `AdminChatPanel.module.css`, `CreateGroupModal.tsx`, `EditGroupModal.tsx`, `AnamnesisForm.tsx`, `TreinoCard.tsx`, `AlunoDashboard.module.css`.
  - Otimizar filtro server-side no Deep Join (`useAdminTurmaDetail.ts`).
  - Adicionar `limit()` nas queries sem paginação.
  - Executar auditoria de performance e PWA via Lighthouse para identificar oportunidades de otimização de velocidade e SEO.

---

*Documento gerado com base nas respostas do professor e alinhamento de produto.*
*Atualizado em 2026-06-06 com documentação da Task 42 e notas finais da sessão.*

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

