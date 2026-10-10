import { supabase } from './supabase'
import { Sentry } from './sentry'
import { BRAND_ASSETS_BUCKET, brandAssetPathFromUrl, buildLogoPath, validateLogoFile } from './brandAssets'

// Logo da assessoria no bucket `brand-assets` (pasta {organization_id}/).
// Usado pela "Minha Assessoria" (admin da própria org) e pelo Painel Super
// Admin (qualquer org — policies brand_assets_super_admin_*). Ordem segura de
// troca, mesma lição do r2-delete:
//   1. uploadOrganizationLogo  → arquivo novo no bucket
//   2. UPDATE organizations    → feito por quem chama
//   3. falhou o UPDATE         → removeOrganizationLogoPath(arquivo novo)
//   4. deu certo               → removeOldOrganizationLogo(logo antiga)

export type UploadedLogo = { path: string; publicUrl: string }

export async function uploadOrganizationLogo(organizationId: string, file: File): Promise<UploadedLogo> {
  const invalid = validateLogoFile(file)
  if (invalid) throw new Error(invalid)

  const path = buildLogoPath(organizationId, file.type)
  const { error } = await supabase.storage
    .from(BRAND_ASSETS_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (error) throw new Error(`Erro ao enviar a logo: ${error.message}`)

  return { path, publicUrl: supabase.storage.from(BRAND_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl }
}

// Melhor esforço: arquivo que não sai fica órfão (barato), nunca quebra o fluxo.
export async function removeOrganizationLogoPath(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BRAND_ASSETS_BUCKET).remove([path])
  if (error) {
    console.error('Logo não removida (arquivo órfão):', error.message)
    Sentry.captureException(error)
  }
}

// Remove a logo antiga só se ela for do nosso bucket, da pasta da org e
// realmente tiver sido trocada/removida.
export async function removeOldOrganizationLogo(
  organizationId: string,
  oldUrl: string | null,
  newUrl: string | null,
): Promise<void> {
  const oldPath = brandAssetPathFromUrl(oldUrl, organizationId)
  if (oldPath && oldUrl !== newUrl) await removeOrganizationLogoPath(oldPath)
}
