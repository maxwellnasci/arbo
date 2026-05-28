# Painel Admin — Spec de Design

**Data:** 2026-05-27  
**Projeto:** Arbo — app de corrida CrossFit  
**Escopo:** Painel do professor (`/admin`) completo em 3 fases

---

## Contexto

O professor usa planejamento mensal (ciclos de 4 semanas), atende alunos em dois modelos:
- **Grupo** (mais barato): aluno escolhe frequência (2x ou 3x/semana) e objetivo (5km, 10km, 21km). Todos do grupo seguem o mesmo plano mensal.
- **Individual** (premium): plano customizado por aluno.

O professor confia no auto-relato dos alunos (não precisa aprovar check-ins), acompanha feedbacks e quer ser notificado quando um aluno bate recorde pessoal. Mensagem direta ao aluno é bem-vinda se for simples.

O `AdminDashboard` atual (`src/pages/admin/AdminDashboard.tsx`) é um stub com apenas o formulário de convite. Toda a estrutura será reconstruída.

---

## Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Dispositivo | Responsivo | Desktop para criar planos; mobile para acompanhar feedbacks e PRs |
| Navegação | Sidebar fixa (desktop) / drawer hambúrguer (mobile) | Padrão de admin panel, escala com múltiplas seções |
| Modelo de grupos | Turmas explícitas (`groups` table) | Reflete o modelo de negócio do professor; uma turma tem um plano, aluno pertence a uma turma |
| Build | Faseado com navegação estável | Sidebar completa desde o início; seções futuras marcadas como "em breve" |

---

## Estrutura de Navegação

### Sidebar (desktop: 240px fixo | mobile: drawer 260px)

```
ARBO
Painel do Professor
─────────────────
⬛ Início          /admin
👥 Alunos          /admin/alunos
🏃 Turmas          /admin/turmas        [Fase 2]
💪 Treinos         /admin/treinos       [Fase 3]
💬 Feedbacks       /admin/feedbacks
─────────────────
prof@arbo.app
Sair
```

Seções marcadas `[Fase 2/3]` aparecem na sidebar com cor atenuada e badge "em breve". Clique mostra placeholder informativo.

### Rotas completas

| Rota | Componente | Fase |
|---|---|---|
| `/admin` | `AdminHome` | 1 |
| `/admin/alunos` | `AdminAlunos` | 1 |
| `/admin/feedbacks` | `AdminFeedbacks` | 1 |
| `/admin/convites` | `AdminConvites` | 1 |
| `/admin/turmas` | `AdminTurmas` | 2 |
| `/admin/turmas/:id` | `AdminTurmaDetalhe` | 2 |
| `/admin/alunos/:id` | `AdminAlunoDetalhe` | 2 |
| `/admin/treinos` | `AdminTreinos` | 3 |

---

## Schema — Mudanças no Banco

### Fase 1 — sem mudanças

Usa tabelas existentes: `profiles`, `checkins`, `records`.

### Fase 2 — nova tabela `groups`

```sql
CREATE TABLE groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,                          -- ex: "5km · 3x/semana"
  objective   distance_category NOT NULL,             -- enum: '5km' | '10km' | '21km' | ...
  frequency   smallint NOT NULL CHECK (frequency IN (2, 3)),  -- treinos/semana
  admin_id    uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN group_id uuid REFERENCES groups(id);
```

- RLS habilitado; apenas admin lê/escreve `groups`
- `profiles.group_id` nullable: null = aluno individual (plano próprio)
- `weekly_plans` continua com `student_id`; na Fase 2 o admin cria `weekly_plans` linkados a todos os `profiles` de uma turma de uma vez (atribuição em lote)

### Fase 2 — nova tabela `invites`

```sql
CREATE TABLE invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  sent_at    timestamptz DEFAULT now(),
  accepted_at timestamptz
);
```

Gerenciada pela Edge Function `invite-user` (INSERT ao enviar). RLS: somente admin lê e escreve. `accepted_at` preenchido por trigger quando `profiles` recebe uma row com o mesmo email.

### Fase 3 — nova tabela `messages`

