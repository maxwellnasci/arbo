# STATUS DO PROJETO — Arbo (diagnóstico de saúde e reativação)

- **Data:** 2026-09-22 (atualizado; diagnóstico base de 2026-09-21 ~05:35 UTC)
- **Veredito:** OPERACIONAL — todos os subsistemas verificados estão verdes.
- **Segurança:** RLS de `messages` corrigida e unificada (migration `20260922000000_fix_messages_rls_policies.sql`) — ver §6.
- **MVP:** PRONTO PARA EXECUÇÃO DE CAMPO — teste prático com 1 turma, 3 alunos e 1 professor (aplicar a migration em produção antes: `npx supabase db push`).
- **Supabase:** `https://jhfkflnixzivuichmkie.supabase.co` (confere com `.env.local`)
- **Ambiente local:** Node v24.19.0 / npm 11.19.0 (CI usa Node 22 — ver Pendências)

## 1. Banco de dados (Supabase Postgres) — OK, ativo

Queries reais via `GET /rest/v1/<tabela>?select=id&limit=1` com `apikey` + `Authorization: Bearer`:

| Tabela | HTTP | Resposta |
|---|---|---|
| `profiles` | 401 | `42501 permission denied for table profiles` (role `anon` sem `GRANT`) |
| `trainings` | 401 | `42501 permission denied for table trainings` |
| `groups` | 401 | `42501 permission denied for table groups` |
| `checkins` | 401 | `42501 permission denied for table checkins` |
| `training_types` | 401 | `42501 permission denied for table training_types` |

Interpretação: o 401/`42501` **é o comportamento esperado** — prova conexão real ao
Postgres (o erro vem do próprio banco, não de timeout/pausa). Nenhum `000`, `5xx`
ou timeout: o projeto **não está pausado** e responde normalmente.
(Mesmo critério do workflow `keep-alive.yml`.)

## 2. Auth — OK

- `GET /auth/v1/health` → **HTTP 200**, `{"name":"GoTrue","version":"v2.197.0",...}`

## 3. Edge Functions — OK (9/9 implantadas e alcançáveis)

`POST /functions/v1/<fn>` com `{}` e headers `apikey` + `Authorization: Bearer`:

| Função | HTTP | Interpretação |
|---|---|---|
| `invite-user` | 401 | Exige Bearer JWT de usuário (correto) |
| `strava-sync` | 401 | Exige Bearer JWT de usuário (correto) |
| `strava-auth` | 302 | Redirect do fluxo OAuth (correto) |
| `strava-callback` | 401 | Exige Bearer (correto) |
| `strava-connection` | 405 | `POST` não permitido — função espera outro método (correto, está no ar) |
| `strava-analyze` | 401 | Exige Bearer (correto) |
| `delete-user` | 401 | Exige Bearer (correto) |
| `r2-upload` | 401 | Exige Bearer (correto) |
| `r2-delete` | 401 | Exige Bearer (correto) |

Nenhuma retornou `404` (ausente), `5xx` (quebrada) ou `000` (inacessível).
Nota: a anon key local é do formato novo `sb_publishable_*`; as funções exigem
JWT de usuário autenticado, por isso o 401 com chave anônima é o esperado.

## 4. Integridade da aplicação — OK (4/4 verdes)

| Verificação | Comando | Resultado |
|---|---|---|
| Lint estrito | `npm run lint` | **0 erros** (saída limpa) |
| Tipos (cache limpo) | `rm -rf tsconfig.tsbuildinfo && npx tsc --noEmit` | **0 erros** |
| Testes | `npm test` (vitest) | **22/22 passaram** (4 arquivos: `auth`, `trainingUtils`, `formatTime`, `scheduleUtils`) |
| Build produção | `npm run build` (`tsc -b` + `vite build`) | **OK** em ~677ms; PWA com 71 entradas em precache (`dist/sw.js` gerado) |

## 5. Pendências e observações

1. **Git — nada feito por este diagnóstico, só observado:**
   - `M .gitignore` (modificação pré-existente, não commitada).
   - Não rastreados (deixados intactos): `arbo-landing-page.html`,
     `docs/REVISAO_PAGAMENTOS_ARBO.md`, `ideias de design/`.
2. **Node local (v24) vs CI (Node 22):** build passou no Node 24; o CI
   (`ci.yml`) valida em Node 22. Risco baixo, mas vale alinhar a versão
   (ex.: `.nvmrc`) para evitar surpresa futura.
3. **Keep-alive:** confirmar que o secret `SUPABASE_ANON_KEY` existe em
   Settings → Secrets → Actions, senão o `keep-alive.yml` diário só emite
   warning e não pinga o banco.
