# Arbo — Fase 3 (Parceria)

## Contexto
Parceria fechada com o professor. Maxwell cuida da tecnologia, professor cuida da
lógica de treinos (corrida, CrossFit, Hyrox, funcional).

## Roadmap de tarefas

### 1. Calculadora de Pace — ✅ 100% CONCLUÍDO COM ZONAS (2026-07-03)
Implementado componente standalone (`PaceCalculator.tsx`) com cálculos de Pace, Tempo, Distância e tabelas de projeção de provas clássicas. Adicionado botão de acesso rápido tanto no painel do aluno (aba Progresso) quanto no do professor (aba Home).

**Atualização 2026-07-03 (v1):**
- Toggle "Básico / Zonas" no topo do modal (bottom-sheet) — modo Básico mantém as 3 abas originais (Pace/Tempo/Distância) intactas
- Modo Zonas: input de pace de referência + botão "Calcular Zonas" → 5 cards de zona
- Corrigidos hardcoded colors remanescentes no `PaceCalculator.module.css` — migrados para CSS vars semânticas
- Corrigido bug de variável CSS inexistente (`var(--border)` não existia em `index.css` — trocado por `var(--border-default)`)
- Botões trigger em `AlunoProgresso.tsx` e `AdminHome.tsx` migrados para CSS vars

**Atualização 2026-07-03 (v2) — feedback real de uso, redesenho completo:**
- Bug identificado: no formato bottom-sheet, o teclado do celular cobria o botão "Calcular Zonas" e o resultado, deixando a calculadora "sem saída" pro aluno
- **Modal agora abre em tela cheia no celular** (header fixo com título/X/toggle + corpo rolável abaixo, `100dvh`); no desktop continua como modal centrado (`max-width: 500px`, `max-height: 85vh`)
- Renomeado "Zonas" → **"Avançado"**; cálculo agora é automático (sem botão) assim que o pace de referência é digitado — elimina a confusão do "não sei se calculou"
- **Modo Básico** ganhou 3 zonas automáticas (Leve/Moderado/Forte) exibidas logo abaixo do resultado do cálculo já feito — sem precisar de input extra
- **Modo Avançado** expandido de 5 para **6 zonas** (Regenerativo, Base Aeróbica, Moderado, Limiar, VO2max, Anaeróbico), cada uma com pace + faixa de **% FCmáx** + sugestão de treino, mais um texto de ajuda explicando o conceito de "pace de referência" para alunos novos
- Validado: `tsc --noEmit`, `npm run lint`, `npm run build` — 0 erros/warnings em ambas as rodadas

**Atualização 2026-07-03 (v3) — "descubra a zona de um treino específico":**
- Novo bloco no modo Avançado: campos de Distância (km) + Tempo (hh:mm:ss) de um treino já realizado
- App calcula o pace daquele treino e identifica automaticamente em qual das 6 zonas ele caiu (card destacado com borda mais grossa e a cor da zona correspondente)
- Se o pace cair numa faixa de transição entre duas zonas (existem pequenos gaps intencionais entre elas), retorna a zona com o centro mais próximo em vez de não mostrar nada
- Matemática validada manualmente (ex: referência 5:00/km + treino de 8km em 42:00 → pace 5:15/km → Z3 Moderado, correto)
- Validado: `tsc --noEmit`, `npm run lint`, `npm run build` — 0 erros/warnings

**Incidente de infraestrutura (2026-07-03):** durante a checagem de deploy, múltiplas requisições `curl` automatizadas (incluindo um loop de verificação a cada 5s) dispararam o **Vercel Security Checkpoint** (proteção anti-bot), bloqueando o site inteiro por um tempo — não relacionado a bug de código. Lição: nunca fazer polling agressivo contra o domínio de produção; usar no máximo 1 request espaçado, e lembrar que `curl` não resolve o desafio JS do checkpoint (só um navegador real resolve sozinho) — então `curl` pode reportar bloqueio falso mesmo depois de já ter liberado para usuários reais. Se o site parecer fora do ar sem motivo aparente, checar primeiro Vercel Dashboard → Project → Settings → Firewall antes de suspeitar do código.

### 2. Biblioteca de treinos — ajustes finais
Já existe em /admin/treinos. Revisar e ajustar com base no feedback real de uso.

### 3. Botão "Testar como Aluno" (admin) — ✅ CONCLUÍDO (2026-06-30)
Admin consegue ver o app como um aluno veria, sem sair do contexto admin.
Implementado criando uma rota `/preview-aluno` acessível pelo menu do Admin, injetando um `previewStudentId` (conta demo previamente inserida no banco) no `AlunoDashboard`. Adicionado um botão flutuante discreto (FAB) "Voltar ao Admin" e bloqueado o botão de logout na aba Perfil, isolando a experiência e evitando distorções no layout com zero risco de acessar dado real de aluno.

