import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import {
  DEFAULT_BRAND,
  ORGANIZATION_BRAND_COLUMNS,
  applyBrandVars,
  brandCssVars,
  brandFromOrganization,
  brandFromPublicRow,
  readBrandCache,
  writeBrandCache,
  type Brand,
} from '../lib/brand'

type BrandContextValue = {
  brand: Brand
  isLoading: boolean
  // Assessoria pausada pelo dono da plataforma — só true depois de carregar a
  // marca DO SERVIDOR para o usuário atual (nunca a partir de cache antigo).
  isPaused: boolean
  // Aplica e guarda no cache uma marca recém-salva (ex.: tela Minha Assessoria),
  // sem esperar um novo fetch.
  commitBrand: (next: Brand) => void
  // Tela de login /a/:slug: aplica a marca pública da assessoria (sem sessão).
  // Retorna false se o slug não existir.
  loadPublicBrand: (slug: string) => Promise<boolean>
}

const BrandContext = createContext<BrandContextValue | null>(null)

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  // Refaz o fetch se a assessoria do usuário mudar (claim nova após refresh do token).
  const orgClaim = typeof user?.app_metadata?.org_id === 'string' ? user.app_metadata.org_id : null

  // Começa pelo cache do dispositivo (o mesmo que o script anti-flicker do
  // index.html já aplicou) — sem piscar a marca padrão.
  const [brand, setBrand] = useState<Brand>(() => readBrandCache(safeLocalStorage()) ?? DEFAULT_BRAND)
  const [isLoading, setIsLoading] = useState(false)
  // id do usuário para quem a marca atual veio do servidor
  const [serverBrandFor, setServerBrandFor] = useState<string | null>(null)

  useEffect(() => {
    applyBrandVars(brandCssVars(brand))
  }, [brand])

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Sem sessão mantém a última marca do dispositivo (tela de login).
      if (!userId) return
      setIsLoading(true)
      // RLS (organizations_select_own) devolve só a organização do usuário.
      const { data, error } = await supabase
        .from('organizations')
        .select(ORGANIZATION_BRAND_COLUMNS)
        .maybeSingle()
      if (cancelled) return
      setIsLoading(false)
      if (error) {
        console.error('Erro ao carregar a marca da assessoria:', error.message)
        return
      }
      if (!data) return
      const next = brandFromOrganization(data)
      setBrand(next)
      setServerBrandFor(userId)
      writeBrandCache(safeLocalStorage(), next)
    }
    load()
    return () => { cancelled = true }
  }, [userId, orgClaim])

  const commitBrand = useCallback((next: Brand) => {
    setBrand(next)
    writeBrandCache(safeLocalStorage(), next)
  }, [])

  const isPaused = Boolean(userId) && serverBrandFor === userId && !brand.isActive

  const loadPublicBrand = useCallback(async (slug: string) => {
    const { data, error } = await supabase.rpc('get_brand_by_slug', { p_slug: slug })
    if (error) {
      console.error('Erro ao carregar a marca da assessoria:', error.message)
      return false
    }
    const row = data?.[0]
    if (!row) return false
    commitBrand(brandFromPublicRow(row))
    return true
  }, [commitBrand])

  return (
    <BrandContext.Provider value={{ brand, isLoading, isPaused, commitBrand, loadPublicBrand }}>
      {children}
    </BrandContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand deve ser usado dentro de BrandProvider')
  return ctx
}
