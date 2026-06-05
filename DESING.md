# Prompt para o Gemini — Redesign Premium Painel Admin Arbo

---

Leia os arquivos `CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md` e `ARBO_FASE2.md` na raiz do projeto para ter contexto completo antes de começar.

---

## MISSÃO

Implementar o redesign visual premium em **todo o painel admin** do Arbo. A referência de qualidade é a tela de login que você criou anteriormente (glassmorphism, logo árvore, tipografia ARBO espaçada, botão laranja) — o admin precisa chegar nesse mesmo nível ou superior.

**Regra de ouro: apenas visual muda. Zero alteração em lógica, hooks, queries Supabase ou fluxo de autenticação.**

---

## DESIGN SYSTEM OFICIAL

### Paleta de cores

```css
/* Fundos */
--bg-primary:        #0d0d0d;   /* fundo geral */
--bg-hero:           #0d2818;   /* hero section — verde escuro */
--bg-surface:        #131313;   /* cards e painéis */
--bg-surface-hover:  #181818;   /* hover dos cards */
--bg-input:          #0f0f0f;   /* inputs */

/* Bordas */
--border-default:    #1e1e1e;   /* borda padrão cards */
--border-subtle:     #1c1c1c;   /* divisores */
--border-orange:     rgba(232, 82, 26, 0.13);  /* card destaque laranja */
--border-green:      rgba(74, 222, 128, 0.13); /* card destaque verde */

/* Cores de marca */
--orange:            #E8521A;   /* cor primária */
--green-accent:      #4ade80;   /* cor de sucesso/alunos */

/* Texto */
--text-primary:      #ffffff;
--text-secondary:    #888888;
--text-tertiary:     #444444;
--text-disabled:     #2e2e2e;

/* Cards especiais */
--bg-card-orange:    #110a07;   /* fundo card PRs */
--bg-card-green:     #071108;   /* fundo card Alunos */
```

### Tipografia

Adicionar no `src/index.css` (antes de qualquer outro estilo):
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@300;400;500;600;700;800&display=swap');
```

Uso:
- **Títulos hero**: `font-family: 'Playfair Display', serif` — peso 700, em itálico para palavra de destaque
- **Todo o resto**: `font-family: 'Inter', sans-serif` — já instalada
- **Section labels**: Inter 10-11px, font-weight 700, letter-spacing 2px, uppercase, cor `#444`
- **Números de métrica**: Inter 28-32px, font-weight 800, letter-spacing -1px

### SVG do corredor (usar exatamente este nas hero sections)

```svg
<svg width="140" height="200" viewBox="0 0 140 200" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute; right:-10px; bottom:0; opacity:0.15;">
  <!-- cabeça -->
  <ellipse cx="95" cy="22" rx="14" ry="14" fill="#E8521A"/>
  <!-- torso -->
  <line x1="95" y1="36" x2="88" y2="85" stroke="#E8521A" stroke-width="8" stroke-linecap="round"/>
  <!-- braço esquerdo (para frente) -->
  <line x1="92" y1="55" x2="60" y2="72" stroke="#E8521A" stroke-width="6" stroke-linecap="round"/>
  <!-- braço direito (para trás) -->
  <line x1="92" y1="55" x2="115" y2="70" stroke="#E8521A" stroke-width="6" stroke-linecap="round"/>
  <!-- perna esquerda (para frente, estendida) -->
  <line x1="88" y1="85" x2="65" y2="130" stroke="#E8521A" stroke-width="7" stroke-linecap="round"/>
  <line x1="65" y1="130" x2="45" y2="165" stroke="#E8521A" stroke-width="6" stroke-linecap="round"/>
  <!-- perna direita (para trás) -->
  <line x1="88" y1="85" x2="108" y2="125" stroke="#E8521A" stroke-width="7" stroke-linecap="round"/>
  <line x1="108" y1="125" x2="120" y2="155" stroke="#E8521A" stroke-width="6" stroke-linecap="round"/>
</svg>
```

### Logo PNG da árvore (usar import de assets)

Não utilize SVG inline para a logo. Use o arquivo oficial PNG localizado em `src/assets/arbo-logo.png`.

Exemplo de uso:
```tsx
import arboLogo from '../../assets/arbo-logo.png'

<img src={arboLogo} alt="Arbo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
```

---

## ARQUIVOS A MODIFICAR

### Layout base
- `src/pages/admin/AdminLayout.tsx` — header global + estrutura mobile
- `src/pages/admin/AdminSidebar.tsx` — manter lógica, atualizar visual

### Páginas
- `src/pages/admin/AdminHome.tsx` — hero section + cards de métricas
- `src/pages/admin/AdminAlunos.tsx` — lista de alunos redesenhada
- `src/pages/admin/AdminTurmas.tsx` — lista de turmas redesenhada
- `src/pages/admin/AdminTurmaDetail.tsx` — header da turma + grid
- `src/pages/admin/AdminTreinos.tsx` — cards de treino redesenhados
- `src/pages/admin/AdminConvites.tsx` — formulário + tabela redesenhados
- `src/pages/admin/AdminFeedbacks.tsx` — cards de feedback redesenhados
- `src/pages/admin/AdminAlunoDetail.tsx` — perfil do aluno redesenhado