### 4. Padronização de treinos via IA
Receber arquivo Word com 10 treinos do professor, processar com IA para extrair
um padrão estruturado (tipo, distância, pace, séries, descrição), e criar
fluxo de carga automática desses treinos no banco.

### 5. Upload de vídeo no admin — ✅ IMPLEMENTADO, PENDENTE CONFIGURAÇÃO MANUAL NO CLOUDFLARE (2026-07-04)
Decisão: upload direto para Cloudflare R2 (custom domain `videos.mxos.com.br`), mantendo o link do YouTube como alternativa — professor escolhe via toggle no formulário de treino.

**Desvio de arquitetura em relação ao pedido original (documentado, não silencioso):** o pedido original previa a Edge Function `r2-upload` recebendo o arquivo via `multipart/form-data` e fazendo o proxy dos bytes até o R2. Isso foi trocado por **presigned URL**: a function valida o JWT (só `role=admin`) e devolve uma URL assinada (SigV4, via `aws4fetch`) para o navegador fazer o `PUT` **direto** no R2, sem os bytes do vídeo passarem pelo servidor. Motivo: Edge Functions (Deno Deploy) têm limites de memória e tempo de execução incompatíveis com proxiar arquivos de até 500MB — esse é também o padrão oficial recomendado pela própria Cloudflare para upload de arquivos grandes a partir do browser. Credenciais do R2 nunca saem da Edge Function.

**Implementado:**
- `supabase/functions/r2-upload/index.ts` — valida JWT + `role=admin`, valida `contentType` (mp4/webm/quicktime) e `fileSize` (≤500MB), sanitiza `filename` e `trainingId` (remove acentos/caracteres especiais, previne path traversal), gera presigned URL PUT (`aws4fetch`, `region: 'auto'`, `signQuery: true`) para `videos/{trainingId}/{filename}` e retorna `{ uploadUrl, publicUrl, key }`.
- `src/components/admin/TreinoFormPanel.tsx` — toggle "Link YouTube" / "Upload de vídeo"; aba upload com dropzone, barra de progresso (via `XMLHttpRequest.upload.onprogress` — `fetch` não expõe progresso de upload), preview do nome do arquivo e botão remover; submit bloqueado durante upload em andamento. Para treino ainda não salvo (sem `id`), usa um `crypto.randomUUID()` gerado no client como pasta temporária no R2 — decisão pragmática já que o path pede um `training_id` mas o registro só existe após o submit.
- `src/pages/admin/AdminTreinos.tsx` — `handleUploadVideo()` chama a Edge Function e faz o `PUT` via XHR (mantendo o padrão do projeto de responsabilidade de rede no componente pai, não no presentacional).
- `src/components/ui/VideoPlayer.tsx` — detecta automaticamente o tipo de vídeo pela URL: `videos.mxos.com.br` → `<video>` nativo (MIME type inferido pela extensão: mp4/webm/mov); YouTube → iframe como antes. `touch-action: pan-y` no container, padrão do projeto.
- `vercel.json` — CSP atualizada: `media-src` liberado para `videos.mxos.com.br` (necessário pro `<video>` tocar) e `connect-src` liberado para `https://*.r2.cloudflarestorage.com` (necessário pro `PUT` direto do browser).

**Pendente do lado do usuário (não é possível fazer via código/MCP):**
- Configurar **CORS no bucket R2** no Cloudflare Dashboard (ou via `wrangler r2 bucket cors put`) permitindo `PUT` a partir de `https://arbo.mxos.com.br`, `https://arbo-weld.vercel.app` e `http://localhost:5173` — sem isso, o navegador bloqueia o upload direto por CORS mesmo com a URL assinada correta.
- Teste ponta a ponta com um vídeo real ainda não realizado nesta sessão (sem acesso a browser/Cloudflare para simular o `PUT`).

**Não implementado (fora do escopo pedido):** exclusão do objeto no R2 ao clicar em "remover" — hoje o botão só limpa o campo `video_url` do treino (mesmo comportamento do link do YouTube), o arquivo permanece no bucket. Se for necessário limpar o storage também, precisa de uma function adicional de delete.

Validado: `tsc --noEmit`, `npm run lint`, `npm run build` — 0 erros/warnings. Deploy da function `r2-upload` v1 via MCP Supabase (`verify_jwt: true`).

### 6. Integração Strava — ✅ TOTALMENTE CONCLUÍDO E FUNCIONANDO EM PRODUÇÃO (2026-07-04)
OAuth completo implementado via 4 Edge Functions (`strava-auth`, `strava-callback`, `strava-sync`, `strava-connection`), hook `useStravaConnection.ts`, página de callback `StravaCallback.tsx` (rota `/strava/callback`, com proteção CSRF via `state`) e card funcional no `AlunoPerfil.tsx` (conectar/desconectar/sincronizar/lista de atividades), substituindo o placeholder `strava_connected: false`.

