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

### 5. Upload de vídeo no admin
Hoje o app suporta apenas link do YouTube (Task 61). Avaliar se o professor quer
upload direto (Supabase Storage) ou se o link do YouTube já resolve.

### 6. Integração Strava
Hoje é placeholder (strava_connected: false, nunca implementado de verdade).
Necessário: criar app no Strava Developer (Client ID/Secret), OAuth, Edge Function
para sincronizar atividades.

### 7. Agente de resposta no Strava
Depende do item 6 estar pronto. Definir comportamento exato com o professor
(comentar na atividade, notificar professor, sincronizar dado no app, etc).

## Status
Roadmap criado em 2026-06-30. Itens 1 e 3 implementados e validados. Aguardando próximos passos do professor.

## Correções Adicionais (2026-07-01)
- Corrigido corte de tela no `DayPicker` em dispositivos menores (scroll interno e max-height).
- Ajustado espaçamento inferior (padding-bottom) no container do painel do aluno para evitar sobreposição da BottomNav aos cards de treino.
- Corrigido o corte do balão de mensagens do `AlunoChat` através de ajustes na hierarquia do flex wrapper.
- Refatoração profunda da arquitetura de layout do AlunoDashboard, replicando o padrão do AdminLayout (uso de `.contentWrapper` com `flex: 1; overflow: hidden`) para isolar o contexto de formatação do WebKit e impedir cortes de conteúdo no iOS Safari sem disparar a barra de rolagem nativa.
- Corrigido desaparecimento do input do chat aplicando `flex-shrink: 0` no container `.inputArea` do AlunoChat (evitando que ele fosse reduzido a 0 de altura pelo flexbox sob pressão do wrapper).
- Bloqueado o comportamento elástico nativo de arrasto horizontal do iOS Safari (Swipe-to-go-back/Overscroll) através de `touch-action: pan-y; overscroll-behavior-x: none` aplicado diretamente nos containers que rolam e recebem o toque (`AlunoProgresso.module.css`, `AlunoPerfil.module.css` e no wrapper inline do Chat no `AlunoDashboard.tsx`).
- **Navegação entre Semanas (S1-S4) no Painel do Aluno:** Implementada a funcionalidade para o aluno navegar entre as semanas do ciclo. O hook `useWeeklyPlan` foi modificado para aceitar uma semana específica (`selectedWeekNumber`) calculando a data de início correta a partir do ciclo do grupo. Adicionado seletor de abas (`weekSelector`) no topo do dashboard do aluno e transformados os chips estáticos do `LockedScreen` em botões interativos vinculados ao estado de navegação. Semanas futuras não liberadas mostram a tela de bloqueio com feedback amigável ao usuário.
