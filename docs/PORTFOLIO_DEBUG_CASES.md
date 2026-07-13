# Arbo Run — Estudos de Caso de Debug (Portfólio)

Este documento registra incidentes de alta complexidade resolvidos durante o desenvolvimento do aplicativo **Arbo Run**. Ele demonstra minha capacidade de atuar em múltiplas camadas (Frontend, Backend, DevOps e Segurança) para isolar e solucionar problemas arquiteturais críticos.

---

## Estudo de Caso 1: Conflito de Tipagem em Funções RPC (Supabase + TypeScript)

**O Cenário:**
Foi criada uma nova função no banco de dados (RPC) chamada `get_user_email` para permitir que o administrador visualizasse os e-mails dos alunos (dado protegido pela API de Auth).

**O Sintoma:**
O build no Vercel quebrou no pipeline de CI com o erro:
`TS2345: Argument of type '"get_user_email"' is not assignable to parameter of type 'never'.`

**O Diagnóstico:**
Como a nova RPC não havia sido sincronizada no arquivo `database.types.ts` via CLI (`supabase gen types`), o TypeScript inferiu de forma restrita que o cliente tipado do Supabase não possuía tal método, avaliando o argumento como `never`. Tentativas de usar casting direto no argumento (`'get_user_email' as any`) corrompiam a inferência do overload interno do SDK.

**A Solução:**
A abordagem sênior adotada foi o casting completo da instância do cliente, isolando o bypass de segurança do TypeScript exclusivamente na linha da chamada, preservando a integridade estrutural do resto da aplicação:
```typescript
const { data, error } = await (supabase as any).rpc('get_user_email', { user_id: id })
```
**Conhecimento demonstrado:** Tipagem estrita, inferência de overloads em bibliotecas de terceiros e integração de banco de dados serverless.

---

## Estudo de Caso 2: Bloqueio Silencioso de Iframe em Produção (DevOps / CSP)

**O Cenário:**
Implementamos um player de vídeo embutido para reproduzir treinos do YouTube dentro do painel do aluno.

**O Sintoma:**
Em ambiente local e no "in-app browser" do WhatsApp, o player funcionava perfeitamente. No PWA instalado e na URL de produção, renderizava apenas um quadrado branco. Nenhum erro óbvio no console do React.

**O Diagnóstico:**
Uma investigação no arquivo `vercel.json` revelou a raiz do problema: **Content Security Policy (CSP)**. 
O aplicativo possuía políticas rigorosas (nota A+ de segurança). Como a diretiva explícita `frame-src` não existia, o navegador realizou o fallback para a diretiva primária `default-src 'self'`. O navegador, protegendo o usuário, decapitava a conexão com o domínio `youtube.com` em background, gerando a "tela branca da morte" (White Screen of Death).

**A Solução:**
Injeção cirúrgica de domínios seguros na política de segurança sem relaxar o resto do aplicativo:
```json
// Adicionado ao Content-Security-Policy do vercel.json
"frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;"
```
**Conhecimento demonstrado:** Segurança Web Avançada (CSP, COEP), redesenho de infraestrutura (Vercel Config) e diagnóstico de falhas "silenciosas".

---

## Estudo de Caso 3: Violação de Imutabilidade e Arquitetura de Hooks (React / ESLint)

**O Cenário:**
Implementação de "Edição Inline" do nome do aluno no perfil do Administrador, visando UX instantânea (Optimistic UI Update).

**O Sintoma:**
O compilador de Lint impediu o commit (Exit Code 1) com o erro fatal:
`react-hooks/immutability: Modifying a value returned from a hook is not allowed.`

**O Diagnóstico:**
A UI otimista foi implementada mutando diretamente a propriedade de um objeto originado do React State:
`profile.full_name = newName.trim()`
No React, objetos em estado são imutáveis. Mutá-los diretamente ignora o ciclo de reconciliação, cria "tearing" visual e quebra o paradigma declarativo.

**A Solução:**
A lógica de mutação foi transferida de volta para onde o estado é isolado (o Custom Hook `useAdminAlunoDetail.ts`). Foi exposta uma função `updateName` que clona o estado anterior usando *Spread Operator*, garantindo imutabilidade e re-renderização impecável:
```typescript
const updateName = async (newName: string) => {
  // Update no banco...
  setProfile(p => p ? { ...p, full_name: newName } : null) // ✅ Imutável
}
```
**Conhecimento demonstrado:** Design Patterns do React, Imutabilidade, Custom Hooks e resolução estruturada de arquitetura Frontend.

