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
