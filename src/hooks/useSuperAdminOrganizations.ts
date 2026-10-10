import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MANAGED_ORGANIZATION_COLUMNS, type ManagedOrganization } from '../lib/superAdmin'
import type {
  CreateOrganizationInput,
  InputErrors,
  UpdateInputErrors,
  UpdateOrganizationInput,
} from '../../supabase/functions/_shared/organizationInput'

export type CreateOrganizationResult =
  | { ok: true; organization: ManagedOrganization; studentAccessUrl: string }
  | { ok: false; error: string; fields?: InputErrors }

export type UpdateOrganizationResult =
  | { ok: true; organization: ManagedOrganization }
  | { ok: false; error: string; fields?: UpdateInputErrors }

export type SimpleResult = { ok: true } | { ok: false; error: string }

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

  const createOrganization = useCallback(async (input: CreateOrganizationInput): Promise<CreateOrganizationResult> => {
    const call = await callFunction('create-organization', input)
    if ('error' in call) return { ok: false, error: call.error }
    const body = call.json as
      | { organization?: ManagedOrganization; studentAccessUrl?: string; error?: string; fields?: InputErrors }
      | null

    if (!call.res.ok || !body?.organization || !body.studentAccessUrl) {
      return { ok: false, error: body?.error ?? 'Erro ao cadastrar a assessoria.', fields: body?.fields }
    }

    setReloadKey(k => k + 1)
    return { ok: true, organization: body.organization, studentAccessUrl: body.studentAccessUrl }
  }, [])

  const updateOrganization = useCallback(async (id: string, input: UpdateOrganizationInput): Promise<UpdateOrganizationResult> => {
    const { data, error: updateError } = await supabase
      .from('organizations')
      .update({
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
      if (updateError?.code === '23505') {
        return { ok: false, error: 'Esse slug já está em uso. Escolha outro link.', fields: { slug: 'Slug já em uso.' } }
      }
      return { ok: false, error: `Erro ao salvar: ${updateError?.message ?? 'sem permissão'}` }
    }
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

  const deleteOrganization = useCallback(async (id: string, confirmName: string): Promise<SimpleResult> => {
    const call = await callFunction('delete-organization', { organizationId: id, confirmName })
    if ('error' in call) return { ok: false, error: call.error }
    const body = call.json as { error?: string } | null
    if (!call.res.ok) return { ok: false, error: body?.error ?? 'Erro ao excluir a assessoria.' }
    setOrganizations(list => list.filter(o => o.id !== id))
    return { ok: true }
  }, [])

  return { organizations, isLoading, error, createOrganization, updateOrganization, setActive, deleteOrganization }
}
