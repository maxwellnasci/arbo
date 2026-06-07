# 🌳 PLAYBOOK — Desenvolvimento de Apps com Time de IA

> Criado por Maxwell + Claude.ai | Baseado no projeto Arbo (2026)
> Use este documento para replicar o processo em qualquer projeto novo.
> Meta: chegar em 8.0 no primeiro dia e 8.5+ antes da entrega.

---

## 1. O Time de IA

### Papel de cada agente

| Agente | Papel | Quando usar |
|---|---|---|
| **Claude.ai** | Estratégia, mockups, prompts, revisão de relatórios | Sempre — é o cérebro do time |
| **Gemini (Antigravity)** | Implementação principal, design, código, commits | Para toda feature nova |
| **DeepSeek V4 Pro** | Análise ampla pós-implementação | Após cada rodada de features |
| **Claude Code** | Correções cirúrgicas, TypeScript, validação | Só para bugs específicos |

### Regra de ouro do contexto

```
DeepSeek → análise ampla (~$0.10 por sessão)
Gemini → implementa (contexto de 5h)
Claude Code → correções cirúrgicas (contexto de 5h — PRESERVAR)
Claude.ai → estratégia e prompts (sem limite)
```

### Como economizar contexto

- **Nunca** usar Claude Code para análise geral — gasta muito contexto
- **Sempre** usar DeepSeek para varreduras amplas
- **Claude Code** só para correções de 5-10 arquivos específicos
- Quando Gemini repetir trabalho já feito → mandar ler o `CLAUDE_HISTORICO.md`
- Dividir `CLAUDE.md` quando ultrapassar 40k caracteres → criar `CLAUDE_HISTORICO.md`

### Limites práticos

| Agente | Contexto | Renovação | Custo |
|---|---|---|---|
| Claude Code | ~5h de uso | Automático diário | Plano fixo |
| Gemini | ~5h de uso | Automático | Plano fixo |
| DeepSeek | Ilimitado | — | ~$0.10/análise |
| Claude.ai | Por conversa | Nova conversa | Plano fixo |

---

## 2. Como Iniciar um Projeto do Zero

### Stack padrão recomendada

```
Frontend: React 19 + TypeScript + Vite
Backend: Supabase (banco, auth, RLS, Edge Functions)
Deploy: Vercel (deploy automático via GitHub)
Email: Resend (SMTP externo)
Animações: framer-motion
Ícones: lucide-react
Toasts: sonner
Datas: date-fns
PWA: vite-plugin-pwa + Workbox
```

### Arquivos .md a criar no início do projeto

```
CLAUDE.md          → padrões técnicos, estado atual, roadmap
GEMINI.md          → mesmo conteúdo adaptado para o Gemini
ANTIGRAVITY.md     → fluxo do time, preferências, setup
DESIGN.md          → design system completo (cores, tipografia, componentes)
ARBO_FASE2.md      → documentação de produto (adaptar nome)
```

### Estrutura de pastas padrão

```
src/
  components/
    admin/          → componentes do painel admin
    aluno/          → componentes do app do aluno
    ui/             → componentes reutilizáveis (ConfirmModal, etc)
  contexts/         → AuthContext, etc
  hooks/            → todos os hooks de dados
  lib/
    database.types.ts  → tipos gerados pelo Supabase
    types.ts           → tipos customizados do projeto
    supabase.ts        → cliente Supabase
    trainingUtils.ts   → utilitários (adaptar nome)
  pages/
    admin/          → páginas do admin
    aluno/          → páginas do aluno
  index.css         → design system (CSS vars)
supabase/
  functions/        → Edge Functions
  migrations/       → migrations SQL
public/
  icons/            → ícones PWA
  offline.html      → página offline
```

### Configurações obrigatórias no início

**vercel.json** (SPA routing + security headers):
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';"
        },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

**index.html** (lang + preconnect + preload):
```html
<html lang="pt-BR">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
```

---

## 3. Fluxo de uma Sessão

### Como começar

Todo agente deve começar lendo os arquivos de contexto:

