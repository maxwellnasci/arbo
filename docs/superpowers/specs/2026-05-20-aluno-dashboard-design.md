# Design: AlunoDashboard com Dados Reais

**Data:** 2026-05-20  
**Status:** Aprovado  

---

## Contexto

O `AlunoDashboard` atual é um placeholder com estilos inline e sem dados reais. Este spec descreve a substituição completa por um dashboard funcional que consome o Supabase diretamente.

---

## Arquitetura

### Hook: `src/hooks/useWeeklyPlan.ts`

Busca todos os dados necessários em paralelo via `Promise.all`:

1. **`profiles`** — `full_name`, `level` do usuário logado (`student_id = user.id`)
2. **`weekly_plans`** — plano da semana atual (`week_start` = segunda-feira da semana corrente, `student_id` = usuário logado)
3. **`weekly_plan_trainings` + `trainings`** — join para obter detalhes de cada treino do plano
4. **`checkins`** — todos da semana, filtrados por `student_id` e `plan_id`

**Interface retornada:**

```ts
type DayTraining = {
  weeklyPlanTrainingId: string
  dayOfWeek: number        // 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sáb, 0=dom
  training: Training
  checkin: Checkin | null  // null = não concluído ainda
}

type UseWeeklyPlanResult = {
  profile: Profile | null
  plan: WeeklyPlan | null
  trainings: DayTraining[]
  checkins: Checkin[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}
```

**Retry automático:** 3 tentativas com backoff exponencial (1s, 2s, 4s) em caso de erro de rede. Erro persiste após esgotadas as tentativas.

**`week_start` calculation:** Cálculo manual sem dependência extra. Pega `new Date()`, ajusta para segunda-feira da semana corrente via `getDay()`, formata como `YYYY-MM-DD` no fuso local do browser.

---

### Componente principal: `src/pages/aluno/AlunoDashboard.tsx`

Consome `useWeeklyPlan` e renderiza conforme estado:

| Estado | Renderização |
|---|---|
| `isLoading = true` | Spinner laranja centralizado, texto "Carregando..." |
| `error != null` | Card vermelho, mensagem do erro, botão "Tentar novamente" |
| `plan = null` | Card neutro: "Nenhum treino programado para esta semana." |
| Dados presentes | Dashboard completo (ver seções abaixo) |

---

### Estilo: `src/pages/aluno/AlunoDashboard.module.css`

Zero inline styles. CSS Modules com variáveis do projeto:
- Fundo: `#111111`
- Cards: `#1a1a1a`
- Destaque/laranja: `#E8521A`
- Texto secundário: `#888`
- Border muted: `#2a2a2a`

Mobile-first. Breakpoint único: `min-width: 640px` para ajustes de espaçamento.

---

## Seções do Dashboard

### 1. Header

- **Saudação dinâmica** baseada na hora local:
  - 05:00–11:59 → "Bom dia"
  - 12:00–17:59 → "Boa tarde"
  - 18:00–04:59 → "Boa noite"
  - Nome: `profile.full_name` se disponível, senão `user.email`
- **Badge de nível** mapeado de `profile.level`:
  - `iniciante` → "Iniciante" (cinza)
  - `intermediario` → "Intermediário" (azul)
  - `avancado` → "Avançado" (laranja)
- **Botão "Sair"** — chama `useLogout()`

### 2. Progresso da Semana

- Texto: `"X de Y treinos realizados"`
  - X = treinos com checkin na semana
  - Y = total de treinos no plano
- Barra de progresso: largura `(X/Y * 100)%`, cor `#E8521A`, fundo `#2a2a2a`, `border-radius: 4px`

### 3. Cards de Treino

Um card por entrada em `DayTraining`, ordenados por `dayOfWeek`.

Cada card exibe:
- **Dia da semana** em português (ex: "Segunda-feira")
- **Badge de tipo** com cor:
  - `corrida` → laranja `#E8521A`
  - `hiit` → vermelho `#E84545`
  - `recovery` → verde `#22C55E`
  - `forca` → roxo `#A855F7`
  - `mobilidade` → azul `#3B82F6`
- **Nome do treino** (título em destaque)
- **Distância** formatada: `5000m` → "5,0 km"; `null` → não exibe
- **Pace alvo** formatado: `360s/km` → "6:00 /km"; `null` → não exibe
- **Duração** se disponível: "20 min"
- **Destaque do dia atual:** borda esquerda laranja `3px solid #E8521A` se `dayOfWeek` = dia atual da semana
- **Estado de conclusão:**
  - Não concluído: botão "Fazer check-in" (laranja)
  - Concluído: badge verde "Concluído ✓"

### 4. Modal de Check-in

Abre ao clicar em "Fazer check-in". Overlay escuro `rgba(0,0,0,0.7)`.

**Campos (todos opcionais):**
- Distância percorrida (m) — `number input`
- Tempo total (minutos) — `number input`
- Observações — `textarea`

**Submit:**
1. Calcula `actual_pace_seconds_per_km` se ambos distância e tempo fornecidos: `(minutos * 60) / (distância / 1000)`
2. Converte minutos → segundos para `actual_duration_seconds`
3. Insere em `checkins`: `{ student_id, training_id, plan_id, actual_distance_m, actual_duration_seconds, actual_pace_seconds_per_km, notes }`
4. Em caso de sucesso: chama `refresh()`, fecha modal
5. Em caso de erro: exibe mensagem inline no modal, não fecha

**Fechar:** botão "×" no canto superior direito, ou clique no overlay.

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---|---|
| `src/hooks/useWeeklyPlan.ts` | Criar |
| `src/pages/aluno/AlunoDashboard.tsx` | Substituir completamente |
| `src/pages/aluno/AlunoDashboard.module.css` | Criar |
| `CLAUDE.md` | Atualizar seção "Próximo passo" |
| `GEMINI.md` | Atualizar seção "Próximo Passo" |

---

## Sequência de Validação

1. `npx tsc --noEmit` → 0 erros
2. `npm run lint` → 0 erros
3. `npm run dev` → verificar no browser:
   - 3 treinos de teste aparecem
   - Treino do dia atual destacado com borda laranja
   - Barra de progresso mostra 0/3
   - Modal de check-in abre e salva no banco
   - Card atualiza para "Concluído ✓" após check-in
   - Responsivo em mobile (375px)
