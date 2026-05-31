# Arbo — Documentação Fase 2

> Gerado em 2026-05-29 | Atualizado em 2026-05-31 (sessão 4)

---

## Estado atual (2026-05-31)

| Área | Status |
|------|--------|
| Schema + RLS | ✅ 15 tabelas, enums, triggers, policies, GRANTs |
| Auth stack | ✅ AuthContext, rotas protegidas por role, convite via Edge Function |
| Dashboard do Aluno `/aluno` | ✅ Dados reais, redesign premium (Bebas Neue, glow, bottom sheet, skeleton, PR tracking) |
| Painel Admin Fase 1 | ✅ AdminLayout, AdminHome, AdminAlunos, AdminFeedbacks, AdminConvites |
| Schema Fase 2 | ✅ `profiles.role`, `profiles.group_id`, tabela `groups` com RLS |
| `/admin/turmas` lista | ✅ Hook `useAdminTurmas`, componente `AdminTurmas`, sidebar ativada |
| `/admin/turmas/:id` | ✅ Completo: componente, rota, TurmaRow clicável, fallback aluno, build |
| `/admin/alunos/:id` | ✅ Perfil completo do aluno, histórico, PRs e design premium |
| Sistema de Etiquetas | ✅ Tabela `tags`, pills coloridas nos cards, form inline com 8 cores |
| Controle de Liberação | ✅ `released_through_week`, chips admin `✓`/`🔒`, `LockedScreen` no aluno |
| **Lint** | ✅ `npm run lint` → 0 erros, 0 warnings (2026-05-31) |

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

#### Chat admin ↔ aluno (MVP)
- Texto simples
- Histórico completo salvo
- Admin e aluno podem excluir mensagens individualmente
- Notificação no app quando chegar mensagem nova
- Foco em: dúvidas, consultoria, observações sobre treino

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

## Fase 3 — Pendente

| Tela | Descrição |
|------|-----------|
| `/admin/treinos` | Biblioteca de treinos — CRUD completo |
| Mensagem direta | Campo já na Fase 2, evolução na Fase 3 |
| `/aluno/progresso` | Histórico, recordes, gráfico de pace |
| `/aluno/perfil` | Dados pessoais, Strava, logout |

---

## Telas do Aluno — Pendentes

| Tela | Descrição |
|------|-----------|
| `/aluno/progresso` | Histórico de check-ins, recordes pessoais (5km, 10km...), gráfico de evolução de pace |
| `/aluno/perfil` | Dados pessoais, conexão Strava, logout |

---

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
1. ✅ Schema: coluna role + group_id + tabela groups
2. ✅ /admin/turmas — lista
3. ✅ /admin/turmas/:id — grid plano mensal + toggle semana/mês
4. ✅ Sistema de etiquetas personalizadas
5. ✅ Controle de liberação do plano (por semana ou tudo de uma vez)
6. ✅ /admin/alunos/:id — perfil do aluno
7. Chat admin ↔ aluno
8. Notificações de PR no painel
```

---

*Documento gerado com base nas respostas do professor e alinhamento de produto.*
*Atualizado em 2026-05-30 com progresso da sessão.*