```
Leia CLAUDE.md, CLAUDE_HISTORICO.md, GEMINI.md, ANTIGRAVITY.md, 
ARBO_FASE2.md e DESIGN.md para contexto completo antes de começar.
```

### Como executar

```
1. Claude.ai → define o que fazer, monta o prompt
2. Gemini → apresenta plano antes de implementar (aguardar aprovação)
3. Gemini → implementa após aprovação
4. Gemini → roda: npx tsc --noEmit && npm run lint && npm run build
5. Gemini → NÃO faz commit ainda (aguardar revisão)
6. Claude.ai → revisa o relatório
7. DeepSeek → análise ampla se necessário
8. Claude Code → correções cirúrgicas se necessário
9. Gemini → commit + push + atualiza .md
```

### Como fechar uma sessão

```
Gemini atualiza: CLAUDE.md, CLAUDE_HISTORICO.md, GEMINI.md, 
ANTIGRAVITY.md e ARBO_FASE2.md com tudo que foi feito.

git add .
git commit -m "docs: atualizar .md com sessão [DATA]"
git push origin master
```

### Como retomar sessão interrompida

```
"Leia CLAUDE.md, CLAUDE_HISTORICO.md, GEMINI.md, ANTIGRAVITY.md, 
ARBO_FASE2.md e DESIGN.md. Me atualize do estado atual do projeto 
e continuamos de onde paramos."
```

### Quando o Gemini repetir trabalho já feito

```
"Esse trabalho já foi feito. Leia o CLAUDE_HISTORICO.md com atenção
e me diga o que realmente está pendente antes de implementar qualquer coisa."
```

---

## 4. Padrões de Qualidade Obrigatórios

### TypeScript

```typescript
// ✅ CORRETO — catch tipado
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : 'Erro desconhecido'
}

// ❌ ERRADO
} catch (e: any) { }
} catch (e) { }  // implícito any

// ✅ CORRETO — type assertion segura
const data = result as unknown as MinhaInterface

// ❌ ERRADO
const data = result as any
```

### Hooks de dados — padrão obrigatório

```typescript
// ✅ CORRETO — padrão cancelled flag
useEffect(() => {
  let cancelled = false
  async function load() {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.from('tabela').select('...')
      if (cancelled) return
      if (error) { setError(error.message); return }
      setData(data ?? [])
    } catch (e: unknown) {
      if (cancelled) return
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      if (!cancelled) setIsLoading(false)
    }
  }
  load()
  return () => { cancelled = true }
}, [dependencia])

// ❌ ERRADO — sem cancelled flag
useEffect(() => {
  fetchData()  // sem guard de unmount
}, [])
```

### Queries Supabase — padrões obrigatórios

```typescript
// ✅ CORRETO — colunas explícitas
supabase.from('profiles').select('id, full_name, avatar_url, level, role')

// ❌ ERRADO — wildcard
supabase.from('profiles').select('*')

// ✅ CORRETO — com limit()
supabase.from('checkins').select('...').limit(100)

// ❌ ERRADO — sem limit() em listas
supabase.from('checkins').select('...')

// ✅ CORRETO — FK ambígua nomeada
supabase.from('checkins').select('*, profiles!checkins_student_id_fkey(*)')

// ✅ CORRETO — join N→1 como objeto
const treino = wpt.trainings  // objeto
// ❌ ERRADO
const treino = wpt.trainings[0]  // array

// ✅ CORRETO — verificar error do Supabase
const { data, error } = await supabase.from('tags').delete().eq('id', id)
if (error) { toast.error(error.message); return }

// ❌ ERRADO — Supabase não lança exceção
try {
  await supabase.from('tags').delete().eq('id', id)
} catch (e) { }  // nunca vai cair aqui
```

### Auth — padrões obrigatórios

```typescript
// ✅ CORRETO — role em app_metadata
const role = user?.app_metadata?.role

// ❌ ERRADO — nunca user_metadata
const role = user?.user_metadata?.role

// ✅ CORRETO — guard de sessão
if (!user) { toast.error('Sessão expirada. Recarregue a página.'); return }
```

---

## 5. Design System Padrão

### Paleta de cores (CSS vars obrigatórias)

