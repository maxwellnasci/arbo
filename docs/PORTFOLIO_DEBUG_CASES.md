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