### CSS
- `src/index.css` — adicionar import das fontes Google

---

## IMPLEMENTAÇÃO DETALHADA POR COMPONENTE

### 1. AdminLayout — Header Global

Substituir o header atual por:

```
[Logo SVG árvore 32px] [ARBO — Inter 18px, weight 800, letter-spacing 5px]     [Avatar iniciais professor]
```

- Fundo: `#0d0d0d`
- Linha divisória embaixo: `0.5px solid #1c1c1c`
- Avatar: círculo 36px, fundo `#E8521A`, iniciais do nome (AuthContext), fonte 13px weight 700
- **Mobile**: substituir hamburger menu por **Bottom Navigation** (ver spec abaixo)

### 2. Bottom Navigation Mobile (novo componente: `AdminBottomNav.tsx`)

Criar componente de bottom nav para substituir o hamburger no mobile:

```
[Home] [Alunos] [Turmas] [Treinos] [Convites]
```

Comportamento:
- Visível apenas em mobile (`@media (max-width: 768px)`)
- Fundo: `#0d0d0d`, border-top: `0.5px solid #181818`
- Padding bottom: `env(safe-area-inset-bottom, 16px)` (safe area iOS)
- Ícone inativo: lucide outline, cor `#2e2e2e`, tamanho 22px
- Ícone ativo: cor `#E8521A` + ponto 4px fundo `#E8521A` centralizado embaixo
- Integrar com `useNavigate` do react-router para navegação
- Ícones a usar (lucide-react): `Home`, `Users`, `LayoutGrid`, `Dumbbell`, `Mail`

### 3. AdminHome — Hero Section + Métricas

**Hero section** (parte de cima, fundo verde):
```css
background: linear-gradient(160deg, #0d2818 0%, #0d0d0d 65%);
position: relative;
overflow: hidden;
padding: 20px 20px 28px;
```

Elementos internos:
- 2 orbs de glow laranja (position absolute, opacity 0.07, filter blur 40-50px)
- SVG do corredor (position absolute, right -10px, bottom 0, opacity 0.15)
- Overlay gradient na base: `linear-gradient(to bottom, transparent 50%, #0d0d0d 100%)`
- Eyebrow: `"PAINEL DO PROFESSOR"` — Inter 10px, weight 700, letter-spacing 2.5px, cor `#E8521A`, uppercase
- Título: Playfair Display 30px weight 700 — `"Sua turma,"` quebra linha `"em forma."` — a palavra `"em"` em itálico cor `#E8521A`
- Subtítulo: Inter 13px, cor `#888` — `"Boa noite, [nome] — [X] PRs essa semana 🔥"`
  - Nome vem de: `profile?.full_name` ou `user?.email` do AuthContext
  - X vem da query de PRs existente

**Grid de métricas** (2x2):

| Card | Ícone lucide | Destaque |
|------|-------------|---------|
| Alunos Ativos | `Users` | Verde — borda `#4ade8022`, bg `#071108`, número `#4ade80` |
| Turmas Ativas | `LayoutGrid` | Padrão — borda `#1e1e1e`, bg `#131313` |
| PRs Esta Semana | `Trophy` | Laranja — borda `#E8521A22`, bg `#110a07`, número `#E8521A` |
| Feedbacks | `MessageSquare` | Padrão |

Estrutura de cada card:
```
[ícone 16px cor #333 ou cor destaque]
[número 30px weight 800 letter-spacing -1px]
[label 10px uppercase letter-spacing 0.8px cor #444]
```

**Recordes Recentes**:
- Section label padrão
- Cada item: card `#131313`, border `#1e1e1e`, border-radius 16px
- Avatar iniciais laranja + nome (Inter 14px weight 600) + meta (PR de **5km** · **25:00** em laranja) + data direita

**Animações framer-motion** (apenas estas, sem exagero):
```tsx
// Entrada dos cards — fadeIn + slideUp suave
const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' }
  })
}
// Usar: <motion.div variants={cardVariants} custom={index} initial="hidden" animate="visible">
```

### 4. AdminAlunos — Lista

- Fundo geral: `#0d0d0d`
- Header: título "Alunos" Inter 22px weight 700 + botão "+ Convidar" fundo `#E8521A`, border-radius 12px
- Input de busca: fundo `#131313`, border `#1e1e1e`, border-radius 12px, ícone `Search` cor `#444`
- Select de filtro: mesmo estilo do input
- Card de aluno:
  - Fundo `#131313`, border `0.5px solid #1e1e1e`, border-radius 16px, padding 14px 16px
  - Avatar: círculo 42px, fundo `#E8521A`, iniciais brancas
  - Nome: Inter 14px weight 600 cor `#fff`
  - Subtítulo (nível · turma): Inter 12px cor `#555`
  - Seta direita: ícone `ChevronRight` cor `#2e2e2e`

### 5. AdminTurmas — Lista