```css
:root {
  /* Fundos */
  --bg-primary: #0d0d0d;
  --bg-hero: #0d2818;
  --bg-surface: #131313;
  --bg-surface-hover: #181818;
  --bg-input: #0f0f0f;
  --bg-card-orange: #110a07;
  --bg-card-green: #071108;

  /* Bordas */
  --border-default: #1e1e1e;
  --border-subtle: #1c1c1c;
  --border-orange: rgba(232, 82, 26, 0.20);
  --border-green: rgba(74, 222, 128, 0.13);

  /* Cores de marca */
  --orange: #E8521A;
  --green-accent: #4ade80;
  --red-accent: #ef4444;
  --blue-accent: #3b82f6;
  --purple-accent: #a855f7;
  --yellow-accent: #eab308;

  /* Texto */
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --text-tertiary: #444444;
  --text-disabled: #2e2e2e;
  --text-h: #ffffff;

  /* Sutis */
  --orange-subtle: rgba(232, 82, 26, 0.06);
  --orange-border: rgba(232, 82, 26, 0.20);
  --red-subtle: rgba(239, 68, 68, 0.08);
  --red-border: rgba(239, 68, 68, 0.25);
  --blue-subtle: rgba(59, 130, 246, 0.08);
  --purple-subtle: rgba(168, 85, 247, 0.08);
  --yellow-subtle: rgba(234, 179, 8, 0.08);
  --green-subtle: rgba(74, 222, 128, 0.08);

  /* Sombras */
  --shadow-modal: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  --shadow-card: 0 8px 32px rgba(0, 0, 0, 0.4);

  /* Backdrop */
  --backdrop-bg: rgba(0, 0, 0, 0.7);

  /* Code */
  --code-bg: rgba(255, 255, 255, 0.06);
}

[data-theme="light"] {
  --bg-primary: #f5f5f5;
  --bg-surface: #ffffff;
  --bg-surface-hover: #f0f0f0;
  --bg-input: #fafafa;
  --text-primary: #18181b;
  --text-secondary: #52525b;
  --text-tertiary: #a1a1aa;
  --text-h: #18181b;
  --border-default: #e4e4e7;
  --border-subtle: #d4d4d8;
  --red-accent: #dc2626;
  --blue-accent: #2563eb;
  --purple-accent: #7c3aed;
  --yellow-accent: #ca8a04;
  --shadow-modal: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  --shadow-card: 0 8px 32px rgba(0, 0, 0, 0.1);
  --backdrop-bg: rgba(0, 0, 0, 0.45);
  --code-bg: rgba(0, 0, 0, 0.06);
}
```

### Tipografia

```css
/* Importar no index.css */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@300;400;500;600;700;800&display=swap');

/* Uso */
/* Títulos hero: Playfair Display 700 + itálico para destaque */
/* Todo o resto: Inter */
/* Section labels: Inter 10-11px, weight 700, letter-spacing 2px, uppercase, cor var(--text-tertiary) */
/* Números de métrica: Inter 28-32px, weight 800, letter-spacing -1px */
```

### Animações permitidas (framer-motion)

```typescript
// ✅ Entrada de cards
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3, ease: 'easeOut' }}

// ✅ Stagger em listas
custom={index}
transition={{ delay: index * 0.08, duration: 0.35 }}

// ✅ Hover em cards clicáveis
whileHover={{ scale: 1.01 }}
transition={{ duration: 0.15 }}

// ✅ Tap em botões
whileTap={{ scale: 0.97 }}

// ❌ NUNCA usar
// - Rotação
// - Pulse contínuo
// - Parallax
// - Loops infinitos
```

### Regra absoluta de CSS

```
NUNCA usar hex hardcoded em código novo.
SEMPRE usar CSS vars semânticas.
EXCEÇÃO: #fff em texto sobre fundo var(--orange) — intencionalmente branco.
EXCEÇÃO: hex literals em color pickers (estados de cor dinâmicos do banco).
```

---

## 6. Segurança Obrigatória

### RLS — toda tabela nova

