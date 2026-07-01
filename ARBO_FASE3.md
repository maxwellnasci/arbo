# Arbo — Fase 3 (Parceria)

## Contexto
Parceria fechada com o professor. Maxwell cuida da tecnologia, professor cuida da
lógica de treinos (corrida, CrossFit, Hyrox, funcional).

## Roadmap de tarefas

### 1. Calculadora de Pace — ✅ CONCLUÍDO (2026-06-30)
Implementado componente standalone (`PaceCalculator.tsx`) com cálculos de Pace, Tempo, Distância e tabelas de projeção de provas clássicas. Adicionado botão de acesso rápido tanto no painel do aluno (aba Progresso) quanto no do professor (aba Home).

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