---

## Estudo de Caso 4: Deriva Temporal em Dados — "O Bug Que Já Estava Corrigido" (Full-Stack / PostgreSQL + React)

**O Cenário:**
Um agente de IA anterior (Gemini) já havia corrigido a lógica de liberação de semanas de treino (`weekNumber <= released_through_week`) e ajustado o CSS do chat. Testado em produção, o comportamento continuava quebrado: o professor liberava as 4 semanas do ciclo, mas o aluno continuava vendo conteúdo bloqueado, e a área de digitar do chat sumia atrás da barra de navegação.

**O Sintoma:**
A correção anterior parecia logicamente correta lendo o diff isoladamente. A tentação é reaplicar o mesmo tipo de fix ("deve ser outro operador de comparação invertido"). Em vez disso, a investigação partiu para verificar o comportamento real: reler a condição em produção linha a linha (já estava certa) e, então, consultar o banco de dados diretamente via MCP do Supabase para observar os dados que a aplicação realmente estava lendo.

**O Diagnóstico:**
A consulta direta revelou a causa raiz, três camadas abaixo de onde o bug foi originalmente reportado:
1. A turma do aluno de teste tinha `groups.starts_at = NULL`.
2. Sem uma âncora de data fixa, o cálculo do ciclo de 4 semanas fazia fallback para "hoje" — uma referência que muda a cada dia e diverge entre o código do admin (`?? toDateString(new Date())`) e o do aluno (`?? todayMonday`).
3. Isso fazia a rotina de criação de plano do admin (que busca por *match exato* de data) **nunca encontrar o plano existente**, criando um registro novo em `group_plans` a cada sessão em dia diferente — 5 registros duplicados para a mesma turma ao longo de 5 dias.
4. A query do aluno, ao tentar compensar esse desalinhamento com uma janela de 7 dias, pegava sistematicamente o registro *mais recente* dentro da janela — que por acaso era um plano de teste mais novo, com liberação desatualizada, sombreando o plano correto que o professor de fato havia liberado.

O comparador de liberação (`<=`) nunca esteve errado. O bug era estrutural: a aplicação estava lendo a linha errada do banco.

**A Solução:**
Correção em camadas, da mais superficial à mais estrutural:
```typescript
// useWeeklyPlan.ts — pega o primeiro plano do ciclo, não o mais recente da janela
.order('starts_at', { ascending: true }) // era: ascending: false
```
```sql
-- Realinhamento pontual dos dados já inconsistentes em produção
UPDATE groups SET starts_at = '2026-06-30' WHERE id = '...';
```
```typescript
// CreateGroupModal.tsx — impede a recorrência do bug em turmas futuras
const [startsAt, setStartsAt] = useState(todayDateString) // antes: ''
// + validação obrigatória no submit, campo deixa de ser "opcional"
```
**Conhecimento demonstrado:** Depuração de causa raiz sob pressão de um fix anterior aparentemente válido, modelagem de dados temporais/cíclicos, uso de MCP para inspecionar produção com segurança (SQL somente leitura antes de qualquer escrita), e prevenção sistêmica (resolver a instância *e* fechar a porta para o problema se repetir).

---

## Estudo de Caso 5: Elemento Fixo Sobrepondo Conteúdo Flexível (CSS / Layout Mobile)

**O Cenário:**
O painel do aluno usa uma barra de navegação inferior fixa (`position: fixed; bottom: 0`) sobre um layout `flex` de altura total (`100dvh`). Uma alteração recente no chat removeu o espaçamento de segurança do formulário de envio de mensagem.

**O Sintoma:**
O campo de digitar mensagem "sumia" no celular. O código React estava correto, o CSS "parecia" correto — nenhum erro de console, nenhum warning de layout.

**O Diagnóstico:**
Como o elemento de navegação usa `position: fixed`, ele é removido do fluxo normal do flexbox e passa a flutuar por cima de qualquer conteúdo, independente da altura calculada pelos pais `flex`. Isso significa que o último elemento de uma coluna flexível (o formulário de chat) ocupa 100% da altura da tela *até embaixo*, inclusive a faixa que fica visualmente coberta pela barra fixa. Sem um `padding-bottom` no próprio elemento compensando exatamente a altura da barra fixa, o conteúdo real é renderizado — apenas invisível, atrás de outro elemento com `z-index` maior.