```sql
-- Habilitar RLS
ALTER TABLE public.nova_tabela ENABLE ROW LEVEL SECURITY;

-- Policy básica para admin
CREATE POLICY "Admins têm acesso total" ON public.nova_tabela
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy básica para usuário ver só os próprios dados
CREATE POLICY "Usuários veem próprios dados" ON public.nova_tabela
FOR SELECT
USING (auth.uid() = user_id);
```

### Edge Functions — padrão de segurança

```typescript
// ✅ Validar JWT e role
const authHeader = req.headers.get('Authorization')
if (!authHeader) return new Response('Unauthorized', { status: 401 })

const { data: { user } } = await supabase.auth.getUser(token)
if (!user || user.app_metadata?.role !== 'admin') {
  return new Response('Forbidden', { status: 403 })
}

// ✅ Validar UUID antes de usar
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
  return new Response('userId inválido', { status: 400 })
}

// ✅ CORS com allowlist
const ALLOWED_ORIGINS = ['https://seuapp.com.br', 'https://seuapp.vercel.app']
const origin = req.headers.get('Origin') ?? ''
const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

// ✅ Validar redirectTo com new URL()
try {
  const u = new URL(body.redirectTo)
  const allowedHosts = new Set(['seuapp.com.br'])
  if (!allowedHosts.has(u.hostname) || u.protocol !== 'https:') {
    redirectTo = `${siteUrl}/set-password`
  }
} catch {
  redirectTo = `${siteUrl}/set-password`
}
```

### Checklist de segurança

- [ ] RLS habilitado em todas as tabelas
- [ ] service_role NUNCA no frontend
- [ ] Edge Functions com JWT validation
- [ ] CORS com allowlist explícita
- [ ] redirectTo validado com new URL()
- [ ] CSP headers no vercel.json
- [ ] X-Frame-Options: DENY
- [ ] Inputs sanitizados antes de inserir no banco

---

## 7. Performance Obrigatória

### Índices SQL essenciais (rodar no Supabase SQL Editor)

```sql
-- Adaptar para as tabelas do projeto
CREATE INDEX IF NOT EXISTS idx_checkins_student_id ON checkins(student_id);
CREATE INDEX IF NOT EXISTS idx_records_student_id ON records(student_id);
CREATE INDEX IF NOT EXISTS idx_records_achieved_at ON records(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_student_id ON messages(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
-- Adicionar índices para as FKs mais usadas em WHERE e ORDER BY
```

### PWA obrigatório (vite.config.ts)

```typescript
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['offline.html', 'icons/*.png'],
  manifest: {
    name: 'Nome do App',
    short_name: 'App',
    theme_color: '#0d0d0d',
    background_color: '#0d0d0d',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', purpose: 'maskable' }
    ]
  },
  workbox: {
    navigateFallback: '/offline.html',  // ← CRÍTICO
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: { networkTimeoutSeconds: 10 }
      },
      {
        urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
        handler: 'CacheFirst',
        options: { expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 } }
      }
    ]
  }
})
```

### Mobile obrigatório

```css
/* Inputs — evitar zoom iOS */
input, select, textarea { font-size: 16px; }  /* nunca menos que 16px */

/* Safe area — telas com notch */
padding-bottom: calc(80px + env(safe-area-inset-bottom, 16px));

/* Evitar bounce iOS */
html, body { overscroll-behavior: none; overflow: hidden; }
#root { height: 100dvh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
```

```html
<!-- viewport obrigatório -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, 
      maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

---

## 8. Como Medir Qualidade

### Categorias e o que cada uma avalia

| Categoria | O que avalia |
|---|---|
| Segurança | RLS, Edge Functions, CORS, auth |
| Performance | Queries, índices, bundle, PWA |
| Qualidade de código | TypeScript, padrões, CSS vars, dead code |
| UX / Bugs | Estados de loading/erro, feedback, mobile |
| Arquitetura | Separação de concerns, testes, CI/CD |
| PWA / Mobile | Service worker, safe area, offline, instalação |

### Fluxo de análise

```
1. DeepSeek → análise ampla completa
2. Claude Code → análise técnica cirúrgica
3. Claude.ai → une os findings, prioriza
4. Gemini → implementa as correções
5. DeepSeek → novas notas
```

### Metas por fase

| Fase | Meta | O que fazer |
|---|---|---|
| MVP (início) | 7.0+ | Stack configurada, RLS, padrões básicos |
| Beta | 8.0+ | Performance, CSS vars, PWA |
| Entrega | 8.5+ | Testes, CI/CD, Lighthouse |

---

## 9. Templates de Prompts

### Prompt de início de sessão

```
Leia CLAUDE.md, CLAUDE_HISTORICO.md, GEMINI.md, ANTIGRAVITY.md, 
[PROJETO]_FASE2.md e DESIGN.md para contexto completo.
Me atualize do estado atual do projeto e continuamos de onde paramos.
```

### Prompt de análise DeepSeek

```
Leia CLAUDE.md, CLAUDE_HISTORICO.md, GEMINI.md, ANTIGRAVITY.md, 
[PROJETO]_FASE2.md e DESIGN.md para contexto completo.