**Verificação prévia (antes de escrever qualquer SQL):** consultado o schema real de `strava_connections`/`strava_activities` ao vivo no Supabase via MCP. As tabelas já existiam com `user_id`/`token_expires_at` (não `student_id`/`expires_at`, como o pedido original assumia) e `strava_connections` já estava corretamente travada — RLS ativo, zero policies, GRANT `authenticated` só `REFERENCES/TRIGGER/TRUNCATE`. Nenhuma migration foi aplicada; o `GRANT` originalmente pedido teria revertido essa trava e exposto `access_token`/`refresh_token` ao cliente.

**Por que 4 Edge Functions e não 3:** com `strava_connections` inacessível ao cliente, o frontend não tinha como checar status de conexão nem desconectar sem violar a trava — daí a `strava-connection` (GET status / DELETE desconectar) além das 3 pedidas (`strava-auth`, `strava-callback`, `strava-sync`).

**Segurança:** client secret nunca no frontend, JWT validado em toda Edge Function antes de qualquer uso de `service_role`, filtro explícito por `user.id` mesmo com `service_role` (que ignora RLS), tokens do Strava nunca retornam em nenhuma resposta ao cliente — o hook só consome `{ isConnected, activities }`.

Validado: `tsc --noEmit`, `npm run lint`, `npm run build` — 0 erros/warnings. Commit `325c876` em `master`.

**Atualização 2026-07-04 (deploy + fix de produção):**
- As 4 Edge Functions deployadas via `npx supabase functions deploy <nome> --project-ref jhfkflnixzivuichmkie`. Achado pós-deploy: todas subiram com `verify_jwt: true` por padrão, o que quebrava a `strava-auth` (chamada via navegação direta do navegador, sem header `Authorization`). Corrigido com redeploy `--no-verify-jwt` só nessa function; as outras 3 continuam `verify_jwt: true` (chamadas via `fetch` com JWT, como deveria ser).
- **Bug de produção:** ao testar o fluxo real, erro `"Erro ao salvar conexão com o Strava"` — investigação de logs (gateway + tentativas via MCP/CLI/Management API, sem sucesso em capturar o `console.error` exato por atraso de ingestão do Logflare) até o usuário confirmar no Dashboard: `"permission denied for table strava_connections"`.
- **Causa raiz real** (não era o código — as 3 functions já usavam `SUPABASE_SERVICE_ROLE_KEY` corretamente, confirmado por grep): `service_role` tinha `rolbypassrls = true` mas **não tinha GRANT de SELECT/INSERT/UPDATE/DELETE** em `strava_connections` — só as permissões estruturais (`REFERENCES/TRIGGER/TRUNCATE`). `BYPASSRLS` só pula a checagem de *policy*; o GRANT de tabela é uma camada separada e anterior no Postgres, sem exceção para `service_role`.
- **Fix:** `GRANT SELECT, INSERT, UPDATE, DELETE ON strava_connections TO service_role;` aplicado manualmente pelo usuário no SQL Editor do Supabase. `authenticated`/`anon` continuam sem nenhum GRANT de CRUD — a trava de segurança original permanece intacta, só a permissão que faltava pro `service_role` foi adicionada.
- Lição registrada em `GEMINI_LESSONS.md` (item 13) e histórico completo em `CLAUDE_HISTORICO.md`.
- **Status final:** OAuth, sincronização de atividades e desconexão testados e funcionando corretamente em produção.

**Atualização 2026-07-04 (Fase 2 — card profissional + painel admin):**