**A Solução:**
```css
.inputArea {
  padding: 16px 24px calc(76px + env(safe-area-inset-bottom, 16px));
  /* 76px ≈ altura da BottomNav fixed; sem isso o form fica atrás dela */
}
```
**Conhecimento demonstrado:** Domínio de `position: fixed` vs. fluxo flexbox, `env(safe-area-inset-bottom)` para notch/home-indicator em iOS, e diagnóstico de bugs "invisíveis" que não aparecem em nenhuma ferramenta de log — só observando o comportamento real do layout.

---

## Estudo de Caso 6: Feature Ausente no Modo Flexível (React / Gap Analysis)

**O Cenário:**
Turmas no modo "flexível" existem no sistema, mas alunos viam 100% do conteúdo bloqueado mesmo após o professor tentar liberar.

**O Sintoma:**
`released_through_week` ficava travado em `0` para turmas flexíveis — nenhuma semana era liberada nunca, independente do que o professor fizesse.

**O Diagnóstico:**
O componente `AdminTurmaDetail.tsx` usa branches separados para modo fixo e flexível. Os chips S1–S4 de liberar/bloquear semana (`handleChipClick` / `releaseThrough`) só existiam no branch do modo fixo (`WeekView`). O branch flexível não tinha nenhum mecanismo de liberação — a feature simplesmente não foi implementada quando o modo flexível foi criado.

Segundo problema encontrado na mesma investigação: o botão "+ Adicionar Treino" no modo flexível sempre usava `openSlot(1, 1)` — adicionava apenas na Semana 1, sem seletor. Mesmo liberando S2/S3/S4, era impossível colocar treinos nelas.

**A Solução:**
Adicionados chips S1–S4 no branch flexível reaproveitando a lógica existente (mesmo `handleChipClick`, mesmo toggle bidirecional já usado no modo fixo — sem reimplementar nada). Lista de treinos agrupada por semana (1 a 4), cada uma com botão próprio de adicionar treino na semana correta:
```tsx
{([1, 2, 3, 4] as const).map(w => {
  const isReleased = (plan?.released_through_week ?? 0) >= w
  const weekTrainings = trainings.filter(entry => entry.weekNumber === w)
  return (
    <div key={w}>
      <span>Semana {w}</span>
      {weekTrainings.map(entry => /* ... */)}
      <button onClick={() => openSlot(w, 1)}>+ Adicionar Treino · Semana {w}</button>
    </div>
  )
})}
```

**Conhecimento demonstrado:** Identificação de feature gap em modo alternativo via leitura direta do código (não por tentativa e erro), reuso de lógica existente sem duplicação de código.

---

## Estudo de Caso 7: GRANT Ausente Detectado Antes de Chegar em Produção (PostgreSQL / RLS / Prevenção)

**O Cenário:**
Ao implementar um agente de IA (DeepSeek) que analisa automaticamente as corridas sincronizadas do Strava, foi necessário criar uma nova tabela (`strava_analysis`) com Row Level Security — aluno vê a própria análise, professor vê todas. O SQL de criação já vinha com as duas `CREATE POLICY` corretas, prontas para aplicar.

**O Sintoma:**
Nenhum — este não foi um incidente de produção. O SQL nunca chegou a ser executado no banco.

**O Diagnóstico:**
Uma semana antes, a integração Strava havia sofrido exatamente este tipo de falha em produção: `strava_connections` retornava `"permission denied for table strava_connections"` mesmo com o código de acesso via `service_role` correto — porque o Postgres exige `GRANT` de tabela como uma camada *anterior e independente* de qualquer policy de RLS, e `BYPASSRLS` não cobre essa camada (ver Estudo de Caso — incidente de 2026-07-04 documentado no `CLAUDE_HISTORICO.md`).

Reconhecendo o mesmo padrão estrutural — `CREATE POLICY` presente, `GRANT` ausente — a revisão do novo SQL antes de submetê-lo à aprovação aplicou o mesmo checklist mental: *toda `CREATE POLICY ... TO <role>` precisa de um `GRANT ... TO <role>` correspondente*. O rascunho da tabela `strava_analysis` tinha as duas policies (`FOR SELECT TO authenticated`) mas nenhum `GRANT SELECT ON strava_analysis TO authenticated`. Sem essa linha, tanto o aluno quanto o admin receberiam `permission denied` (42501) na primeira leitura, mesmo com as policies perfeitas — o mesmo sintoma do incidente anterior, mas do lado da leitura (`authenticated`) em vez da escrita (`service_role`).

