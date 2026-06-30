# Arbo — Fase 3 (Parceria)

## Contexto
Parceria fechada com o professor. Maxwell cuida da tecnologia, professor cuida da
lógica de treinos (corrida, CrossFit, Hyrox, funcional).

## Roadmap de tarefas

### 1. Calculadora de Pace
Verificar se já existe no app. Se não, implementar (pace por km, ritmo alvo,
conversão min/km <-> km/h).

### 2. Biblioteca de treinos — ajustes finais
Já existe em /admin/treinos. Revisar e ajustar com base no feedback real de uso.

### 3. Botão "Testar como Aluno" (admin)
Admin consegue ver o app como um aluno veria, sem sair do contexto admin.
Abordagem: conta demo fixa no banco com dados de exemplo (treino, PR, vídeo).
Botão no menu admin: "Testar como Aluno" -> troca a visualização para o layout
do AlunoDashboard usando os dados dessa conta demo. Botão fixo "Voltar ao Admin"
sempre visível. Zero risco de acessar dado real de aluno.

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
Roadmap criado em 2026-06-30. Aguardando início pelo item 1.
