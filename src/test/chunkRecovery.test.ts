import { describe, it, expect, vi } from 'vitest'
import {
  RECOVERY_KEY,
  RECOVERY_WINDOW_MS,
  hardReload,
  isChunkLoadError,
  recoverFromChunkError,
} from '../lib/chunkRecovery'

function fakeEnv(start = 1_000_000) {
  const data = new Map<string, string>()
  const calls: string[] = []
  let now = start
  return {
    calls,
    advance: (ms: number) => { now += ms },
    env: {
      storage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => { data.set(k, v) },
      },
      now: () => now,
      clearCaches: vi.fn(async () => { calls.push('clearCaches') }),
      reload: vi.fn(() => { calls.push('reload') }),
    },
    data,
  }
}

describe('isChunkLoadError', () => {
  it('reconhece as mensagens de Chrome, Safari e Firefox', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://arbo.mxos.com.br/assets/AdminTreinos-abc.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true)
    expect(isChunkLoadError('Failed to load module script: Expected a JavaScript module')).toBe(true)
    expect(isChunkLoadError({ message: 'Loading chunk 3 failed' })).toBe(true)
  })

  it('não confunde com outros erros', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'slice')"))).toBe(false)
    expect(isChunkLoadError(new TypeError('Failed to fetch'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError(42)).toBe(false)
  })
})

describe('recoverFromChunkError', () => {
  it('limpa os caches ANTES de recarregar', async () => {
    const { env, calls, data } = fakeEnv()
    expect(await recoverFromChunkError(env)).toBe(true)
    expect(calls).toEqual(['clearCaches', 'reload'])
    expect(data.get(RECOVERY_KEY)).toBe('1000000')
  })

  it('não entra em loop: segunda falha dentro de 60 s não recarrega', async () => {
    const { env, advance } = fakeEnv()
    await recoverFromChunkError(env)
    advance(5_000)
    expect(await recoverFromChunkError(env)).toBe(false)
    expect(env.reload).toHaveBeenCalledTimes(1)
  })

  it('depois da janela, uma nova falha volta a recuperar (não fica preso)', async () => {
    const { env, advance } = fakeEnv()
    await recoverFromChunkError(env)
    advance(RECOVERY_WINDOW_MS + 1)
    expect(await recoverFromChunkError(env)).toBe(true)
    expect(env.reload).toHaveBeenCalledTimes(2)
  })

  it('funciona sem sessionStorage', async () => {
    const { env } = fakeEnv()
    expect(await recoverFromChunkError({ ...env, storage: null })).toBe(true)
    expect(env.reload).toHaveBeenCalledTimes(1)
  })

  it('o botão manual sempre limpa e recarrega, mesmo dentro da janela', async () => {
    const { env, calls } = fakeEnv()
    await recoverFromChunkError(env)
    await hardReload(env)
    expect(calls).toEqual(['clearCaches', 'reload', 'clearCaches', 'reload'])
  })
})