- **Fix (atividades sumindo ao recarregar):** causa raiz era `checkStatus()` só popular `isConnected`, nunca `activities` — a lista só existia em memória e era perdida a cada reload até o aluno clicar manualmente em "Sincronizar". Corrigido em `useStravaConnection.ts`: extraída a lógica de fetch para `fetchActivities()` (reused tanto pelo carregamento automático quanto pelo botão manual), e o `useEffect` de mount agora chama `checkStatus()` e, se `isConnected === true`, dispara `fetchActivities()` automaticamente — sem exigir clique. Novo estado `isLoadingActivities` isolado de `isSyncing` para não confundir o loading automático do mount com o loading do botão manual.
- **Card profissional no `AlunoPerfil.tsx`:** header com ícone + título + badge de status (verde "Conectado" / cinza "Desconectado") + subtítulo "Desde [data]" (usa `connectedAt`, que a Edge Function `strava-connection` já retornava mas o hook descartava — agora exposto). Lista de atividades com ícone `Footprints`, data em PT-BR sem sufixo "-feira" (ex: "Segunda, 30 jun"), distância, pace e duração (`mm:ss` ou `h:mm:ss`). Máximo 5 atividades visíveis com botão "Ver mais". Estado vazio elegante quando conectado mas sem atividades sincronizadas. Botão "Desconectar" discreto (texto vermelho, sem borda) separado do botão primário de sincronizar.
- **Painel admin (`AdminAlunoDetail.tsx`):** nova seção "Atividades Strava" — reaproveita a mesma Edge Function `strava-sync`, agora aceitando um corpo opcional `{ studentId }`. Se `studentId` vier preenchido, a function exige `role=admin` no JWT do chamador (403 caso contrário) e busca a conexão/atividades do aluno informado em vez do próprio chamador — todas as três operações que antes usavam `user.id` (`select` da conexão, `update` do token renovado, `upsert` das atividades) passaram a usar `targetUserId = studentId ?? user.id`. Hook novo `useAdminStravaActivities.ts` chama essa function e expõe `{ activities, isLoading, error, notConnected, sync }`; `notConnected` é derivado da mensagem de erro 404 (`"Nenhuma conexão com o Strava encontrada."`) para diferenciar "aluno nunca conectou" de falha de rede/servidor. Seção mostra mensagem dedicada nesse caso, lista de atividades no estilo dos outros cards do admin, botão "Sincronizar atividades" e um campo de texto "Feedback do professor" por atividade — **somente visual por enquanto, sem persistência** (próxima fase).
- **Nota de arquitetura (segurança):** o pedido original previa "admin só acessa atividades de alunos da sua turma", mas o app não tem esse conceito — é modelo de um único professor/admin, e todas as páginas `/admin/*` (incluindo `AdminAlunoDetail` de qualquer aluno) já são globais, gated apenas por `role=admin` via `AdminRoute`. A Edge Function segue esse mesmo padrão de autorização (checagem de `role`, não de turma) para ficar consistente com o resto do painel — inventar uma trava por turma seria uma restrição nova que não existe em nenhum outro lugar do sistema.
- **Deploy:** `strava-sync` v2 publicada via MCP Supabase (`verify_jwt: true` mantido, igual à v1) — `npx supabase functions deploy` local falhou por falta de login no CLI (`SUPABASE_ACCESS_TOKEN`/`supabase login` pendente na máquina).
- Validado: `tsc --noEmit`, `npm run lint`, `npm run build` — 0 erros/warnings.

### 7. Agente de resposta no Strava
Depende do item 6 estar pronto. Definir comportamento exato com o professor
(comentar na atividade, notificar professor, sincronizar dado no app, etc).

## Status
Roadmap criado em 2026-06-30. Itens 1, 3 e 6 implementados, validados e **funcionando em produção** (item 6 confirmado em 2026-07-04 após fix de GRANT no `service_role`). Aguardando próximos passos do professor (itens 2, 4, 5, 7 pendentes; item 7 depende de decisão do professor sobre o comportamento do agente Strava).

## Correções Adicionais (2026-07-01)
- Corrigido corte de tela no `DayPicker` em dispositivos menores (scroll interno e max-height).
- Ajustado espaçamento inferior (padding-bottom) no container do painel do aluno para evitar sobreposição da BottomNav aos cards de treino.
- Corrigido o corte do balão de mensagens do `AlunoChat` através de ajustes na hierarquia do flex wrapper.
- Refatoração profunda da arquitetura de layout do AlunoDashboard, replicando o padrão do AdminLayout (uso de `.contentWrapper` com `flex: 1; overflow: hidden`) para isolar o contexto de formatação do WebKit e impedir cortes de conteúdo no iOS Safari sem disparar a barra de rolagem nativa.
- Corrigido desaparecimento do input do chat aplicando `flex-shrink: 0` no container `.inputArea` do AlunoChat (evitando que ele fosse reduzido a 0 de altura pelo flexbox sob pressão do wrapper).
- Bloqueado o comportamento elástico nativo de arrasto horizontal do iOS Safari (Swipe-to-go-back/Overscroll) através de `touch-action: pan-y; overscroll-behavior-x: none` aplicado diretamente nos containers que rolam e recebem o toque (`AlunoProgresso.module.css`, `AlunoPerfil.module.css` e no wrapper inline do Chat no `AlunoDashboard.tsx`).
- **Navegação entre Semanas (S1-S4) no Painel do Aluno:** Implementada a funcionalidade para o aluno navegar entre as semanas do ciclo. O hook `useWeeklyPlan` foi modificado para aceitar uma semana específica (`selectedWeekNumber`) calculando a data de início correta a partir do ciclo do grupo. Adicionado seletor de abas (`weekSelector`) no topo do dashboard do aluno e transformados os chips estáticos do `LockedScreen` em botões interativos vinculados ao estado de navegação. Semanas futuras não liberadas mostram a tela de bloqueio com feedback amigável ao usuário.
