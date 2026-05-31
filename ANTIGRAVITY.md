# 🌳 Arbo — Briefing do Time de IA

> Última atualização: 2026-05-31
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

### Estado atual (2026-05-31)
- **11 telas implementadas**, build e lint passando (`tsc --noEmit` ✅ · `npm run build` ✅ · `npm run lint` ✅ — 0 erros)
- Fase 1 (Auth + Schema + UI base): ✅ 100%
- Fase 2 (Admin Turmas + Planos + Perfil Aluno + Etiquetas + Controle de Liberação): ✅ 100%
- Fase 3 (Treinos + Chat + Progresso): 0%

### O que foi feito em 2026-05-31
- Perfil do Aluno (`/admin/alunos/:id`) implementado — 3 tabs (check-ins, recordes, anamnese), métricas, dropdown de turma, framer-motion.
- Sistema de Etiquetas Personalizadas (tabela `tags`, pills nos treinos, form inline com 8 cores). Lint zerado.
- Controle de Liberação do Plano — `released_through_week` no banco, chips S1–S4 com `✓`/`🔒` + banner de liberação no admin, `LockedScreen` no AlunoDashboard (boas-vindas, resumo da semana anterior, barra de ciclo).

### Próximo passo
**Painel Admin Fase 3:** `/admin/treinos` (biblioteca de treinos CRUD) ou Chat admin ↔ aluno.

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

## 🔍 Melhorias Identificadas pelo Antigravity (2026-05-31)

> Seção mantida pelo Antigravity. Cada melhoria identificada fica documentada aqui para o time avaliar e implementar no momento certo. O Claude Code pode ler esta seção e ajudar a priorizar ou implementar.

### 🔴 Prioridade Alta (fazer em breve)

| # | Melhoria | Por quê | Quando |
|---|---|---|---|
| 1 | **Code Splitting (lazy loading)** | Build gera chunk >500KB. Usar `React.lazy()` + `Suspense` nas rotas para dividir admin/aluno/login em bundles separados. Aluno nunca baixa código do admin, app abre mais rápido no celular. | Após concluir Fase 2 |
| 2 | **Error Boundary** | Se um componente quebra, o app inteiro morre (tela branca). Adicionar `ErrorBoundary` global + por seção (admin, aluno) para mostrar fallback amigável ao invés de quebrar tudo. | Próxima sessão |
| 3 | **Git config no WSL** | `user.name` e `user.email` não configurados — commits ficam sem autor identificado. Rodar `git config --global user.name "Maxwell"` e `git config --global user.email "email"`. | Antes do próximo push |

### 🟡 Prioridade Média (quando houver tempo)

| # | Melhoria | Por quê | Quando |
|---|---|---|---|
| 4 | **README.md real** | Ainda é o template padrão do Vite ("React + Vite"). Deveria ter descrição do Arbo, como rodar, stack, screenshots. Importante para o GitHub ficar profissional. | Quando publicar |
| 5 | **PWA (Progressive Web App)** | O Arbo é focado em corrida/mobile. Com PWA, o aluno instala no celular como se fosse app nativo — ícone na home, abre fullscreen, pode funcionar offline. Sem precisar de app store. | Fase 3 |
| 6 | **SMTP externo** | Supabase gratuito limita 3-4 emails/hora (convites, recuperação de senha). Antes de produção, configurar Resend ou AWS SES para não travar convites. | Antes de lançar |
| 7 | **CSS unificado** | Mix de abordagens (global CSS em `index.css`, CSS Modules em `AlunoDashboard.module.css`, CSS em `Login.css`). Padronizar para CSS Modules em todos os componentes — mais organizado e sem conflito de nomes. | Refatoração geral |
| 8 | **Favicon personalizado** | Ainda usa o SVG padrão do Vite. Criar ícone do Arbo (árvore/corrida) que apareça na aba do navegador e no PWA. | Design sprint |

### 🟢 Prioridade Baixa (futuro)

| # | Melhoria | Por quê | Quando |
|---|---|---|---|
| 9 | **Testes automatizados (Vitest)** | Zero testes. Adicionar Vitest + Testing Library para hooks e componentes críticos (auth, RLS, mutations). Evita quebrar o que já funciona. | Quando estabilizar |
| 10 | **CI/CD (GitHub Actions)** | Sem deploy automatizado. Configurar pipeline que roda `tsc + build + testes` a cada push e deploya automaticamente. | Produção |
| 11 | **Monitoramento (Sentry)** | Sem tracking de erros em produção. Quando alunos reais usarem, precisamos saber quando e onde o app quebra. | Pós-lançamento |
| 12 | **Otimização de imagens** | Assets (logo, hero) não otimizados. Converter para WebP + lazy loading. Melhora velocidade no celular. | Performance sprint |

---

*Este arquivo é compartilhado entre todos os agentes do time. Manter atualizado após cada sessão.*
