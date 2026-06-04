# 🌳 Arbo — Briefing do Time de IA

> Última atualização: 2026-06-04
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

### Estado atual (2026-06-03)
- **App publicado:** **https://arbo-weld.vercel.app** (Vercel, SPA routing)
- **23+ telas/features implementadas**, build e lint passando (`tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` ✅ — 0 erros)
- Fase 1 (Auth + Schema + UI base): ✅ 100%
- Fase 2 (Admin Turmas + Planos + Perfil Aluno + Etiquetas + Controle de Liberação + Nova Turma + Filtros + Invites): ✅ 100%
- Fase 3 (Treinos + Chat + Progresso + Perfil + PRs + Error Boundary + Code Splitting): ✅ **100%**

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

### O que foi feito em 2026-06-04
- **Correções UX Mobile** (Gemini): `overscroll-behavior: none` + `overflow: hidden` em `html/body` (elimina bounce iOS); `maximum-scale=1.0, user-scalable=no` no viewport (bloqueia zoom indesejado); `#root` com `height: 100dvh` + `overflow-y: auto` + `-webkit-overflow-scrolling: touch`. tsc + lint: 0 erros ✅
- **PWA Completo** (Gemini + fix Claude Code): `vite-plugin-pwa` instalado; manifest com nome, cores e ícones do Arbo; ícone SVG custom "A" em laranja `#E8521A`; PNGs 192×192 e 512×512; service worker Workbox com precache de 29 entradas; meta tags iOS (`apple-touch-icon`, `viewport-fit=cover`); fix Claude Code: removidos `manifest.json` redundante, `icons.svg` de template e `vite.config.js` duplicado. tsc + build + lint: 0 erros ✅
- **Responsividade Mobile** (Gemini): Menu hamburguer no painel admin com sidebar drawer animado; tabelas scrolláveis horizontalmente; `flexWrap` nos forms; media queries para `AdminAlunoDetail`; safe area inset no perfil do aluno; fix do container recharts no progresso. tsc + lint: 0 erros ✅
- **Login redesign premium + ícones PWA + EditGroupModal** (Gemini + fix Claude Code): `Login.tsx`/`Login.css` reescritos com glassmorphism, glow laranja, logo Arbo e ícones lucide; novos ícones PWA com arbo-logo em `public/icons/`; header da turma reformulado com breadcrumb + pills de metadados + botão "Editar"; `EditGroupModal.tsx` (novo) para editar dados da turma; `vite.config.js` redundante removido (Claude Code). tsc + lint: 0 erros ✅
- **Ajustes visuais no grid da semana, vista mês e ícones PWA** (Gemini): `AdminTurmaDetail.tsx` — `minHeight: '70vh'` no grid, `flex: 1` + `flexDirection: column` em colunas e células para crescimento proporcional na vista mês. Ícones `icon-192.png` e `icon-512.png` com proporção da árvore melhorada. tsc + lint: 0 erros ✅
- **Correção do header mobile e reversão da altura do grid** (Gemini): `AdminTurmaDetail.tsx` — header refatorado para `flexDirection: 'column'` (linha de navegação+toggle separada do bloco da turma); título com `clamp(18px, 5vw, 24px)`; pills de metadados com `flexWrap: 'wrap'`; botão "Editar" integrado como pill (`marginLeft: 'auto'`); `minHeight: '70vh'` revertido (causava altura excessiva na vista de treinos). tsc + lint: 0 erros ✅
- **Convites e Error Boundary** (Antigravity): `invite-user` com fallback para reset de senha (re-convite infinito); `useInvite` usando `window.location.origin`; ErrorBoundary com auto-reload para `Failed to fetch dynamically imported module`; Tela de Sucesso premium em `SetPassword.tsx`. tsc + lint: 0 erros ✅

### O que foi feito em 2026-06-03
- **Deploy no Vercel:** App publicado em **https://arbo-weld.vercel.app** com SPA routing via `vercel.json`
- **Implementação em Paralelo** (Antigravity + Subagentes):
  - **Nova Turma:** `CreateGroupModal.tsx` — modal com form (nome, objetivo, frequência, tipo de plano, data de início); cria registro na tabela `groups`; botão `+ Nova Turma` em `AdminTurmas.tsx`
  - **Error Boundary:** `ErrorBoundary.tsx` — class component global com fallback elegante e botão "Tentar novamente"; integrado em `App.tsx` envolvendo todas as rotas
  - **Tabela `invites`:** criada no Supabase (id, email, role, status, invited_by, created_at) com RLS + policies + GRANT; Edge Function `invite-user` registra no banco; `AdminConvites.tsx` exibe log completo
  - **Filtros em Alunos:** busca por nome + filtro por Turma (dinâmico, vem do banco) e Nível; filtragem via `useMemo` sobre lista local em `AdminAlunos.tsx`
- **Types regenerados:** `database.types.ts` atualizado com tabela `invites` após criar no Supabase
- **Fix de lint (Claude Code):** `AdminConvites.tsx` — `useEffect` refatorado para `async function load()` com `cancelled` flag

### Próximo passo
- Integração Strava (Edge Function via n8n)
- Domínio customizado no Vercel

---

## Arquivos de contexto do time

| Arquivo | Quem lê | Conteúdo |
|---|---|---|
| `CLAUDE.md` | Claude Code | Regras técnicas, padrões Supabase, estado atual, roadmap |
| `GEMINI.md` | Gemini | Mesmo conteúdo adaptado |
| `ANTIGRAVITY.md` | Antigravity + Claude Code | Este arquivo — briefing do time, fluxo de trabalho, preferências |
| `ARBO_FASE2.md` | Todos | Documentação de produto completa (Fase 2 e 3) |

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