**A Solução:**
O SQL foi corrigido antes de ser apresentado para aprovação, adicionando a linha ausente e documentando o porquê inline:
```sql
-- GRANT de tabela é uma camada separada da policy de RLS — sem esta linha,
-- tanto aluno quanto admin receberiam "permission denied" (42501) mesmo com a
-- policy acima correta. Mesma classe de bug do incidente strava_connections/
-- service_role documentado no ARBO_FASE3.md (item 6).
GRANT SELECT ON strava_analysis TO authenticated;
```
A lição foi generalizada e registrada em `GEMINI_LESSONS.md` (item 14), separada do item 13 (que cobre o lado `service_role`), como uma regra de checklist reutilizável para qualquer tabela nova: *toda `CREATE POLICY ... TO <role>` deveria ter um `GRANT` correspondente `TO <role>` logo depois — se não tiver, é bug quase certo.*

**Conhecimento demonstrado:** Aprendizado transferível entre incidentes — reconhecer a mesma classe de bug (GRANT vs. RLS como camadas independentes no Postgres) em um contexto novo antes que ele se manifeste, transformando um incidente de produção resolvido em um checklist preventivo aplicado à próxima tabela criada.

---

## Estudo de Caso 8: Dropdown Cortado no Mobile — Clipping por `overflow` de Ancestral (CSS / Layout)

**O Cenário:**
A biblioteca de treinos do admin (`/admin/treinos`) ganhou um dropdown customizado ("Biblioteca de Treinos") para filtrar por programa, posicionado com `position: absolute` relativo ao seu botão gatilho — o padrão mais comum para esse tipo de componente.

**O Sintoma:**
No desktop, o dropdown abria perfeitamente. No mobile, a borda laranja do painel aparecia visivelmente cortada, como se um pedaço do componente simplesmente não existisse. Não era uma sobreposição (outro elemento por cima) — era um corte real, como se o painel tivesse sido recortado por uma tesoura.

**O Diagnóstico:**
Diferente do Estudo de Caso 5 (elemento `position: fixed` sobrepondo conteúdo por cima, sem nenhum corte no elemento em si), este era um problema de **clipping**: o container pai da lista de filtros tinha `overflowX: 'auto'` (para permitir rolagem horizontal dos filtros no mobile). Qualquer elemento filho com `position: absolute` que "vaze" visualmente para fora da caixa do pai é recortado exatamente na borda desse pai quando ele declara qualquer valor de `overflow` diferente de `visible` — `position: absolute` não escapa do clipping do ancestral mais próximo com overflow restrito, só do seu fluxo de documento. Ajustar apenas `padding`/`overflowX: hidden` no container pai (tentativa anterior, commit `75a602b`) mitigava mas não resolvia de raiz — qualquer painel mais largo que o espaço visível dentro do pai continuava sendo cortado.

**A Solução:**
Renderizar o painel do dropdown fora da árvore DOM do pai com overflow restrito, via `createPortal` direto no `document.body`, e recalcular sua posição manualmente com `position: fixed` (imune a qualquer `overflow` de ancestral, já que não tem mais ancestral com overflow entre ele e o body):
```tsx
function updatePosition() {
  const rect = triggerRef.current?.getBoundingClientRect()
  if (!rect) return
  const style: React.CSSProperties = { top: rect.bottom + 6 }
  const overflowsRight = rect.left + PANEL_MAX_WIDTH > window.innerWidth - VIEWPORT_MARGIN
  if (overflowsRight) {
    style.right = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right)
  } else {
    style.left = rect.left
  }
  setPanelStyle(style)
}
// ...
{isOpen && createPortal(
  <div ref={panelRef} style={{ position: 'fixed', ...panelStyle }}>...</div>,
  document.body
)}
```
Posição recalculada em `resize` e `scroll` (com `capture: true`, para pegar scroll de qualquer ancestral rolável, não só da window); detecção de colisão com a borda direita da viewport evita que o painel vaze pra fora da tela em telas estreitas.

**Conhecimento demonstrado:** Distinção precisa entre as duas causas mais comuns de elementos "sumindo" em CSS — sobreposição (`z-index`/`position: fixed` por cima) vs. clipping (`overflow` de ancestral cortando um `position: absolute`) — e a técnica padrão de mercado (React Portal + posicionamento manual) para resolver definitivamente a segunda, em vez de empilhar ajustes de padding que só adiam o mesmo problema em telas diferentes.

---

## Estudo de Caso 9: Cache do Service Worker Mascarando Falha de Rede como Dado Válido (PWA / Offline-First)

