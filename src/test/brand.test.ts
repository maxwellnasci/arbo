import { describe, it, expect } from 'vitest'
import {
  BRAND_CACHE_KEY,
  DEFAULT_BRAND,
  brandCssVars,
  brandFromOrganization,
  brandFromPublicRow,
  contrastRatio,
  isHexColor,
  pickTextOnBrand,
  readBrandCache,
  writeBrandCache,
  type Brand,
} from '../lib/brand'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v) },
  }
}

describe('cores da marca', () => {
  it('valida hex #RRGGBB', () => {
    expect(isHexColor('#E8521A')).toBe(true)
    expect(isHexColor('#e8521a')).toBe(true)
    expect(isHexColor('E8521A')).toBe(false)
    expect(isHexColor('#fff')).toBe(false)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor(null)).toBe(false)
  })

  it('calcula contraste WCAG', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0)
    expect(contrastRatio('#E8521A', '#ffffff')).toBeCloseTo(3.74, 1)
  })

  it('mantém texto branco no laranja da Arbo (comportamento atual)', () => {
    expect(pickTextOnBrand('#E8521A')).toBe('#ffffff')
  })

  it('troca para texto escuro em cores claras', () => {
    expect(pickTextOnBrand('#FACC15')).toBe('#111111') // amarelo
    expect(pickTextOnBrand('#A3E635')).toBe('#111111') // verde-limão
    expect(pickTextOnBrand('#1D4ED8')).toBe('#ffffff') // azul escuro
  })

  it('monta as variáveis com fallback para cor inválida', () => {
    expect(brandCssVars({ primaryColor: '#1D4ED8', secondaryColor: '#F59E0B', accentColor: '#22C55E' })).toEqual({
      '--brand-primary': '#1D4ED8',
      '--brand-secondary': '#F59E0B',
      '--brand-accent': '#22C55E',
      '--text-on-brand': '#ffffff',
    })
    const fallback = brandCssVars({ primaryColor: 'javascript:alert(1)', secondaryColor: null, accentColor: 'red' })
    expect(fallback['--brand-primary']).toBe(DEFAULT_BRAND.primaryColor)
    expect(fallback['--brand-secondary']).toBe(DEFAULT_BRAND.primaryColor)
    expect(fallback['--brand-accent']).toBe(DEFAULT_BRAND.primaryColor)
  })

  it('secundária e destaque sem valor caem na primária (app igual ao de antes)', () => {
    const vars = brandCssVars({ primaryColor: '#E8521A', secondaryColor: null, accentColor: null })
    expect(vars['--brand-secondary']).toBe('#E8521A')
    expect(vars['--brand-accent']).toBe('#E8521A')
  })

  it('texto sobre a marca depende só da primária', () => {
    const vars = brandCssVars({ primaryColor: '#FACC15', secondaryColor: '#111827', accentColor: '#1D4ED8' })
    expect(vars['--text-on-brand']).toBe('#111111')
  })
})

describe('cache da marca', () => {
  const brand: Brand = {
    ...DEFAULT_BRAND,
    id: 'org-1',
    brandName: 'Box Azul',
    primaryColor: '#1D4ED8',
    logoUrl: 'https://exemplo.supabase.co/storage/v1/object/public/brand-assets/org-1/logo.webp',
  }

  it('grava e lê a marca com as variáveis calculadas', () => {
    const storage = memoryStorage()
    writeBrandCache(storage, brand)
    expect(readBrandCache(storage)).toEqual(brand)
    const raw = JSON.parse(storage.getItem(BRAND_CACHE_KEY) ?? '{}')
    expect(raw.vars['--brand-primary']).toBe('#1D4ED8')
  })

  it('ignora cache corrompido, cor inválida e logo fora de https', () => {
    const storage = memoryStorage()
    storage.setItem(BRAND_CACHE_KEY, '{quebrado')
    expect(readBrandCache(storage)).toBeNull()
    storage.setItem(BRAND_CACHE_KEY, JSON.stringify({ brand: { ...brand, primaryColor: 'red' } }))
    expect(readBrandCache(storage)).toBeNull()
    storage.setItem(BRAND_CACHE_KEY, JSON.stringify({ brand: { ...brand, logoUrl: 'javascript:alert(1)' } }))
    expect(readBrandCache(storage)?.logoUrl).toBeNull()
    expect(readBrandCache(null)).toBeNull()
  })
})

