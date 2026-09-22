# STATUS DO PROJETO — Arbo (diagnóstico de saúde e reativação)

- **Data:** 2026-09-21 ~05:35 UTC (02:35 BRT)
- **Veredito:** OPERACIONAL — todos os subsistemas verificados estão verdes.
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
