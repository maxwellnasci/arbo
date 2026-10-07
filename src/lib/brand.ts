// Identidade visual da assessoria (white-label). Funções puras + cache local.
// O script anti-flicker do index.html lê o mesmo cache (BRAND_CACHE_KEY) e
// aplica só as variáveis — toda a lógica de cor fica aqui.

export type Brand = {
  id: string | null
  name: string
  slug: string
  brandName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string | null
  coachDisplayName: string | null
}

export const DEFAULT_BRAND: Brand = {
  id: null,
  name: 'Arbo Run',
  slug: 'arbo',
  brandName: 'Arbo Run',
  logoUrl: null,
  primaryColor: '#E8521A',
  secondaryColor: null,
  coachDisplayName: null,
}

export const BRAND_CACHE_KEY = 'arbo:brand'

export const BRAND_VAR_NAMES = ['--brand-primary', '--brand-secondary', '--brand-accent', '--text-on-brand'] as const
export type BrandVarName = (typeof BRAND_VAR_NAMES)[number]
export type BrandVars = Record<BrandVarName, string>

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value)
}

// Luminância relativa WCAG 2.x
export function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export const TEXT_ON_BRAND_LIGHT = '#ffffff'
export const TEXT_ON_BRAND_DARK = '#111111'

// Texto branco é o padrão visual do app (botões/badges da marca). Só troca
// para escuro quando o branco não atinge 3:1 (mínimo WCAG AA para texto
// grande/negrito e componentes de interface) — ex.: amarelo, verde-limão.
// O laranja da Arbo dá 3,7:1 com branco, então continua branco como hoje.
export const MIN_TEXT_ON_BRAND_CONTRAST = 3

export function pickTextOnBrand(primary: string): string {
  return contrastRatio(primary, TEXT_ON_BRAND_LIGHT) >= MIN_TEXT_ON_BRAND_CONTRAST
    ? TEXT_ON_BRAND_LIGHT
    : TEXT_ON_BRAND_DARK
}

export function brandCssVars(brand: Pick<Brand, 'primaryColor' | 'secondaryColor'>): BrandVars {
  const primary = isHexColor(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor
  const secondary = isHexColor(brand.secondaryColor) ? brand.secondaryColor : primary
  return {
    '--brand-primary': primary,
    '--brand-secondary': secondary,
    '--brand-accent': primary,
    '--text-on-brand': pickTextOnBrand(primary),
  }
}

export function applyBrandVars(vars: BrandVars, root: HTMLElement = document.documentElement): void {
  for (const name of BRAND_VAR_NAMES) {
    root.style.setProperty(name, vars[name])
  }
}

// Cor da marca usada como TEXTO sobre o fundo escuro do app (ex.: títulos,
// ícones). Cores muito escuras somem — a tela de configuração avisa.
export const DARK_APP_BACKGROUND = '#0d0d0d'

type BrandCache = { brand: Brand; vars: BrandVars }

export function readBrandCache(storage: Pick<Storage, 'getItem'> | null): Brand | null {
  try {
    const raw = storage?.getItem(BRAND_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BrandCache>
    const b = parsed.brand
    if (!b || typeof b.brandName !== 'string' || !isHexColor(b.primaryColor)) return null
    return {
      ...DEFAULT_BRAND,
      ...b,
      logoUrl: typeof b.logoUrl === 'string' && b.logoUrl.startsWith('https://') ? b.logoUrl : null,
    }
  } catch {
    return null
  }
}

export function writeBrandCache(storage: Pick<Storage, 'setItem'> | null, brand: Brand): void {
  try {
    const payload: BrandCache = { brand, vars: brandCssVars(brand) }
    storage?.setItem(BRAND_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // modo privado / storage cheio: só perde o anti-flicker
  }
}

type OrganizationRow = {
  id: string
  name: string
  slug: string
  brand_name: string | null
  logo_url: string | null
  primary_color: string
  secondary_color: string | null
  coach_display_name: string | null
}

export function brandFromOrganization(row: OrganizationRow): Brand {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brandName: row.brand_name?.trim() || row.name,
    logoUrl: row.logo_url,
    primaryColor: isHexColor(row.primary_color) ? row.primary_color : DEFAULT_BRAND.primaryColor,
    secondaryColor: isHexColor(row.secondary_color) ? row.secondary_color : null,
    coachDisplayName: row.coach_display_name?.trim() || null,
  }
}

export const ORGANIZATION_BRAND_COLUMNS =
  'id, name, slug, brand_name, logo_url, primary_color, secondary_color, coach_display_name'
