# Revisão crítica — Arquitetura de Pagamentos do Arbo

**Revisor:** Segurança / Arquitetura / Engenharia
**Insumo revisado:** `analise_pagamentos_arbo.md` (Antigravity)
**Data:** 2026-08-31

---

## 0. Veredito rápido

A direção estratégica está **boa**: começar por cobrança recorrente, Asaas como gateway,
Pix-only no MVP, adiar cartão e split. Concordo com esses três pontos.

Porém a **arquitetura técnica proposta tem furos que causariam bug de produção ou de
segurança se implementada como está**, e o escopo do MVP está **subestimado** (o texto
sugere algo pequeno; é um esforço médio, ~2–3 semanas). Os pontos mais graves:

1. **Premissa de multi-treinador (`coach_id`, KYC por treinador, subcontas)** que **não
   existe no app hoje** — o Arbo tem *um* admin. Isso infla o escopo sem necessidade.
2. **Autenticação de webhook descrita errada para o Asaas** — Asaas não assina payload
   com HMAC (`asaas-signature`); usa **access token estático em header**. Isso muda o
   modelo de ameaça (replay é possível → idempotência vira obrigatória, não opcional).
3. **Bloqueio de treino só no frontend** — repetiria exatamente o erro que o projeto já
   corrigiu com o trigger `prevent_self_privilege_escalation`. Tem que ser **RLS**.
4. **3 chamadas `.from()` separadas no webhook** em vez de **1 RPC transacional** —
   mesma classe do incidente `strava_activities` (escrita parcial silenciosa).
5. **`grace_period_ends_at` como coluna estática** — quebra quando o professor estende
   prazo ou perdoa. Acesso tem que ser **função pura das datas atuais**, avaliada
   *lazy* (sem cron).

Detalhamento abaixo.

---

## 1. Auditoria de arquitetura e segurança

### 1.1. Gateway — Asaas é escolha razoável, com ressalvas

- **Concordo com Asaas** para o nicho: a régua de cobrança nativa (WhatsApp/SMS/e-mail
  de vencimento) é o real diferencial e resolve a dor do professor sem código nosso.
- **"Pix Recorrente" precisa ser desambiguado.** O que o MVP descreve é
  **assinatura Asaas que gera uma cobrança nova por ciclo, cada uma com um Pix dinâmico
  que o aluno paga manualmente**. Isso **não é** débito automático. O débito automático
  de verdade é o **Pix Automático** (BACEN, "pull") — esse sim mata inadimplência e
  churn, e deve ser o **alvo da Fase 2** (antes de cartão). Deixar explícito no texto
  para não criar expectativa errada com o professor.
- **Lock-in:** encapsular o gateway atrás de uma interface (`PaymentGateway`) dentro das
  Edge Functions. Baixo custo agora, troca de Efí/Stripe contida depois.
- **Base URL por ambiente:** `ASAAS_ENV` + URL derivada (`sandbox.asaas.com` /
  `api.asaas.com`). Nunca hardcodar.
- **Taxas:** confirmar taxa Pix efetiva do plano Asaas (varia ~R$1,99 ou ~1%, negociável)
  — impacta diretamente o líquido do professor numa mensalidade de R$150–300.

### 1.2. Multi-tenant que não existe — cortar do MVP

O app hoje: **um** `role='admin'` (o professor), autorização binária `private.is_admin()`,
`profiles` **sem** `coach_id`, alunos pertencem a `groups`. O `CLAUDE.md` diz
explicitamente "implementar multi-admin **caso o modelo se confirme**".

**Implicação:** no MVP existe **uma** conta Asaas (a do professor ou a do Arbo). Não há
onboarding/KYC por treinador, não há subcontas, não há `coach_id` em toda linha.

- **Cortar:** `subscriptions.coach_id`, KYC-via-API, criação de subcontas, split.
- **Manter forward-compat barato:** se quiser, `subscriptions.coach_id uuid` *nullable*,
  default = id do admin único. Sem lógica em cima disso agora.
- Isso remove ~40% do esforço da proposta original.

### 1.3. Segurança do webhook — o ponto mais fraco da proposta

