// Recuperação de erro de chunk (código antigo pedindo arquivo de um deploy que
// não existe mais).
//
// Cenário real (2026-10-08): depois de vários deploys seguidos, o celular abriu
// o app com o HTML antigo vindo do cache do service worker (navegação
// NetworkFirst com timeout de 5 s em rede móvel lenta). Esse HTML aponta para
// chunks com hash antigo, que a Vercel já não serve (404) →
// "TypeError: Failed to fetch dynamically imported module".
//
// Só recarregar não resolve: o reload pode pegar o mesmo HTML velho do cache.
// Por isso a recuperação remove os service workers e TODOS os caches antes de
// recarregar, e usa uma trava com prazo (não para sempre) para não entrar em
// loop de reload nem ficar preso num spinner.

const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module', // Chrome/Edge
  'Importing a module script failed', // Safari / iOS
  'error loading dynamically imported module', // Firefox
  'Failed to load module script', // MIME text/html no lugar de JS
  'Unable to preload CSS', // vite:preloadError de CSS
  'ChunkLoadError',
  'Loading chunk',
  'Loading CSS chunk',
]

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : ''
  return CHUNK_ERROR_PATTERNS.some(pattern => message.includes(pattern))
}

export const RECOVERY_KEY = 'arbo:chunk-recovery-at'
// Janela da trava: dentro dela, um novo erro de chunk não dispara outro reload
// automático (mostra a tela de erro com botão manual).
export const RECOVERY_WINDOW_MS = 60_000

type RecoveryEnv = {
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  now: () => number
  clearCaches: () => Promise<void>
  reload: () => void
}

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

// Remove todos os service workers e todos os caches (precache, html-cache,
// imagens...). O próximo carregamento vem 100% da rede, com o deploy atual.
export async function clearServiceWorkerCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(r => r.unregister()))
    }
  } catch {
    // segue para limpar os caches mesmo assim
  }
  try {
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map(name => caches.delete(name)))
    }
  } catch {
    // sem Cache API (modo privado etc.): o reload ainda ajuda
  }
}

const defaultEnv = (): RecoveryEnv => ({
  storage: safeSessionStorage(),
  now: () => Date.now(),
  clearCaches: clearServiceWorkerCaches,
  reload: () => window.location.reload(),
})

// Recuperação automática. Retorna false se já houve uma tentativa nos últimos
// 60 s — aí o chamador mostra a tela de erro com o botão "Recarregar".
export async function recoverFromChunkError(env: RecoveryEnv = defaultEnv()): Promise<boolean> {
  try {
    const last = Number(env.storage?.getItem(RECOVERY_KEY) ?? 0)
    if (last && env.now() - last < RECOVERY_WINDOW_MS) return false
    env.storage?.setItem(RECOVERY_KEY, String(env.now()))
  } catch {
    // sem sessionStorage: segue (o pior caso é um reload a mais)
  }
  await env.clearCaches()
  env.reload()
  return true
}

// Botão "Recarregar" das telas de erro: sempre limpa os caches antes.
export async function hardReload(env: RecoveryEnv = defaultEnv()): Promise<void> {
  await env.clearCaches()
  env.reload()
}

// Erros de chunk que não passam por um Error Boundary do React:
// - vite:preloadError — o Vite dispara quando falha o preload de um import
//   dinâmico (JS ou CSS); preventDefault evita que o erro estoure na tela.
// - unhandledrejection — import() rejeitado fora de render.
export function installChunkErrorHandlers(): void {
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault()
    void recoverFromChunkError()
  })
  window.addEventListener('unhandledrejection', event => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault()
      void recoverFromChunkError()
    }
  })
}
