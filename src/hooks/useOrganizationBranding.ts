import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Sentry } from '../lib/sentry'
import { ORGANIZATION_BRAND_COLUMNS, brandFromOrganization, type Brand } from '../lib/brand'
import { BRAND_ASSETS_BUCKET, brandAssetPathFromUrl, buildLogoPath, validateLogoFile } from '../lib/brandAssets'

export type BrandingForm = {
  brandName: string
  coachDisplayName: string
  primaryColor: string
  // Arquivo novo escolhido (ainda não enviado) — o upload só acontece no save.
  logoFile: File | null
  // Remover a logo atual (volta para a logo padrão do app).
  removeLogo: boolean
}

// Salvar a marca da assessoria. Ordem pensada para nunca deixar link quebrado
// (mesma lição do r2-delete — ver CLAUDE.md "Upload de Vídeo"):
//   1. upload da logo nova (se houver)
//   2. UPDATE em organizations (RLS: admin da própria org)
//   3. se o UPDATE falhar → apaga o arquivo recém-enviado (nada fica órfão)
//   4. só depois do sucesso → apaga a logo antiga do bucket (melhor esforço)
export function useOrganizationBranding() {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(async (current: Brand, form: BrandingForm): Promise<Brand | null> => {
    if (!current.id) {
      setError('Assessoria não carregada. Recarregue a página.')
      return null
    }
    const orgId = current.id
    setIsSaving(true)
    setError(null)

    let uploadedPath: string | null = null
    try {
      let logoUrl = form.removeLogo ? null : current.logoUrl

      if (form.logoFile) {
        const invalid = validateLogoFile(form.logoFile)
        if (invalid) throw new Error(invalid)

        const path = buildLogoPath(orgId, form.logoFile.type)
        const { error: uploadError } = await supabase.storage
          .from(BRAND_ASSETS_BUCKET)
          .upload(path, form.logoFile, { contentType: form.logoFile.type, cacheControl: '3600', upsert: false })
        if (uploadError) throw new Error(`Erro ao enviar a logo: ${uploadError.message}`)
        uploadedPath = path
        logoUrl = supabase.storage.from(BRAND_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl
      }

      const { data, error: updateError } = await supabase
        .from('organizations')
        .update({
          brand_name: form.brandName.trim(),
          coach_display_name: form.coachDisplayName.trim() || null,
          primary_color: form.primaryColor,
          logo_url: logoUrl,
        })
        .eq('id', orgId)
        .select(ORGANIZATION_BRAND_COLUMNS)
        .single()

      if (updateError || !data) {
        throw new Error(`Erro ao salvar a marca: ${updateError?.message ?? 'sem permissão'}`)
      }

      // Logo antiga trocada ou removida: apaga do bucket só agora.
      const oldPath = brandAssetPathFromUrl(current.logoUrl, orgId)
      if (oldPath && current.logoUrl !== logoUrl) {
        const { error: removeError } = await supabase.storage.from(BRAND_ASSETS_BUCKET).remove([oldPath])
        if (removeError) {
          console.error('Logo antiga não removida (arquivo órfão):', removeError.message)
          Sentry.captureException(removeError)
        }
      }

      return brandFromOrganization(data)
    } catch (e: unknown) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from(BRAND_ASSETS_BUCKET).remove([uploadedPath])
        if (cleanupError) Sentry.captureException(cleanupError)
      }
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { save, isSaving, error }
}