| Item | Proposta | Correção |
|---|---|---|
| Autenticação | "validar `asaas-signature` (HMAC)" | Asaas **não** tem HMAC. Configurar **token no painel Asaas** → chega no header (`asaas-access-token`, **confirmar nome na doc vigente**). Comparar com `Deno.env.get('ASAAS_WEBHOOK_TOKEN')` em **tempo constante** (`crypto.timingSafeEqual`). Token longo/aleatório. HTTPS obrigatório (já é). |
| Replay attack | não tratado | Token estático → request capturado **é replicável**. Defesa = **idempotência por `event.id`** (constraint UNIQUE) + operações idempotentes por estado (marcar `paid` o que já está `paid` é no-op). Opcional: allowlist de IP do Asaas. |
| Spoofing | parcial | Sem o token válido, rejeitar com 401 **antes** de qualquer parsing/IO. Logar tentativa (Sentry). |
| Fila do Asaas | não mencionado | **Asaas pausa a fila inteira** após N falhas consecutivas do seu endpoint. O webhook **quase nunca pode retornar 5xx** — sempre persistir o evento cru e retornar 200; processar em seguida. Falha só em erro de auth. |
| Ordem de entrega | "webhook fora de ordem" listado sem solução | Nunca aplicar transição de estado cega. Guardar `event` + **recomputar** status a partir da verdade mais recente (guard por timestamp: só aplica se `evento.dateCreated > invoices.gateway_status_updated_at`). Estados terminais (`REFUNDED`, `DELETED`) têm prioridade. |
| Evento antes da linha local existir | não tratado — **bug garantido** | O `PAYMENT_*` da 1ª cobrança pode chegar **antes** do commit de `create-subscription`. O handler tem que ser capaz de **criar** `invoices`/`subscriptions` a partir do payload, keyed por `gateway_invoice_id`. Webhook é a **fonte de verdade**, self-healing. |

### 1.4. Idempotência — modelagem correta

- `webhook_events.gateway_event_id UNIQUE` **+ padrão insert-first**: tenta `INSERT`; em
  violação de unique → retorna 200 na hora (já processado). **Nunca** "check-then-insert"
  (TOCTOU se o Asaas entregar em paralelo). Confiar na constraint do banco.
- **Se o `event.id` do Asaas não for confiável/único**, usar chave composta:
  `sha256(event_type || payment.id || payment.status || payment.paymentDate)`.
  Confirmar na doc.
- **Transação única:** "inserir `webhook_event` + mutar `invoice` + mutar `subscription`"
  tem que ser **uma RPC Postgres** (`process_payment_event(payload jsonb)`), chamada pela
  Edge Function — **não** 3 chamadas `supabase-js` soltas. Sem atomicidade = escrita
  parcial silenciosa no crash = **exatamente o incidente `strava_activities` (Caso 13)**.
  Com RPC transacional, o retry do Asaas re-executa limpo.
- **Idempotência na criação** (`create-subscription`): usuário clica 2× no botão. Enviar
  `externalReference` = UUID local da subscription ao Asaas + checar estado local antes.
  Assim o retry não cria assinatura duplicada no gateway.
- **Dinheiro:** `amount_cents integer` (centavos), coerente com a convenção do projeto
  (distâncias em metros, tempos em segundos — inteiros). Evita float. Nunca `NUMERIC`
  sem escala.

### 1.5. Bloqueio de acesso — tem que ser RLS, não `if` no React

A proposta faz `if (subscription.status === 'past_due') return blockAccess()` no
frontend. **Insuficiente** — o aluno chama a REST API do Supabase direto e lê tudo. O
projeto **já aprendeu isso** (trigger `trg_prevent_self_privilege_escalation`,
`records_select` de `USING(true)` → restrita).

**Recomendação:**

1. Função SQL única, fonte de verdade:
   ```sql
   private.has_active_access(uid uuid) returns boolean
   -- true se: is_admin(uid)  OR  uid = '00000000-...' (Aluno Demo)
   --   OR subscription ativa
   --   OR (última invoice pending/overdue AND now() <= due_date + grace_days)
   --   OR manual_access_until >= now()
   ```
   Pura função das datas atuais → **avaliação lazy, sem `pg_cron`, sem drift,
   auto-corrige**. O projeto não tem infra de scheduler (keep-alive é GitHub Action) —
   não introduzir uma só por isso.
2. **Ponto de enforcement:** o valor do produto é ver o treino. Aplicar o
   `has_active_access()` no `SELECT` de `weekly_plan_trainings` / `group_plan_trainings`
   (ou no `INSERT` de `checkins`). **Não bloquear** histórico, progresso, check-ins
   passados — questão ética/LGPD e reduz raiva. Bloquear só o treino atual/futuro.