```sql
CREATE TABLE messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id     uuid NOT NULL REFERENCES profiles(id),
  to_id       uuid NOT NULL REFERENCES profiles(id),
  body        text NOT NULL,
  read_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);
```

- RLS: admin escreve; aluno lê apenas as próprias mensagens
- Aluno vê mensagens em `/aluno/perfil` (Fase 3 do dashboard do aluno)

---

## Fase 1 — Detalhamento

### `/admin` — Início

4 cards de resumo (dados em tempo real via Supabase):

| Card | Fonte |
|---|---|
| Alunos ativos | `COUNT profiles WHERE role = 'aluno'` |
| Feedbacks novos | `COUNT checkins` da semana corrente |
| PRs esta semana | `COUNT records` criados nos últimos 7 dias |
| Turmas ativas | `COUNT groups` (0 na Fase 1) |

Abaixo dos cards: lista "Recordes recentes" — últimos 5 `records` com nome do aluno, distância e tempo.

### `/admin/alunos` — Lista de Alunos

- Lista de todos os `profiles` com `role = 'aluno'`, ordenados por nome
- Cada linha: avatar com iniciais, nome, badge da turma (ou "sem turma"), nível, data do último check-in
- Badge 🏆 quando o aluno tem recorde nos últimos 7 dias
- Filtros: por turma (dropdown), por nível (dropdown)
- Botão "+ Convidar" no topo → abre modal com form de email (reutiliza lógica do `useInvite`)
- Clique no aluno → perfil individual (placeholder na Fase 1, implementado na Fase 2)

**Hook:** `useAdminAlunos` — consulta `profiles` + join em `checkins` (último) + `records` (PR recente)

### `/admin/feedbacks` — Feed de Check-ins

- Feed cronológico de todos os check-ins recentes com observação do aluno
- Cada card: nome do aluno, texto da observação, distância, tempo, percepção de esforço (emoji 1–5), data
- Badge verde `🏆 PR [distância]` quando o check-in gerou um recorde pessoal novo
- Check-ins sem observação aparecem atenuados (professor geralmente ignora)
- Filtros: "Todos" | "Esta semana" | "Só PRs"
- **Mobile:** esta é a tela de entrada padrão no celular (uso principal do professor no dia a dia)

**Detecção de PR:** um check-in é marcado como PR se existir uma entrada em `records` com o mesmo `student_id` e `created_at::date` igual ao `checkin.created_at::date`. A query traz os check-ins com left join em `records` — se o join retornar linha, o badge é exibido.

**Hook:** `useAdminFeedbacks` — consulta `checkins` ordenados por `created_at DESC` com join em `profiles` e `records`

### `/admin/convites` — Painel de Convites

Expansão da funcionalidade já existente (`useInvite`):

- Form: campo de email + botão "Convidar"
- Feedback de sucesso/erro inline (já implementado)
- **Fase 1:** sem lista de pendentes — apenas o formulário de envio

A lista de convites pendentes entra na **Fase 2**, quando a Edge Function `invite-user` passará a gravar cada convite em uma tabela `invites` (email, sent_at, accepted_at). Status "aceito" é detectado por join em `profiles` pelo email.

---

## Fase 2 — Visão Geral

### `/admin/turmas` — Lista de Turmas

- Cards por turma: nome, objetivo (badge colorido por categoria), frequência, contagem de alunos
- Ações por card: "Ver alunos" (lista filtrada) e "Ver plano" (editor mensal)
- Botão "+ Nova turma": form com nome, objetivo (dropdown enum), frequência (2x ou 3x)

### `/admin/turmas/:id` — Plano Mensal

Grid **4 semanas × dias de treino**:

- Eixo X: dias da semana configurados para a turma (ex: Ter, Qui, Sáb para 3x/semana)
- Eixo Y: Semanas 1–4 do ciclo mensal
- Cada célula: badge do treino (nome curto + tipo) ou botão "+" para adicionar
- Ao clicar em "+": bottom sheet com busca na biblioteca de treinos (`trainings`)
- Ao confirmar: cria `weekly_plan` + `weekly_plan_trainings` para todos os alunos da turma (atribuição em lote). Regra: se um aluno já tem `weekly_plan` individual para aquela `week_start`, o lote não sobrescreve — o plano individual tem precedência
- Permite editar/remover treino de uma célula

