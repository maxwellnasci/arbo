// Regras de chave dos vídeos no R2 (bucket arbo-videos), compartilhadas por
// r2-upload e r2-delete. Sem APIs do Deno — testável no Vitest
// (src/test/r2Keys.test.ts).
//
// Layout multi-tenant:  videos/{organization_id}/{trainingId}/{arquivo}
// Layout legado:        videos/{trainingId}/{arquivo}
//   As chaves legadas são todas anteriores ao multi-tenant (2026-10-07), ou
//   seja, da organização padrão (Arbo) — só um admin da Arbo pode apagá-las.

export const DEFAULT_ORG_ID = '00000000-0000-4000-a000-000000000001'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

// Remove acentos/caracteres especiais preservando a extensão — a chave do objeto
// no R2 vira parte de uma URL pública, então precisa ser um path seguro.
export function sanitizeFilename(name: string): string {
  const lastDot = name.lastIndexOf('.')
  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  const ext = lastDot > 0 ? name.slice(lastDot) : ''
  const safeBase = base.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]/g, '_').slice(0, 80)
  const safeExt = ext.replace(/[^\w.]/g, '').slice(0, 10)
  return `${safeBase || 'video'}${safeExt}`
}

// trainingId sanitizado: vira parte literal da key (evita path traversal).
export function sanitizeSegment(value: string): string {
  return value.replace(/[^\w-]/g, '')
}

export function buildVideoKey(organizationId: string, trainingId: string, filename: string): string {
  return `videos/${organizationId}/${sanitizeSegment(trainingId)}/${sanitizeFilename(filename)}`
}

// Pode apagar? Só chaves da pasta da própria organização; chaves legadas só
// para a organização padrão. Qualquer coisa fora de videos/, com segmentos
// vazios ou "..", é recusada.
export function canDeleteVideoKey(key: string, organizationId: string): boolean {
  if (!isUuid(organizationId)) return false
  const parts = key.split('/')
  if (parts[0] !== 'videos' || parts.some((p) => p === '' || p === '.' || p === '..')) return false
  if (parts.length === 4) return parts[1] === organizationId
  if (parts.length === 3) return organizationId === DEFAULT_ORG_ID
  return false
}

// Exclusão de assessoria (delete-organization): pasta inteira de vídeos da
// organização. Nunca a da organização padrão (Arbo) nem id inválido — e o
// prefixo termina em "/" para "videos/{id}" não casar com "videos/{id}xyz".
export function organizationVideoPrefix(organizationId: string): string | null {
  if (!isUuid(organizationId) || organizationId.toLowerCase() === DEFAULT_ORG_ID) return null
  return `videos/${organizationId.toLowerCase()}/`
}

export type ListObjectsPage = { keys: string[]; isTruncated: boolean; nextContinuationToken: string | null }

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

// Resposta do ListObjectsV2 (S3/R2) — só o que a exclusão precisa.
export function parseListObjectsV2(xml: string): ListObjectsPage {
  const keys = [...xml.matchAll(/<Contents>[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<\/Contents>/g)].map((m) => decodeXml(m[1]))
  const isTruncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml)
  const token = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)
  return { keys, isTruncated, nextContinuationToken: token ? decodeXml(token[1]) : null }
}

// Só apaga o que está de fato na pasta da organização excluída (defesa em
// profundidade contra uma listagem inesperada).
export function isOrganizationVideoKey(key: string, organizationId: string): boolean {
  const prefix = organizationVideoPrefix(organizationId)
  return prefix !== null && key.startsWith(prefix) && canDeleteVideoKey(key, organizationId.toLowerCase())
}
