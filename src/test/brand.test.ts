import { describe, it, expect } from 'vitest'
import {
  BRAND_CACHE_KEY,
  DEFAULT_BRAND,
  brandCssVars,
  brandFromOrganization,
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
    expect(brandCssVars({ primaryColor: '#1D4ED8', secondaryColor: '#F59E0B' })).toEqual({
      '--brand-primary': '#1D4ED8',
      '--brand-secondary': '#F59E0B',
      '--brand-accent': '#1D4ED8',
      '--text-on-brand': '#ffffff',
    })
    const fallback = brandCssVars({ primaryColor: 'javascript:alert(1)', secondaryColor: null })
    expect(fallback['--brand-primary']).toBe(DEFAULT_BRAND.primaryColor)
    expect(fallback['--brand-secondary']).toBe(DEFAULT_BRAND.primaryColor)
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
