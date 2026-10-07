import { describe, it, expect } from 'vitest'
import { brandAssetPathFromUrl, buildLogoPath, validateLogoFile } from '../lib/brandAssets'

const ORG = '00000000-0000-4000-a000-000000000001'
const BASE = 'https://jhfkflnixzivuichmkie.supabase.co/storage/v1/object/public/brand-assets/'

describe('validateLogoFile', () => {
  it('aceita PNG e WebP até 2 MB', () => {
    expect(validateLogoFile({ type: 'image/png', size: 500_000 })).toBeNull()
    expect(validateLogoFile({ type: 'image/webp', size: 2 * 1024 * 1024 })).toBeNull()
  })

  it('recusa SVG, JPEG e arquivos grandes', () => {
    expect(validateLogoFile({ type: 'image/svg+xml', size: 1000 })).toMatch(/PNG ou WebP/)
    expect(validateLogoFile({ type: 'image/jpeg', size: 1000 })).toMatch(/PNG ou WebP/)
    expect(validateLogoFile({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toMatch(/2 MB/)
  })
})

describe('buildLogoPath', () => {
  it('usa a pasta da organização e nome único', () => {
    expect(buildLogoPath(ORG, 'image/webp', 123)).toBe(`${ORG}/logo-123.webp`)
    expect(buildLogoPath(ORG, 'image/png', 456)).toBe(`${ORG}/logo-456.png`)
  })
})

describe('brandAssetPathFromUrl', () => {
  it('extrai o caminho de uma logo da própria organização', () => {
    expect(brandAssetPathFromUrl(`${BASE}${ORG}/logo-1.webp`, ORG)).toBe(`${ORG}/logo-1.webp`)
    expect(brandAssetPathFromUrl(`${BASE}${ORG}/logo-1.webp?t=2`, ORG)).toBe(`${ORG}/logo-1.webp`)
  })

  it('ignora URL de outro lugar, de outra organização ou com ..', () => {
    expect(brandAssetPathFromUrl(null, ORG)).toBeNull()
    expect(brandAssetPathFromUrl('https://cdn.exemplo.com/logo.png', ORG)).toBeNull()
    expect(brandAssetPathFromUrl(`${BASE}outra-org/logo-1.webp`, ORG)).toBeNull()
    expect(brandAssetPathFromUrl(`${BASE}${ORG}/../outra/logo.webp`, ORG)).toBeNull()
  })
})