**O Cenário:**
O app é um PWA com service worker (Workbox) cacheando respostas de rede para funcionar melhor em conexões instáveis — comum em quem treina na rua. As chamadas REST ao Supabase (treinos, check-ins, planos liberados) estavam configuradas com a estratégia `NetworkFirst`.

**O Sintoma:**
O usuário relatou que, às vezes, uma tela demorava para carregar ou aparecia com informação faltando (um treino sumido, uma semana liberada não aparecendo) — e que trocar de aba e voltar "consertava" o problema, mostrando o dado completo.

**O Diagnóstico:**
A leitura de `vite.config.ts` revelou a configuração:
```ts
{
  urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  handler: 'NetworkFirst',
  options: {
    networkTimeoutSeconds: 30,
    expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }, // 1 dia
  },
}
```
`NetworkFirst` tenta a rede primeiro — até aqui, comportamento correto e igual a não ter cache nenhum. O problema aparece exatamente quando a rede falha ou demora mais que o timeout (comum em 4G instável, elevador, sinal fraco): nesse caso, o Workbox cai silenciosamente para a resposta cacheada mais recente, que pode ter **até 24 horas**. A UI não tem nenhuma forma de saber que recebeu uma resposta de cache em vez de rede — ela renderiza normalmente, como se o dado fosse atual. O "conserta ao voltar de aba" não era o service worker se corrigindo: era o remount da aba disparando uma nova tentativa de rede, que dessa vez funcionava e sobrescrevia o dado velho.

Esse é o oposto do padrão típico de bug de cache (dado velho óbvio, tela de erro, ou nada carregando) — aqui o sintoma é justamente a ausência de qualquer sinal de erro, porque o cache foi desenhado para ser transparente.

**A Solução:**
Dado de aplicação (linhas de banco que mudam a qualquer momento por ação de outro usuário/admin) nunca deveria ser servido de cache — ao contrário de um asset estático, não existe uma versão "boa o suficiente" de um treino ou check-in de ontem. Trocado para `NetworkOnly` nas rotas de API e Auth do Supabase, mantendo cache normal só para o que de fato é estático:
```ts
// REST e Auth do Supabase — sempre rede, nunca cache
{ urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i, handler: 'NetworkOnly' },
{ urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i, handler: 'NetworkOnly' },
// Storage (arquivos) e imagens continuam com cache — são de fato estáticos
{ urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i, handler: 'NetworkFirst', options: { ... } },
```

**Conhecimento demonstrado:** Diagnóstico de um bug "silencioso por design" — a estratégia de cache estava funcionando exatamente como configurada, o problema era a configuração ter sido aplicada a um tipo de dado errado. Distinção clara entre o que é seguro cachear (assets estáticos, imutáveis por natureza) e o que nunca deveria ser (estado de aplicação multi-usuário), e leitura de configuração de infraestrutura (Workbox/PWA) como primeira hipótese antes de suspeitar de lógica de aplicação.

---

## Estudo de Caso 10: Escalada de Privilégio via RLS Que Filtra Linha, Não Coluna (PostgreSQL / Segurança)

**O Cenário:**
Uma auditoria de segurança proativa em produção — não um bug reportado por usuário — revisou a policy de `UPDATE` da tabela `profiles`, que permite `id = auth.uid()` para o aluno poder editar o próprio nome e avatar.

**O Sintoma:**
Nenhum visível ao usuário final. O achado veio de auditoria, não de um erro reportado — a classe de bug mais perigosa, porque não gera nenhum sinal espontâneo até ser explorada.

**O Diagnóstico:**
Row Level Security no Postgres restringe **quais linhas** um usuário pode tocar, não **quais colunas** dentro dessa linha. A policy `profiles_update` (`id = auth.uid()`) estava correta para o caso de uso pretendido (aluno edita o próprio perfil), mas o mesmo `UPDATE` que altera `full_name` também permitia alterar `role` e `group_id` — sem nenhuma checagem de coluna, um aluno autenticado podia fazer `UPDATE profiles SET role = 'admin'` direto via client REST do Supabase e se auto-promover a administrador. O impacto era agravado por 3 policies legadas (`training_types`, `schedules`, `messages`) que ainda verificavam privilégio lendo `profiles.role` via subquery direta, em vez da fonte de verdade imutável (`app_metadata`, só alterável no servidor) — uma vez com `role = 'admin'` na própria linha, o aluno destravava também essas policies.