3. Frontend: paywall reaproveitando o padrão do `LockedScreen` (que já existe para
   `released_through_week`). É só UX; a trava real é a RLS.
4. **Exceções obrigatórias:** `is_admin()` nunca bloqueia; Aluno Demo
   (`00000000-0000-0000-0000-000000000000`, usado em `/preview-aluno`) nunca bloqueia.

### 1.6. RLS/GRANT das tabelas novas

| Tabela | RLS | GRANT `authenticated` |
|---|---|---|
| `webhook_events` | ON, **zero policies** | **nenhum** — service_role only (padrão `strava_connections`) |
| `payment_customers` *(ou `profiles.asaas_customer_id`)* | ON | SELECT próprio no máximo; idealmente nenhum |
| `subscriptions` | ON | **SELECT** próprio (`student_id = auth.uid()`) + admin. **Sem INSERT/UPDATE/DELETE** |
| `invoices` | ON | **SELECT** próprio + admin. **Sem INSERT/UPDATE/DELETE** |
| `plans` (config de preço/carência) | ON | SELECT aberto a `authenticated`, escrita `is_admin()` |

- Lembrete do projeto: **RLS ≠ GRANT**. Sem `GRANT SELECT` explícito → erro 42501 mesmo
  com policy correta (lição `GEMINI_LESSONS.md` item 14 / Caso 7).
- FKs para **`profiles(id)`**, não `auth.users(id)` (convenção do projeto).
- **Decisão pendente (LGPD):** `invoices.student_id` `ON DELETE` — `CASCADE` (coerente
  com "direito ao esquecimento" já adotado nas FKs de aluno) **vs.** `SET NULL` +
  manter registro financeiro anonimizado para a contabilidade do professor. Precisa de
  decisão do Max.

### 1.7. Segredos

- `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` → Supabase secrets (env da Edge Function).
  Nunca no frontend, **nunca no banco**. Coerente com o projeto.
- A URL do webhook é pública por natureza — por isso o token no header é a defesa.
- Limite de tamanho de body + rejeição rápida no webhook.
- CSP (`vercel.json`): adicionar `connect-src https://sandbox.asaas.com https://api.asaas.com`
  **só se** o frontend chamar o Asaas direto (idealmente não chama — tudo via Edge
  Function; só precisa se renderizar QR via SDK deles).

---

## 2. Casos de borda e resiliência

| Cenário | Comportamento recomendado |
|---|---|
| **Pix gerado mas expirado** | Invoice Asaas continua `PENDING`/`OVERDUE`. O BR Code dinâmico tem validade própria. **Não cachear `pix_qr_code_payload` indefinidamente** — se a invoice está aberta e o payload tem > algumas horas, buscar QR fresco no Asaas ao abrir a tela. Acesso segue durante a carência; régua de cobrança dispara. |
| **Estorno (`PAYMENT_REFUNDED`)** | Professor estornou de propósito → `invoices.status='refunded'`, recomputar subscription. Se não houver outra invoice válida → revogar acesso (imediato, **sem** carência — refund é intencional) + notificar professor. |
| **Chargeback** | Só cartão. **Fora do MVP** (Pix não tem chargeback; só MED de fraude, raríssimo). Tratar quando entrar cartão. |
| **Pagamento fora do horário bancário** | Pix é 24/7 instantâneo — **não-problema**. (Mais um motivo para Pix-only; boleto seria D+1.) Webhook pode atrasar minutos → Realtime/refresh-on-focus cobre. |
| **Falha temporária do gateway na criação** | Edge Function retorna 502; frontend "tente novamente"; **não** criar subscription local (ou criar `status='pending_gateway'` e reconciliar). `externalReference` + Idempotency no `create` para retry não duplicar. |
| **Webhook fora de ordem** | Guard por timestamp do evento + recomputar status (nunca transição cega). Ver 1.3. |
| **Endpoint do webhook fora do ar / cold start** | Asaas re-tenta com backoff e **pausa a fila**. Persistir evento cru + 200 sempre. **Monitoramento:** alertar se `webhook_events` ficar 0 inserts por > 24h. Ação admin de **reconciliação manual** (puxa invoices abertas do Asaas e sincroniza). |
| **Grace period / tolerância** | **Não** coluna estática. `access = ... OR now() <= last_invoice.due_date + interval 'grace_days'`. `grace_days` em `plans` (default 3). Botão "estender prazo" → grava `subscriptions.manual_access_until`. Botão "perdoar mês" → marca invoice como `paid` manualmente (com log de auditoria: quem, quando). Tudo recomputado a cada leitura. |
| **Aluno novo entrando no meio do mês** | Proração: decidir com o professor (cobrar cheio / proporcional / só no próximo ciclo). Asaas suporta `nextDueDate` customizado. |
| **Alunos atuais (~3) na virada** | Fluxo admin "marcar assinatura como em dia até `data`" para não haver gap. Necessário no MVP. |
| **Timezone** | Tudo `America/Sao_Paulo`. "3 dias após vencimento", `due_date` — cuidado com fronteira de data em UTC (o projeto já tem a lição de `day_of_week`/domingo). |
| **Cancelamento (aluno saiu da assessoria)** | Botão admin → Edge Function cancela assinatura no Asaas + `status='canceled'` local. |
| **Eventos desconhecidos/novos do Asaas** | Persistir em `webhook_events`, não processar, retornar 200. Não quebrar em evento não mapeado. |