Faça uma análise COMPLETA e PROFUNDA cobrindo:
1. SEGURANÇA — RLS, Edge Functions, CORS, auth
2. PERFORMANCE — queries N+1, select(*), sem limit(), bundle
3. QUALIDADE — padrões violados, TypeScript, CSS hardcoded
4. UX / BUGS — estados faltando, feedback, edge cases
5. ARQUITETURA — separação de concerns, padrões inconsistentes
6. PWA / MOBILE — safe area, offline, inputs 16px

Para cada problema: arquivo + linha + descrição + impacto + correção.
Ordene por severidade. Dê nota 0-10 por categoria ao final.
```

### Prompt de implementação Gemini

```
Leia CLAUDE.md, CLAUDE_HISTORICO.md, GEMINI.md, ANTIGRAVITY.md, 
[PROJETO]_FASE2.md e DESIGN.md para contexto completo.

## MISSÃO: [Nome da Task]

[Descrição detalhada do que implementar]

## REGRAS OBRIGATÓRIAS
- Padrões do CLAUDE.md e DESIGN.md
- CSS vars semânticas — nunca hex hardcoded
- TypeScript correto — nenhum as any
- Cancelled flag nos novos useEffects
- Não fazer commit ainda — preciso revisar antes

## VALIDAÇÃO
npx tsc --noEmit && npm run lint && npm run build
Resultado esperado: 0 erros, 0 warnings.

## ENTREGA
- Apresente o plano antes de implementar
- Relatório arquivo por arquivo
- Output dos 3 comandos de validação
```

### Prompt de correção Claude Code

```
Leia CLAUDE.md, CLAUDE_HISTORICO.md para contexto.

Corrija os seguintes problemas encontrados na análise:

[Lista de findings com arquivo, linha e correção]

Após corrigir:
npx tsc --noEmit && npm run lint && npm run build

git add .
git commit -m "fix: [descrição]"
git push origin master
```

### Prompt de atualização .md

```
Atualize CLAUDE.md, CLAUDE_HISTORICO.md, GEMINI.md, ANTIGRAVITY.md 
e [PROJETO]_FASE2.md com tudo que foi feito nessa sessão:

[Lista do que foi feito]

git add .
git commit -m "docs: atualizar .md com sessão [DATA]"
git push origin master
```

### Prompt de análise pós-implementação DeepSeek

```
Na última análise você deu as seguintes notas:
[notas anteriores]

Desde essa análise foram implementadas:
[lista do que foi feito]

Faça análise focada nessas melhorias:
- As implementações estão corretas?
- Algum novo problema foi introduzido?
- As notas melhoraram?
- O que ainda falta para chegar em 8.5+?

Dê as notas atualizadas e top 3 próximas ações.
```

---

## 10. Arquivos de Contexto

### CLAUDE.md — o que deve ter

```markdown
# [Projeto] — Contexto para Claude Code

