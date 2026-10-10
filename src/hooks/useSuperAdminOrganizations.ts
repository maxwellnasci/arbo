import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MANAGED_ORGANIZATION_COLUMNS, type ManagedOrganization } from '../lib/superAdmin'
import { removeOldOrganizationLogo, removeOrganizationLogoPath, uploadOrganizationLogo } from '../lib/organizationLogo'
import type {
  CreateOrganizationInput,
  InputErrors,
  UpdateInputErrors,
  UpdateOrganizationInput,
} from '../../supabase/functions/_shared/organizationInput'

export type CreateOrganizationResult =
  // logoError: a assessoria foi criada, mas a logo não subiu (dá para enviar
  // depois pelo Editar) — nunca desfaz o cadastro/convite por causa da logo.
  | { ok: true; organization: ManagedOrganization; studentAccessUrl: string; logoError?: string }
  | { ok: false; error: string; fields?: InputErrors }

export type UpdateOrganizationResult =
  | { ok: true; organization: ManagedOrganization }
  | { ok: false; error: string; fields?: UpdateInputErrors }

export type SimpleResult = { ok: true } | { ok: false; error: string }

// warning: a assessoria foi excluída, mas algum arquivo (vídeo/logo) ficou no
// armazenamento — não desfaz nada, só avisa.
export type DeleteOrganizationResult = { ok: true; warning?: string } | { ok: false; error: string }

// Troca de logo na edição: arquivo novo, remover a atual, ou nada.
export type LogoChange = { file: File | null; remove: boolean }

async function callFunction(name: string, body: unknown): Promise<{ res: Response; json: unknown } | { error: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Sessão expirada. Faça login novamente.' }
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
    return { res, json: await res.json().catch(() => null) }
  } catch {
    return { error: 'Sem conexão. Verifique a internet e tente de novo.' }
  }
}

// Painel Super Admin: lista todas as assessorias (RLS organizations_super_admin_select),
// cria pela Edge Function create-organization (organização + convite, tudo ou
// nada), edita/pausa direto na tabela (RLS organizations_super_admin_update;
// o trigger trg_protect_organization_fields protege o slug da Arbo) e exclui
// pela Edge Function delete-organization (apaga dados e contas da assessoria).
export function useSuperAdminOrganizations() {
  const [organizations, setOrganizations] = useState<ManagedOrganization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('organizations')
        .select(MANAGED_ORGANIZATION_COLUMNS)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setIsLoading(false)
      if (fetchError) {
        setError(fetchError.message)
        return
      }
      setOrganizations(data ?? [])
    }
    load()
    return () => { cancelled = true }
  }, [reloadKey])

  const replaceLocal = useCallback((org: ManagedOrganization) => {
    setOrganizations(list => list.map(o => (o.id === org.id ? org : o)))
  }, [])

  const createOrganization = useCallback(async (
    input: CreateOrganizationInput,
    logoFile: File | null = null,
  ): Promise<CreateOrganizationResult> => {
    const call = await callFunction('create-organization', input)
    if ('error' in call) return { ok: false, error: call.error }
    const body = call.json as
      | { organization?: ManagedOrganization; studentAccessUrl?: string; error?: string; fields?: InputErrors }
      | null

    if (!call.res.ok || !body?.organization || !body.studentAccessUrl) {
      return { ok: false, error: body?.error ?? 'Erro ao cadastrar a assessoria.', fields: body?.fields }
    }

    // Logo depois do cadastro (a pasta {orgId}/ só existe com a org criada).
    let organization = body.organization
    let logoError: string | undefined
    if (logoFile) {
      let uploadedPath: string | null = null
      try {
        const uploaded = await uploadOrganizationLogo(organization.id, logoFile)
        uploadedPath = uploaded.path
        const { data, error: updateError } = await supabase
          .from('organizations')
          .update({ logo_url: uploaded.publicUrl })
          .eq('id', organization.id)
          .select(MANAGED_ORGANIZATION_COLUMNS)
          .single()
        if (updateError || !data) throw new Error(updateError?.message ?? 'sem permissão')
        organization = data
      } catch (e: unknown) {
        if (uploadedPath) await removeOrganizationLogoPath(uploadedPath)
        logoError = e instanceof Error ? e.message : 'Erro desconhecido'
      }
    }

    setReloadKey(k => k + 1)
    return { ok: true, organization, studentAccessUrl: body.studentAccessUrl, logoError }
  }, [])

  // Mesma ordem segura da "Minha Assessoria": upload → UPDATE → (falhou: apaga
  // o upload) → (deu certo: apaga a logo antiga).
  const updateOrganization = useCallback(async (
    current: ManagedOrganization,
    input: UpdateOrganizationInput,
    logo: LogoChange = { file: null, remove: false },
  ): Promise<UpdateOrganizationResult> => {
    const id = current.id
    let logoUrl = logo.remove ? null : current.logo_url
    let uploadedPath: string | null = null
    if (logo.file) {
      try {
        const uploaded = await uploadOrganizationLogo(id, logo.file)
        uploadedPath = uploaded.path
        logoUrl = uploaded.publicUrl
      } catch (e: unknown) {
        return { ok: false, error: e instanceof Error ? e.message : 'Erro ao enviar a logo.' }
      }
    }

    const { data, error: updateError } = await supabase
      .from('organizations')
      .update({
        logo_url: logoUrl,
        name: input.name,
        slug: input.slug,
        brand_name: input.brandName,
        coach_display_name: input.coachDisplayName,
        primary_color: input.primaryColor,
        secondary_color: input.secondaryColor,
        accent_color: input.accentColor,
        ai_tone: input.aiTone,
      })
      .eq('id', id)
      .select(MANAGED_ORGANIZATION_COLUMNS)
      .single()

    if (updateError || !data) {
      if (uploadedPath) await removeOrganizationLogoPath(uploadedPath)
      if (updateError?.code === '23505') {
        return { ok: false, error: 'Esse slug já está em uso. Escolha outro link.', fields: { slug: 'Slug já em uso.' } }
      }
      return { ok: false, error: `Erro ao salvar: ${updateError?.message ?? 'sem permissão'}` }
    }
    await removeOldOrganizationLogo(id, current.logo_url, logoUrl)
    replaceLocal(data)
    return { ok: true, organization: data }
  }, [replaceLocal])

  const setActive = useCallback(async (id: string, isActive: boolean): Promise<SimpleResult> => {
    const { data, error: updateError } = await supabase
      .from('organizations')
      .update({ is_active: isActive })
      .eq('id', id)
      .select(MANAGED_ORGANIZATION_COLUMNS)
      .single()
    if (updateError || !data) return { ok: false, error: updateError?.message ?? 'Sem permissão.' }
    replaceLocal(data)
    return { ok: true }
  }, [replaceLocal])

  const deleteOrganization = useCallback(async (id: string, confirmName: string): Promise<DeleteOrganizationResult> => {
    const call = await callFunction('delete-organization', { organizationId: id, confirmName })
    if ('error' in call) return { ok: false, error: call.error }
    const body = call.json as { error?: string; videosFailed?: number; videosSkipped?: boolean } | null
    if (!call.res.ok) return { ok: false, error: body?.error ?? 'Erro ao excluir a assessoria.' }
    setOrganizations(list => list.filter(o => o.id !== id))
    if (body?.videosSkipped || (body?.videosFailed ?? 0) > 0) {
      return { ok: true, warning: 'Alguns vídeos dos treinos não foram apagados do armazenamento (ficaram órfãos).' }
    }
    return { ok: true }
  }, [])

  return { organizations, isLoading, error, createOrganization, updateOrganization, setActive, deleteOrganization }
}
