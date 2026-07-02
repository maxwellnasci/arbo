# Lições do Gemini — Arbo

> Arquivo criado para registrar erros recorrentes e como evitá-los.
> Leia sempre antes de implementar features grandes.

## Erros cometidos e como evitar

### 1. Componentes criados mas não integrados
**O que aconteceu:** DayPicker e FlexibleTrainingCard foram criados mas não integrados no AlunoDashboard.
**Como evitar:** Ao criar um componente novo, sempre verificar onde ele será usado e integrar no mesmo momento.

### 2. Tipos divergindo do banco
**O que aconteceu:** GroupMode foi implementado como 'fixed'|'flexible' mas o banco tem CHECK (mode IN ('fixo', 'flexivel')).
**Como evitar:** Sempre espelhar EXATAMENTE o valor do CHECK constraint do banco. Se o banco tem 'fixo', o código tem 'fixo' — nunca traduzir ou renomear.

### 3. Queries com campos errados
**O que aconteceu:** useScheduling usou group_plan_training_id onde deveria usar group_plan_id.
**Como evitar:** Antes de escrever qualquer query, verificar o database.types.ts para confirmar o nome exato das colunas.

### 4. JOINs inválidos
**O que aconteceu:** useScheduling tentou fazer JOIN em tabela que não tinha relação direta.
**Como evitar:** Verificar as FKs no database.types.ts antes de qualquer JOIN no Supabase.

### 5. Lint apressado introduz novos erros
**O que aconteceu:** Tentativa de corrigir lint rapidamente introduziu erros de sintaxe no ProfessorStatusGrid.
**Como evitar:** Nunca fazer limpeza de lint em múltiplos arquivos de uma vez sem testar cada um. Rodar npx tsc --noEmit após cada arquivo.

### 6. "0 erros" não significa que está correto
**O que aconteceu:** Gemini reportou "0 erros" mas o Claude Code encontrou 4 críticos.
**Como evitar:** Sempre rodar npx tsc --noEmit && npm run lint && npm run build && npm test e mostrar o output completo. Nunca reportar "0 erros" sem mostrar o output real.

### 7. Scripts temporários esquecidos na raiz
**O que aconteceu:** patch2.py, patch3.py, patch_modals.py ficaram na raiz do projeto.
**Como evitar:** Nunca criar scripts temporários na raiz. Se precisar, criar em /tmp/ ou deletar imediatamente após usar.

### 8. RPC não mapeada nos tipos Supabase
**O que aconteceu:** Erro `TS2345: Argument of type 'any' is not assignable to parameter of type 'never'` ao usar `supabase.rpc('nome' as any)` porque a nova RPC não estava no `database.types.ts`.
**Como evitar:** Sempre rodar `npx supabase gen types` após criar RPC nova. Caso necessário fazer bypass, **sempre castear o cliente inteiro**: `(supabase as any).rpc('nome', { ... })`. Nunca usar `'nome' as any` no argumento — contamina a inferência do overload.

### 9. Corte de tela (Safari bug com Flex-Column + Overflow-Y)
**O que aconteceu:** Múltiplas tentativas falhas de corrigir o corte de conteúdo no `AlunoDashboard` adicionando `min-height: 0` e ajustando wrappers no escuro.
**Como evitar:** 
- A causa real era o motor WebKit falhando ao calcular o `scrollHeight` em um elemento que era simultaneamente um **flex container** (com `flex-direction: column`) e o **scroller** (`overflow-y: auto`), sem ter um ancestral direto com `overflow: hidden`.
- Em vez de testar fixes cegos, **sempre compare com um layout que já funciona**. A solução final (adicionar um `.contentWrapper` com `flex: 1; overflow: hidden`) foi encontrada rapidamente comparando o código quebrado do Aluno com o código funcionando do `AdminLayout`.

### 10. Tela elástica no iOS Safari (Overscroll/Swipe-to-go-back)
**O que aconteceu:** O usuário arrastava a tela lateralmente e o conteúdo deslizava e voltava (elástico), parecendo um bug de animação (`drag`) quando na verdade era o comportamento nativo do navegador.
**Como evitar:**
- Em PWAs e interfaces que simulam apps nativos, sempre aplique `touch-action: pan-y; overscroll-behavior-x: none;` no container raiz (`.page` ou `.contentWrapper`) caso ele tenha scroll vertical mas você queira bloquear as ações nativas horizontais (como o swipe para voltar/avançar). Isso previne completamente a "puxada elástica" e mantém o app firme como um app nativo.

### 11. Classes órfãs no CSS e Herança de Touch-Action
**O que aconteceu:** As propriedades do overscroll foram aplicadas a um `.contentWrapper` no CSS que sequer existia no JSX. O Gemini reportou como "corrigido", mas o bug persistiu. Além disso, as propriedades não herdaram corretamente do elemento pai `.page`.
**Como evitar:**
- **Sempre verifique se a classe CSS está de fato sendo usada no JSX** antes de considerar um fix concluído. Nunca presuma que a marcação possui a mesma estrutura que o CSS.
- **`touch-action` não é herdado pela árvore inteira de forma mágica no iOS Safari** — ele precisa estar explicitamente associado ao elemento que recebe o toque (os scrollers reais dos filhos) ou em cada ancestral direto que compõe a cadeia daquele scroll container.
- Sempre garanta que elementos fixos ou dinâmicos que não devem encolher sob pressão do Flexbox possuam `flex-shrink: 0` (como a `inputArea` do chat).

## Regras de ouro

1. **Espelhar o banco** — tipos, enums e valores sempre iguais ao SQL
2. **Integrar imediatamente** — componente criado = componente integrado no mesmo commit
3. **Mostrar output real** — nunca reportar sucesso sem colar o output dos comandos
4. **Não criar arquivos temporários** na raiz do projeto
5. **Verificar database.types.ts** antes de qualquer query ou JOIN

### 12. Falso Positivo de "0 erros" devido ao Cache do TypeScript (tsbuildinfo)
**O que aconteceu:** Uma variável/função inutilizada foi deixada para trás, mas o comando `npm run build` rodado localmente passou sem erros (apesar do `tsconfig.json` ter `noUnusedLocals: true`). No entanto, o Vercel falhou com erro `TS6133` porque rodou uma build limpa. O build local passou incorretamente devido ao cache de compilação incremental do `tsc -b` (`tsconfig.tsbuildinfo`).
**Como evitar:**
- **Sempre apague o cache antes de validar builds finais** ou rode um comando sem emitir cache: `rm -rf tsconfig.tsbuildinfo && npx tsc --noEmit`. 
- Nunca assuma que o `tsc -b` pegou todos os erros de lint/unused se o arquivo foi modificado apenas superficialmente e o cache incremental o ignorou.


### Timezone Bugs em Dashboards (2026-07-02)
- **Problema**: O `getCurrentCycle` usava `new Date(startsAt)` (string YYYY-MM-DD), o que resulta em UTC. Em GMT-3 (Brasil), isso jogava a data para o dia anterior (ex: dia 29 virava dia 28), fazendo o Supabase retornar null no `group_plans`.
- **Lição**: getMonday() e qualquer cálculo de data/semana deve usar horário LOCAL (getDay/setDate), nunca UTC (getUTCDay/setUTCDate), especialmente em apps usados no Brasil (GMT-3). Diferença de timezone pode fazer o app mostrar a semana errada. Para contornar conversões automáticas do construtor de `Date` com strings, sempre converta "YYYY-MM-DD" quebrando a string `startsAt.split('-')` e criando a data com `new Date(y, m-1, d)`.