- Mesmo padrão de header e cards
- Card de turma:
  - Nome: Inter 15px weight 600
  - Pills de meta (objetivo, frequência, tipo): fundo `#1e1e1e`, cor `#666`, border-radius 20px, padding 3px 10px, font-size 11px
  - Badge "Ativa": fundo `rgba(74,222,128,0.1)`, cor `#4ade80`, border-radius 20px
  - Badge "Inativa": fundo `#1e1e1e`, cor `#555`
  - Contagem de alunos: cor `#888`
  - Seta: `ChevronRight` cor `#2e2e2e`

### 6. AdminTurmaDetail — Header

- Breadcrumb "← Turmas": Inter 13px, cor `#E8521A`, ícone `ArrowLeft`
- Toggle Mês/Semana: fundo `#1e1e1e`, ativo fundo `#E8521A` border-radius 10px
- Nome da turma: Inter 20px weight 700 (ou clamp responsivo)
- Pills de meta: mesmo padrão das turmas
- Botão "Editar": pill com ícone `Pencil`, fundo `#1e1e1e`, cor `#888`
- Grid de semana: manter lógica atual, atualizar apenas cores para o novo sistema

### 7. AdminTreinos — Cards

- Header: título + botão "+ Novo Treino" padrão
- Input de busca: padrão
- Card de treino:
  - Fundo `#131313`, border `#1e1e1e`, border-radius 16px
  - Badge tipo (CORRIDA etc): manter cores atuais, border-radius 8px, font-size 10px weight 700
  - Badge etiqueta: border-radius 20px, cores existentes
  - Título: Inter 16px weight 600
  - Sub-cards de métricas (Distância, Duração, Pace, Séries):
    - Fundo `#0d0d0d`, border `#1e1e1e`, border-radius 12px
    - Label: Inter 9px uppercase letter-spacing 1px cor `#444`
    - Valor: Inter 14px weight 600 cor `#fff`
  - Botões Editar/Excluir: Inter 12px, Editar cor `#888`, Excluir cor `#E8521A`

### 8. AdminConvites

- Toggle Aluno/Professor:
  - Container: fundo `#131313`, border `#1e1e1e`, border-radius 12px, padding 4px
  - Ativo: fundo `#E8521A`, border-radius 10px, texto branco
  - Inativo: fundo transparente, texto `#888`
- Input de email: padrão
- Botão "Convidar": fundo `#E8521A`, border-radius 12px
- Convites enviados: substituir tabela por cards
  - Card: fundo `#131313`, border `#1e1e1e`, border-radius 12px
  - Email: Inter 13px weight 500
  - Role + Status: pills padrão
  - Data: cor `#555`

### 9. AdminFeedbacks

- Card com PR: borda esquerda `3px solid #E8521A`, badge "PR" fundo `#E8521A` cor branca
- Card sem PR: borda esquerda `3px solid #1e1e1e`
- Nome do aluno: Inter 14px weight 600
- Texto do feedback: Inter 13px cor `#888`, aspas visíveis
- Meta (data · km · pace · nota): Inter 11px cor `#555`, emojis mantidos

### 10. AdminAlunoDetail — Perfil

- Header com nome do aluno: Playfair Display 24px weight 700
- Avatar grande: círculo 64px fundo `#E8521A`
- Tabs (Check-ins, Recordes, Anamnese): estilo pill, ativo fundo `#E8521A`, inativo fundo `#1e1e1e`
- Cards de métricas: padrão do sistema
- Selector de turma: padrão input

---

## ANIMAÇÕES PERMITIDAS (framer-motion)

Usar apenas estas — sem animações em loops ou excessivas:

```tsx
// 1. Entrada de listas (cards de alunos, treinos, feedbacks)
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3, ease: 'easeOut' }}

// 2. Entrada staggered para grids (métricas)
// custom={index} + delay: i * 0.08

// 3. Hover em cards clicáveis
whileHover={{ scale: 1.01 }}
transition={{ duration: 0.15 }}

// 4. Tap feedback em botões
whileTap={{ scale: 0.97 }}
```

**NÃO usar**: animações de rotação, pulse contínuo, parallax, ou qualquer efeito que rode em loop.

---

## REGRAS OBRIGATÓRIAS

1. **Zero alteração em lógica** — hooks, queries, autenticação, RLS, navegação intactos
2. **Padrões do CLAUDE.md** — inline styles dark ou CSS Modules, sem Tailwind
3. **Ícones**: lucide-react já instalado — usar apenas ícones outline
4. **Sem import React desnecessário** — projeto usa JSX runtime automático
5. **Tipagem TypeScript** — nenhum `as any`, usar `as unknown as Tipo` quando necessário
6. **CSS Modules** para novos componentes (ex: `AdminBottomNav.module.css`)

## VALIDAÇÃO OBRIGATÓRIA AO FINAL

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Resultado esperado: **0 erros, 0 warnings** nos três comandos.

## COMMIT

```
git add .
git commit -m "feat: redesign premium painel admin — design system Arbo v2 (hero verde, tipografia Playfair, bottom nav Strava)"
git push origin master
```

## ENTREGA ESPERADA

Relatório arquivo por arquivo com o que foi alterado + output dos 3 comandos de validação.

---

*Prompt gerado pelo Claude.ai — sessão de redesign Arbo 2026-06-04*