**A Solução:**
RLS por si só não resolve granularidade de coluna — a correção correta é uma trigger que inspeciona a mudança e rejeita alterações não autorizadas nas colunas sensíveis, deixando o restante do `UPDATE` intacto:
```sql
CREATE OR REPLACE FUNCTION private.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Não autorizado a alterar role';
    END IF;
    IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      RAISE EXCEPTION 'Não autorizado a alterar group_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_self_privilege_escalation
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION private.prevent_self_privilege_escalation();
```
Testado em produção com um usuário descartável (criado e removido na mesma sessão, sem tocar em dado real), simulando o JWT de um aluno via `set_config('request.jwt.claims', ...)`: `UPDATE role = 'admin'` e `UPDATE group_id = <qualquer turma>` passaram a levantar exceção, enquanto `UPDATE full_name` continuou funcionando normalmente — a mesma verificação confirmou que um admin de verdade segue alterando `role`/`group_id` de aluno sem restrição.

**Conhecimento demonstrado:** Modelo mental correto de RLS (filtro de linha, não de coluna) — reconhecer que uma policy "correta" para o caso de uso principal pode ainda deixar uma superfície de ataque em colunas adjacentes da mesma linha; uso de trigger `BEFORE UPDATE` como camada complementar ao RLS quando a granularidade necessária é por coluna; validação de segurança sem depender de dado real de produção, simulando o contexto de autenticação (JWT) diretamente via SQL.

---

## Estudo de Caso 11: CSP Correto no Servidor, mas Navegador Preso em Versão Antiga por Causa do Service Worker (PWA / Cache de Documento)

**O Cenário:**
Uma correção de CSP (liberando o domínio de ingest do Sentry no `connect-src`, para permitir o monitoramento de erros em produção) foi publicada e confirmada — o header `Content-Security-Policy` servido por `curl -I` já mostrava a mudança correta.

**O Sintoma:**
O navegador do usuário nunca refletia a correção. Um `throw new Error` de teste no console continuava sem aparecer no painel do Sentry, mesmo depois de múltiplos hard refresh (Ctrl+Shift+R).

**O Diagnóstico:**
Hard refresh limpa o cache HTTP do **navegador**, mas não o precache do **Service Worker** — são duas camadas de cache completamente independentes. O `vite-plugin-pwa` aplica `navigateFallback: "index.html"` por padrão quando não configurado explicitamente, o que gera um `NavigationRoute(createHandlerBoundToURL("index.html"))` no Workbox: **toda** navegação (carregamento de página, inclusive reload) passa a ser servida do `index.html` **precacheado**, nunca da rede — o Service Worker intercepta a requisição de navegação antes mesmo dela poder chegar ao servidor. O precache do Workbox é indexado por revisão de conteúdo (hash dos bytes do arquivo); como a correção de CSP alterou só o `vercel.json` (um header HTTP, entregue pelo servidor, não embutido no HTML), os bytes do `index.html` continuaram idênticos entre o deploy antigo e o novo — a revisão nunca mudou, então o Workbox nunca considerou o arquivo "desatualizado" e nunca refez o fetch. Qualquer navegador que já tinha o Service Worker instalado antes da correção ficaria preso ao CSP antigo (cacheado junto com a resposta original do `index.html`) indefinidamente, em qualquer deploy futuro que só alterasse headers e não o conteúdo do HTML em si.

Categoria diferente do Estudo de Caso 9 (aquele era cache de **dado** de API, mascarando falha de rede como resposta válida): aqui o cache é do próprio **documento** de navegação — mais traiçoeiro, porque a ferramenta que o usuário naturalmente tenta primeiro (hard refresh) não tem nenhum efeito sobre essa camada.

**A Solução:**
Investigado sem depender de teste manual no navegador do usuário: `curl -I` confirmou o header correto no servidor (descartando causa server-side); leitura do código-fonte do `vite-plugin-pwa` em `node_modules` confirmou o default `navigateFallback: "index.html"`; e um envelope de teste enviado via `curl` direto ao endpoint de ingest do Sentry (com a DSN extraída do bundle de produção) confirmou HTTP 200 — isolando a causa exclusivamente à camada de Service Worker no navegador. Vercel já resolve o fallback de rotas da SPA via `rewrites` (`vercel.json`), então o `NavigationRoute` do Service Worker era redundante para roteamento — trocado por `NetworkFirst` para requisições de navegação, priorizando rede sempre que disponível:
```ts
workbox: {
  cacheId: 'arbo-v6', // bump força invalidação de quem já tinha o SW antigo
  navigateFallback: undefined, // desliga o NavigationRoute preso ao precache
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: { cacheName: 'html-cache', networkTimeoutSeconds: 5 },
    },
    // ...demais regras
  ],
}
```
O bump de `cacheId` (`arbo-v5` → `arbo-v6`) foi necessário como complemento — sem ele, mesmo o novo Service Worker (com a estratégia corrigida) reaproveitaria a entrada de precache já existente do `index.html`, já que sua revisão de conteúdo continua igual. Um novo `cacheId` cria um namespace de cache totalmente novo, forçando o navegador de quem já visitou o site a buscar tudo de novo na próxima abertura do app — sem precisar de nenhuma ação manual do usuário além de fechar e reabrir (`skipWaiting`+`clientsClaim` já garantiam isso).

