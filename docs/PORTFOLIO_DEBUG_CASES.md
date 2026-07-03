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