4. **Cache TS:** `tsconfig.tsbuildinfo` foi removido antes do `tsc` conforme
   solicitado; o arquivo é `gitignored` (`*.tsbuildinfo`), sem efeito no repo.
5. **`dist/`** regenerado pelo build; é `gitignored`, sem efeito no repo.

## 6. Segurança — RLS de `messages` corrigida (2026-09-22)

- **Achado:** 10 políticas legadas/duplicadas (3 gerações de nomes) se combinando
  por OR — qualquer regra permissiva anulava as estritas (vazamento de mensagens
  com exclusão lógica; checagem de admin via claim `app_metadata` forjável).
- **Correção** (`supabase/migrations/20260922000000_fix_messages_rls_policies.sql`):
  drop `IF EXISTS` das 10 legadas, RLS reafirmado, 6 políticas canônicas
  (`admin_*` + `aluno_*`, `TO authenticated`, `(SELECT private.is_admin())` /
  `(SELECT auth.uid())`, `sender_id = auth.uid()` no INSERT, exclusão lógica
  respeitada no SELECT). Chat Aluno↔Admin blindado.
- **Deploy em produção — BLOQUEADO (tentativa 2026-09-22 ~09:50 UTC, `npx supabase db push` NÃO aplicado):**
  1. Sem credencial no ambiente: `supabase/.temp/pooler-url` não contém senha
     e não há `SUPABASE_ACCESS_TOKEN`/login do CLI — é preciso informar a senha
     do banco (`--db-url`/`--password`) ou um access token (`--linked`).
  2. A sandbox de execução bloqueia a conexão direta ao pooler
     (`hostname resolving error` para `aws-1-sa-east-1.pooler.supabase.com`) —
     o push precisa rodar fora da sandbox ou com escalação aprovada.
  - Migrations pendentes: `20260921000000_add_keepalive_rpc.sql` (RPC `keepalive`)
    e `20260922000000_fix_messages_rls_policies.sql` (RLS `messages`).
    Manter a ordem de deploy: `db push` antes de disparar o `keep-alive.yml`
    atualizado e antes do teste de campo.

## 7. Roadmap pós-MVP (pendências arquiteturais — 2026-09-22)

1. **Hardening RLS `messages` (trigger `BEFORE UPDATE`):** a policy
   `aluno_update_messages` (`USING`/`WITH CHECK` só em `student_id`) ainda permite
   que um aluno altere `content`, `sender_id`, `admin_id` e `deleted_by_admin` das
   próprias mensagens via chamada REST direta (`UPDATE`). Criar trigger espelhando
   `trg_prevent_self_privilege_escalation` de `profiles`
   (`20260711215103_prevent_privilege_escalation.sql`): `BEFORE UPDATE ON
   public.messages`, `FOR EACH ROW`, função `SECURITY DEFINER` que, quando
   `NOT private.is_admin()`, dá `RAISE EXCEPTION` se `NEW.<col> IS DISTINCT FROM
   OLD.<col>` para cada coluna travada — liberando ao aluno só
   `deleted_by_student` (exclusão lógica própria) e `read_at`.
2. **Service Layer:** criar `src/lib/api.ts` e migrar as chamadas diretas ao client
   Supabase (hoje 41 arquivos em `src/` importam `lib/supabase`) para funções
   desacopladas por domínio (ex.: `api.treinos.list()`, `api.chat.send()`),
   facilitando mock em testes e troca futura de backend.
3. **Testes:** expandir a cobertura de 22 (4 arquivos: `auth`, `trainingUtils`,
   `formatTime`, `scheduleUtils`) para 50+ testes unitários/integração (hooks,
   componentes e fluxos críticos — check-in, chat, convites).
4. **Acessibilidade:** elevar o score Lighthouse Mobile de a11y de 89 para 95+
   (focus indicators, ARIA labels, screen reader) — demais scores já em 96/100/100.
5. **SMTP externo:** antes de abrir para turmas maiores, validar o envio em escala.
   Contexto: o Supabase gratuito limita emails (convites, recuperação de senha) a
   ~3-4/hora; Resend (`smtp.resend.com:465`, domínio `mxos.com.br` verificado, key
   "Supabase SMTP" só-leitura de envio) já foi configurado e testado ponta a ponta
   em 2026-08-13 (convite real → "Delivered"). Pendente: revalidar deliverability e
   limites do plano Resend/SES sob carga de dezenas de alunos.

## Como reproduzir

```bash
# Supabase (usa .env.local; não imprime secrets)
/tmp/supabase_health.sh

# Aplicação
npm run lint
rm -rf tsconfig.tsbuildinfo && npx tsc --noEmit
npm test
npm run build
```