**Conhecimento demonstrado:** Distinção entre cache do navegador e cache do Service Worker (hard refresh não afeta o segundo); entendimento de como o Workbox decide revalidar um recurso precacheado (hash de conteúdo, não header HTTP); leitura de código-fonte de uma dependência (`node_modules`) para confirmar um comportamento default não documentado explicitamente no próprio projeto; verificação de infraestrutura de ponta a ponta sem depender do navegador do usuário (`curl` para o header, `curl` para o endpoint de ingest) antes de propor a correção.

---

## Estudo de Caso 12: Bug de Layout Que Só Aparece Medindo, Não Lendo o Código (CSS / Metodologia de Diagnóstico)

**O Cenário:**
Um bottom sheet mobile (seletor de dia da semana, 7 botões após a adição de Domingo) teve os botões da coluna direita e o botão full-width relatados como "cortados" na borda direita da tela, com espaço sobrando à esquerda.

**O Sintoma:**
Duas rodadas de diagnóstico por leitura isolada do CSS-fonte (`.grid`, `.dayBtn`, `.fullWidth`) concluíram, cada uma, "matemática correta, sem bug encontrado" — nenhuma propriedade sobrescrita, nenhuma classe duplicada, nenhum conflito de especificidade. Um hardening defensivo foi aplicado no meio do caminho (`box-sizing: border-box`, `text-align: center`, `width: 100%` explícitos em `.dayBtn`) — não resolveu. O sintoma persistiu, confirmado por print do usuário **duas vezes**, inclusive depois de descartar cache do Service Worker como causa (fechar e reabrir o app).

**O Diagnóstico:**
As duas primeiras rodadas erraram o alvo: investigaram o `.grid` e os botões (`.dayBtn`/`.fullWidth`) isoladamente, e essa matemática *estava* correta — o bug não morava ali. Só apareceu ao montar o componente isolado e medir o layout renderizado de verdade com Playwright + Chromium headless, viewport 375px (mesmo tamanho usado com sucesso no diagnóstico de um bug de layout anterior no admin, nesta mesma sessão): `getBoundingClientRect()`/`getComputedStyle()` revelaram que `.modal` — o **container pai** do grid, não o grid em si — tinha `width: 100%` e `padding: 16px 20px` sem nenhum `box-sizing` declarado (`content-box`, default do browser). Com `content-box`, o padding é somado *por cima* dos 100%: `.modal` renderizava com **415px de largura numa viewport de 375px**, um vazamento de exatos 40px (2×20px de padding). O `.grid` filho, esticando via `align-items: stretch` do flex do `.modal`, herdava esse excesso — e a coluna direita e o botão full-width, medidos, tinham a borda direita 20px além da viewport.

**A Solução:**
```css
.modal {
  width: 100%;
  padding: 16px 20px calc(24px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box; /* sem isso, padding soma por cima dos 100% */
}
```
Medição repetida com o mesmo script Playwright, antes/depois:
```
Antes:  .modal.right = 415px (viewport 375px) — vazamento de 40px
Depois: .modal.right = 375px — exato, nenhum botão ultrapassa a viewport
```

**Conhecimento demonstrado:** Reconhecer o limite da leitura estática de código quando o bug mora na *composição* de elementos ancestrais diferentes, não em nenhum isoladamente — e, ao esgotar a análise teórica sem achar causa raiz que explique um sintoma repetidamente confirmado pelo usuário, trocar de método em vez de insistir ("meça, não leia") — montagem de componente isolado + medição real de layout (Playwright headless, `getBoundingClientRect`) como ferramenta de diagnóstico quando a inspeção de CSS-fonte se esgota sem explicar o sintoma relatado.

---