describe('blindagem contra valores inesperados (nunca TypeError)', () => {
  it('contraste e texto sobre a marca toleram valor inválido', () => {
    expect(() => contrastRatio(undefined, '#ffffff')).not.toThrow()
    expect(() => contrastRatio(null, 42)).not.toThrow()
    expect(pickTextOnBrand(undefined)).toBe(pickTextOnBrand(DEFAULT_BRAND.primaryColor))
    expect(pickTextOnBrand({ cor: 'x' })).toBe('#ffffff')
  })

  it('cache com tipos errados é saneado campo a campo', () => {
    const storage = memoryStorage()
    storage.setItem(BRAND_CACHE_KEY, JSON.stringify({
      brand: { brandName: 'Box', primaryColor: '#1D4ED8', id: 123, slug: { x: 1 }, name: null, secondaryColor: 'azul', coachDisplayName: ['x'] },
    }))
    expect(readBrandCache(storage)).toEqual({
      id: null,
      name: DEFAULT_BRAND.name,
      slug: DEFAULT_BRAND.slug,
      brandName: 'Box',
      logoUrl: null,
      primaryColor: '#1D4ED8',
      secondaryColor: null,
      accentColor: null,
      coachDisplayName: null,
      isActive: true,
    })
    storage.setItem(BRAND_CACHE_KEY, 'null')
    expect(readBrandCache(storage)).toBeNull()
    storage.setItem(BRAND_CACHE_KEY, JSON.stringify({ brand: 'texto' }))
    expect(readBrandCache(storage)).toBeNull()
  })
})

describe('brandFromOrganization', () => {
  it('usa name quando brand_name está vazio', () => {
    const b = brandFromOrganization({
      id: 'x', name: 'Arbo Run', slug: 'arbo', brand_name: '  ', logo_url: null,
      primary_color: '#E8521A', secondary_color: null, coach_display_name: '',
    })
    expect(b.brandName).toBe('Arbo Run')
    expect(b.coachDisplayName).toBeNull()
  })
})

describe('cores novas e status no cache', () => {
  it('guarda e lê accentColor e isActive', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) } }
    const brand: Brand = { ...DEFAULT_BRAND, id: 'o1', brandName: 'Box', accentColor: '#22C55E', secondaryColor: '#111827', isActive: false }
    writeBrandCache(storage, brand)
    const read = readBrandCache(storage)
    expect(read?.accentColor).toBe('#22C55E')
    expect(read?.secondaryColor).toBe('#111827')
    expect(read?.isActive).toBe(false)
    expect(JSON.parse(data.get(BRAND_CACHE_KEY) ?? '{}').vars['--brand-accent']).toBe('#22C55E')
  })

  it('cache antigo (sem accentColor/isActive) vale como ativa e sem destaque', () => {
    const data = new Map<string, string>([[BRAND_CACHE_KEY, JSON.stringify({ brand: { brandName: 'Velho', primaryColor: '#E8521A' } })]])
    const read = readBrandCache({ getItem: (k: string) => data.get(k) ?? null })
    expect(read?.isActive).toBe(true)
    expect(read?.accentColor).toBeNull()
  })

  it('organização e marca pública trazem accent e status', () => {
    const fromOrg = brandFromOrganization({
      id: 'x', name: 'Box', slug: 'box', brand_name: null, logo_url: null, primary_color: '#1D4ED8',
      secondary_color: null, accent_color: '#22C55E', coach_display_name: null, is_active: false,
    })
    expect(fromOrg.accentColor).toBe('#22C55E')
    expect(fromOrg.isActive).toBe(false)
    const pub = brandFromPublicRow({
      slug: 'box', name: 'Box', brand_name: 'Box', logo_url: null, primary_color: '#1D4ED8',
      secondary_color: null, accent_color: 'invalida', is_active: true,
    })
    expect(pub.accentColor).toBeNull()
    expect(pub.isActive).toBe(true)
  })
})