---

## 3. Complexidade real e overengineering

### Estimativa (stack atual, 1 dev + IA)

| Bloco | Esforço |
|---|---|
| Migrations + RLS + `has_active_access()` + testes unitários da função | ~1 dia |
| Edge Functions (`create-subscription` c/ customer embutido, `webhook`, `cancel`, `reconcile`) + RPC transacional + sandbox | ~3 dias |
| Frontend aluno (paywall + tela "Assinatura" + Realtime/refresh) | ~2 dias |
| Frontend professor (aba "Financeiro": lista + números + ações manuais) | ~2–3 dias |
| Setup Asaas (conta, KYC, config régua, webhook), carga de alunos atuais | ~0,5 dia + espera externa do Asaas |
| Teste E2E sandbox (ciclo completo), reconciliação, hardening, revisão de segurança | ~2 dias |
| **Total** | **~2–3 semanas** de trabalho focado |

A proposta passa a impressão de algo pequeno. **Não é.** É médio.

### Overengineering a cortar / adiar

- ❌ `coach_id` em tudo, KYC por treinador, subcontas → **cortar** (§1.2).
- ⚠️ **QR Pix nativo in-app + animação "Pagamento Confirmado!" + Realtime** → *nice*, não
  MVP. **Fase 1:** tela mostra status + botão "Pagar agora" que abre o **link de fatura
  hospedado do Asaas**; app faz *refresh on focus*. A régua do Asaas (WhatsApp) já leva o
  aluno ao pagamento. QR nativo + confete → Fase 1.5.
- ⚠️ `payment_customers` tabela separada → **`profiles.asaas_customer_id`** (uma coluna,
  uma tabela a menos). Isola menos, mas para MVP com uma conta Asaas é suficiente.
- ⚠️ `subscriptions.status` como máquina de estado própria → mantê-la **burra**, só
  espelha o status do Asaas. A lógica de acesso vive em `has_active_access()`, não numa
  FSM local.
- ✅ Split / Modelo C adiado → **correto**.
- ✅ Cartão adiado → **correto**.
- ⚠️ Dashboard financeiro (MRR, conversão, gráficos) → Fase 1 = **um número** (previsto
  vs. recebido no mês) + **uma lista** (inadimplentes). Sem recharts.

### Faltando na proposta (adicionar ao escopo)

- Migração dos alunos atuais sem gap de cobrança.
- Regra explícita do **que** bloqueia (recomendação: só treino atual/futuro; nunca
  histórico/progresso).
- Exceções: `is_admin()` e Aluno Demo nunca bloqueados.
- Dependência de notificação: push não existe (está no roadmap) → Fase 1 depende da
  **régua do Asaas** (WhatsApp/e-mail). Deixar isso explícito.
- Fluxo de cancelamento de assinatura pelo professor.
- Log de auditoria append-only das ações manuais do admin ("perdoou", "estendeu").
- Testes: `has_active_access()` e o *reducer* de eventos do webhook são lógica pura →
  cobertura unitária obrigatória (o projeto quer sair de 22 testes).

---

## 4. Roadmap de execução recomendado

### Fase 0 — Decisões & setup externo (bloqueia o resto)
- Confirmar **Modelo B com conta única** (sem multi-treinador no MVP).
- Abrir conta Asaas + KYC. Criar credenciais **sandbox**.
- Definir: preço da mensalidade, `grace_days` (default 3), política de proração,
  política de retenção de `invoices` na exclusão de aluno (LGPD).