## Stack
## Ambiente
## Padrões técnicos obrigatórios
## Estado atual (data + o que está feito)
## Próximos passos
## Tabelas do banco
## Tipos importantes
## Decisões técnicas documentadas
```

### GEMINI.md — o que deve ter

Mesmo conteúdo do CLAUDE.md adaptado para o Gemini. Incluir referência ao DESIGN.md.

### ANTIGRAVITY.md — o que deve ter

```markdown
# Briefing do Time de IA
## Quem somos (Maxwell + agentes)
## Modelo de trabalho (tabela de etapas)
## O Projeto (descrição, stack, repo, estado atual)
## O que foi feito por sessão
## Próximo passo
## Arquivos de contexto do time
## Preferências do Maxwell
## Padrões técnicos (resumo)
```

### DESIGN.md — o que deve ter

```markdown
# Design System
## Paleta de cores (CSS vars completas dark + light)
## Tipografia
## Componentes base (SVGs, layouts)
## Animações permitidas
## Regras de CSS
## Referências visuais
```

### CLAUDE_HISTORICO.md — quando criar

Criar quando o `CLAUDE.md` ultrapassar **40k caracteres**. Mover todo o histórico de sessões para ele, mantendo o CLAUDE.md apenas com o estado atual.

---

## 11. Checklist de Entrega

### Antes de cada commit

- [ ] `npx tsc --noEmit` — 0 erros
- [ ] `npm run lint` — 0 warnings
- [ ] `npm run build` — build completo sem erro

### Antes de entregar ao cliente

- [ ] Análise DeepSeek: 8.0+ em todas as categorias
- [ ] RLS auditado em todas as tabelas
- [ ] Nenhum `select('*')` no código
- [ ] Nenhum `as any` no TypeScript
- [ ] CSS vars em todos os componentes
- [ ] PWA instalável e offline funcional
- [ ] Inputs com mínimo 16px (iOS)
- [ ] Safe area em todos os componentes mobile
- [ ] vercel.json com security headers
- [ ] `.md` atualizados e sincronizados
- [ ] Git push no master

### Lighthouse — metas

| Categoria | Meta |
|---|---|
| Performance | 80+ |
| Acessibilidade | 90+ |
| Boas práticas | 90+ |
| SEO | 90+ |
| PWA | 100 |

---

## 12. Lições Aprendidas no Arbo

### O que funcionou muito bem

- **Análise dupla DeepSeek + Claude Code** — cobertura máxima por menos de R$1,00
- **Gemini 3.5 Flash Thinking** com subagentes — mais rápido que 3.1 Pro, divide trabalho automaticamente
- **Manter .md atualizados** — nunca perdemos contexto mesmo trocando de sessão
- **Dividir CLAUDE.md** quando ficou grande — evita perda de contexto no Claude Code
- **Plano antes de implementar** — Gemini apresenta o plano, Maxwell aprova, depois implementa
- **CSS vars semânticas** desde o início — dark/light mode funcionou sem retrabalho
- **Design system no DESIGN.md** — Gemini teve referência clara, entregou premium

### O que evitar

- ❌ Usar Claude Code para análise ampla — gasta contexto que vale ouro
- ❌ Deixar Gemini fazer commit sem revisar — sempre pedir "não faça commit ainda"
- ❌ Implementar sem apresentar plano — Gemini pode repetir trabalho já feito
- ❌ Acumular hex hardcoded — corrigir durante o desenvolvimento, não depois
- ❌ Esquecer de atualizar os .md — contexto perdido entre sessões
- ❌ select('*') nas queries — sempre colunas explícitas desde o início
- ❌ Usar Supabase free tier para SMTP em produção — configurar Resend antes de lançar

### Decisões técnicas importantes

| Decisão | Motivo |
|---|---|
| recharts 2.x em vez de 3.x | 3.x usa CJS que quebra com Vite |
| cancelled flag em todos os hooks | Evita setState em componente desmontado |
| app_metadata.role (nunca user_metadata) | user_metadata é editável pelo usuário |
| as unknown as Interface (nunca as any) | Mantém type safety sem quebrar |
| limit(100-200) em todas as queries de lista | Performance e proteção contra crescimento |
| navigateFallback no Workbox | Sem isso offline.html nunca aparece |
| inputs mínimo 16px | iOS Safari dá zoom em menos de 16px |
| icon-512-maskable.png separado | Android distorce ícone sem safe zone |

---

*Documento criado com base no projeto Arbo (2026)*
*Mantenha atualizado a cada projeto concluído*