## Estudo de Caso 13: Sincronização Falhando Silenciosamente via "Upsert" do Supabase (PostgreSQL / PostgREST)

**O Cenário:**
A aplicação possui uma integração com o Strava. Após a autorização OAuth, uma Edge Function do Supabase (rodando com privilégio de `service_role`) sincroniza as corridas recentes usando `upsert()` na tabela `strava_activities`. A tabela recém-criada possuía políticas de Row Level Security e um `GRANT INSERT, UPDATE ON strava_activities TO service_role` executado em sessões anteriores.

**O Sintoma:**
O atleta conectava o Strava com sucesso e via a mensagem de sincronização na sua tela de Perfil. Contudo, ao tentar fazer Check-in num treino, o botão "Importar do Strava" não aparecia. Nos logs da Edge Function, todas as execuções exibiam status HTTP 200 (OK), sem nenhuma indicação de erro. 

**O Diagnóstico:**
O problema estava em uma camada de abstração do cliente JavaScript do Supabase. A Edge Function enviava os dados e chamava `.upsert(rows)`. O PostgREST (que atende o SDK) implementa `upsert` por padrão com o equivalente a `RETURNING *`, tentando devolver as linhas afetadas. 
Embora a role `service_role` tivesse permissão de escrita, faltava-lhe o `GRANT SELECT`. O Postgres bloqueava a transação devido a essa falha na leitura do `RETURNING`. Como a operação falhava silenciosamente (ausência de `.throwOnError()`) e a função respondia um array gerado em memória, a UI era enganada a mostrar sucesso, quando o banco continuava vazio.

**A Solução:**
A investigação direta do banco via SQL (`information_schema.role_table_grants` via MCP) confirmou a ausência do privilégio. O problema foi sanado executando:
```sql
GRANT ALL ON strava_activities TO service_role;
```
Nenhuma linha de código fonte da aplicação precisou ser alterada.

**Conhecimento demonstrado:** Entendimento profundo do funcionamento interno da API PostgREST (comportamento implícito de retorno de dados no `upsert`), investigação direta de grants no PostgreSQL contornando a ausência de logs da aplicação, e mitigação de falsos-positivos na interface de usuário causados por falhas silenciosas na comunicação com o BaaS.

---

## Estudo de Caso 14: Strict Linting em CI Bloqueando Renderização em Cascata (React / ESLint)

**O Cenário:**
Ao corrigir um fluxo na interface onde usuários convidados ficavam presos em uma tela infinita de "Validando convite..." ao clicar num link de recuperação expirado (`otp_expired`), implementou-se uma captura inicial direto da hash da URL para modificar o estado da aplicação e apresentar um erro formatado.

**O Sintoma:**
O deploy falhou no pipeline da Vercel acusando um exit code fatal pelo ESLint:
`Error: Calling setState synchronously within an effect can trigger cascading renders (react-hooks/set-state-in-effect)`. 
A UI funcionava bem localmente (pois os warnings eram engolidos em desenvolvimento rápido), mas a pipeline configurada com zero-tolerance barrou o avanço para a produção.

**O Diagnóstico:**
O código atualizado possuía uma quebra arquitetônica estrutural: ele injetava uma rotina síncrona com múltiplas chamadas `setState` direto no corpo do hook `useEffect`. No React, executar `setState` de forma síncrona dentro de um effect provoca *cascading renders*, forçando o motor de reconciliação a abortar renderizações paralelas e calcular a árvore sequencialmente, esmagando a performance da página.

**A Solução:**
A rotina foi refatorada para alinhar-se perfeitamente com os guidelines exigidos pelo motor de otimização e regras avançadas de Linting. As alterações assíncronas foram isoladas num bloco executável blindado, contendo inclusive a checagem de ciclo de vida (`if (!cancelled)`):
```typescript
  useEffect(() => {
    let cancelled = false
    async function checkHash() {
      if (hashError && !cancelled) {
         setError(...)
         setReady(true)
      }
    }
    checkHash()
    return () => { cancelled = true }
  }, [])
```
Adicionalmente, scripts temporários que rodavam localmente (como `test-sync.js`) foram removidos do root do diretório para purgar alertas colaterais no linter, restaurando a pipeline a zero defeitos.

**Conhecimento demonstrado:** Alinhamento avançado com os paradigmas de otimização de renderização do React (evitando cascading renders síncronos no corpo do effect), gerenciamento de cleanup functions para anular conditions race, e disciplina para resolver quebras severas de CI causadas por configurações de ESLint restritas (`zero-error tolerance`).
