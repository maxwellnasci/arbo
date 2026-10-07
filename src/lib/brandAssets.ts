// Logo da assessoria no Supabase Storage (bucket público `brand-assets`).
// Os mesmos limites são aplicados pelo próprio bucket no servidor
// (migration 20261007102510); aqui é só para dar erro amigável antes do upload.

export const BRAND_ASSETS_BUCKET = 'brand-assets'
export const LOGO_MAX_BYTES = 2 * 1024 * 1024
export const LOGO_MIME_TYPES = ['image/png', 'image/webp'] as const

const EXTENSION_BY_TYPE: Record<(typeof LOGO_MIME_TYPES)[number], string> = {
  'image/png': 'png',
  'image/webp': 'webp',
}

export function validateLogoFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Envie a logo em PNG ou WebP.'
  }
  if (file.size > LOGO_MAX_BYTES) {
    return 'A logo pode ter no máximo 2 MB.'
  }
  return null
}

// {organization_id}/logo-{timestamp}.{ext} — nome único por upload para a URL
// pública mudar a cada troca (cache do service worker/CDN nunca serve a antiga).
export function buildLogoPath(organizationId: string, fileType: string, now: number = Date.now()): string {
  const ext = EXTENSION_BY_TYPE[fileType as keyof typeof EXTENSION_BY_TYPE] ?? 'png'
  return `${organizationId}/logo-${now}.${ext}`
}

// Caminho do objeto a partir da URL pública — só se for do nosso bucket e da
// pasta da organização (nunca apagar arquivo que não é da assessoria).
export function brandAssetPathFromUrl(url: string | null, organizationId: string): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BRAND_ASSETS_BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0])
  if (!path.startsWith(`${organizationId}/`) || path.includes('..')) return null
  return path
}