### `/admin/alunos/:id` — Perfil do Aluno

- Dados pessoais (nome, nível, anamnese resumida)
- Turma atual (dropdown para trocar)
- Histórico de check-ins
- Recordes pessoais por categoria
- Botão "Enviar mensagem" → abre modal (implementado na Fase 3)

---

## Fase 3 — Visão Geral

### `/admin/treinos` — Biblioteca de Treinos

CRUD dos templates de treino reutilizáveis (tabela `trainings` existente):

- Lista com nome, tipo (badge), distância, pace alvo, séries
- Form de criação/edição: nome, tipo (enum `training_type`), distância (km), pace alvo (min/km), séries (para HIIT), observações
- Treinos da biblioteca são selecionados ao montar o plano mensal

### Mensagem Direta

Modal simples acessado a partir do card do aluno (em `/admin/alunos` ou `/admin/alunos/:id`):

- Campo "Para" (preenchido automaticamente)
- Campo de texto livre
- Botão "Enviar" → INSERT em `messages`
- Sem histórico de conversa na Fase 3 — apenas envio unidirecional

---

## Componentes Compartilhados

| Componente | Uso |
|---|---|
| `AdminLayout` | Wrapper com sidebar + área de conteúdo, responsivo |
| `AdminSidebar` | Sidebar desktop + drawer mobile |
| `AlunoCard` | Card de aluno reutilizado em lista e feedbacks |
| `CheckinCard` | Card de check-in com badge PR |
| `InviteModal` | Modal de convite reutilizável |
| `MessageModal` | Modal de mensagem (Fase 3) |

---

## Arquivos a Criar / Modificar

### Modificar
- `src/pages/admin/AdminDashboard.tsx` → substituir pelo novo `AdminLayout` + roteamento

### Criar — Fase 1
```
src/pages/admin/
  AdminLayout.tsx          # sidebar + área de conteúdo
  AdminSidebar.tsx         # nav links, responsive
  AdminHome.tsx            # /admin — cards resumo + PRs recentes
  AdminAlunos.tsx          # /admin/alunos — lista
  AdminFeedbacks.tsx       # /admin/feedbacks — feed
  AdminConvites.tsx        # /admin/convites — form + pendentes
  AdminLayout.module.css

src/hooks/
  useAdminAlunos.ts        # perfis + último checkin + PR recente
  useAdminFeedbacks.ts     # checkins com join profiles + records
```

### Criar — Fase 2
```
src/pages/admin/
  AdminTurmas.tsx
  AdminTurmaDetalhe.tsx    # grid plano mensal
  AdminAlunoDetalhe.tsx

src/hooks/
  useGroups.ts
  useMonthlyPlan.ts        # lê/escreve weekly_plans em lote

supabase/migrations/
  YYYYMMDD_add_groups.sql
```

### Criar — Fase 3
```
src/pages/admin/
  AdminTreinos.tsx

src/components/
  MessageModal.tsx

supabase/migrations/
  YYYYMMDD_add_messages.sql
```

---

## Ordem de Implementação

1. `AdminLayout` + `AdminSidebar` (estrutura vazia com todas as rotas)
2. `AdminHome` (cards com dados reais)
3. `AdminFeedbacks` (prioridade: uso principal no mobile)
4. `AdminAlunos` (lista com filtros)
5. `AdminConvites` (nova UI sobre lógica existente)
6. *(Fase 2)* Schema `groups` → `AdminTurmas` → `AdminTurmaDetalhe`
7. *(Fase 2)* `AdminAlunoDetalhe`
8. *(Fase 3)* `AdminTreinos` + `MessageModal`

---

## Fora de Escopo

- Aprovação manual de check-ins (professor confia no auto-relato)
- Push notifications de PR (in-app é suficiente para MVP)
- Histórico de conversa / chat (mensagem é unidirecional na Fase 3)
- Integração Strava no painel admin (professor vê pelo próprio app Strava)
- Relatórios/analytics avançados