- Configurar a **régua de cobrança** no painel do Asaas (WhatsApp/e-mail, D-3, D0, D+1…).

### Fase 1 — Backend / Supabase
- Migration: `plans`, `subscriptions`, `invoices`, `webhook_events`,
  `profiles.asaas_customer_id`. RLS + GRANT explícitos (§1.6).
- `private.has_active_access(uid uuid)` — função lazy, com exceções admin/demo.
- RPC transacional `private.process_payment_event(payload jsonb, event_key text)` —
  insert-first em `webhook_events`, upsert de `invoices`/`subscriptions`, guard de
  ordem por timestamp. Tudo numa transação.
- **Testes unitários** de `has_active_access` (ativo / em atraso dentro da carência /
  fora da carência / override manual / admin / demo) e do reducer de eventos
  (out-of-order, refund, duplicado).
- `gen types` + `tsc --noEmit` zero erros.

### Fase 2 — Integração gateway (Edge Functions, sandbox)
- Wrapper `AsaasClient` atrás de interface `PaymentGateway` (base URL por `ASAAS_ENV`).
- `payment-create-subscription`: valida JWT admin → cria/recupera customer no Asaas →
  cria assinatura (`externalReference` = UUID local, `nextDueDate`) → grava local.
  Idempotente.
- `payment-cancel`: valida JWT admin → cancela no Asaas → `status='canceled'`.
- `payment-reconcile`: valida JWT admin → puxa invoices abertas do Asaas e sincroniza
  (rede de segurança contra webhook perdido).

### Fase 3 — Webhook
- `payment-webhook`: **primeiro** compara token do header em tempo constante → 401 se
  falhar. Persiste evento cru. Chama `process_payment_event`. Retorna **200 sempre**
  (exceto auth). Log estruturado + `Sentry.captureException` em erro de processamento
  (sem derrubar a resposta).
- Testar no sandbox: replay do mesmo evento, ordem invertida
  (`OVERDUE` depois `CONFIRMED`), evento antes da linha local, `REFUNDED`,
  evento desconhecido, corpo malformado.

### Fase 4 — Frontend aluno
- Componente de paywall (padrão `LockedScreen`), acionado quando
  `has_active_access` = false. **Não** bloqueia histórico/progresso.
- Tela "Assinatura": status, próxima cobrança, valor, botão "Pagar agora" →
  link de fatura Asaas. Refresh on focus + (opcional) Realtime em `invoices`.
- Garantir: admin e Aluno Demo nunca veem paywall.

### Fase 5 — Frontend professor (aba "Financeiro")
- Lista de alunos × status de pagamento (em dia / atrasado / carência / sem assinatura).
- Números: previsto no mês vs. recebido.
- Ações: **criar assinatura** para aluno, **marcar como pago** (manual, com log),
  **estender prazo** (`manual_access_until`), **cancelar assinatura**,
  **reenviar cobrança**, **reconciliar**.
- Fluxo de carga inicial dos ~3 alunos atuais ("em dia até data X").

### Fase 6 — E2E sandbox + hardening + piloto
- Simular ciclo completo no sandbox: criar → pagar → `RECEIVED` → novo ciclo →
  `OVERDUE` → carência → bloqueio → pagar → desbloqueio → `REFUNDED` → revogação.
- Revisão de segurança: secrets, RLS, GRANT, token do webhook, tempo constante,
  exceções admin/demo, CSP.
- Flip para produção com **1 aluno piloto** antes de ligar para todos.

### Fase 7 — Futuro (fora do MVP)
- **Pix Automático (débito automático BACEN)** — prioridade máxima pós-MVP, mata churn.
- Cartão recorrente + dunning + retentativas + 3DS.
- Split de pagamentos (Modelo C).
- NF-e automatizada, dashboards (MRR/LTV/churn), multi-treinador de verdade.

---

## 5. Perguntas em aberto para o Max

1. **Uma conta Asaas (Arbo ou professor) no MVP?** — recomendo sim, sem multi-treinador.
2. **Retenção de `invoices` ao excluir aluno:** CASCADE (LGPD) ou manter anonimizado
   para contabilidade?
3. **O que exatamente bloquear** quando inadimplente — confirmo a recomendação:
   só treino atual/futuro, nunca histórico/progresso/chat.
4. **Preço e `grace_days`** — para fixar em `plans`.
5. **Proração** de aluno que entra no meio do mês.
6. Topa **adiar QR nativo/confete** e usar link de fatura Asaas na Fase 1?
