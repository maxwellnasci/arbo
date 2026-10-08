import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MANAGED_ORGANIZATION_COLUMNS, type ManagedOrganization } from '../lib/superAdmin'
import type { CreateOrganizationInput, InputErrors } from '../../supabase/functions/_shared/organizationInput'

export type CreateOrganizationResult =
  | { ok: true; organization: ManagedOrganization; studentAccessUrl: string }
  | { ok: false; error: string; fields?: InputErrors }

// Lista todas as assessorias (RLS organizations_super_admin_select) e cria
// novas pela Edge Function create-organization (organização + convite do
// professor, tudo ou nada).
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

  const createOrganization = useCallback(async (input: CreateOrganizationInput): Promise<CreateOrganizationResult> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { ok: false, error: 'Sessão expirada. Faça login novamente.' }

    let res: Response
    try {
      res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(input),
      })
    } catch {
      return { ok: false, error: 'Sem conexão. Verifique a internet e tente de novo.' }
    }

    const body = (await res.json().catch(() => null)) as
      | { organization?: ManagedOrganization; studentAccessUrl?: string; error?: string; fields?: InputErrors }
      | null

    if (!res.ok || !body?.organization || !body.studentAccessUrl) {
      return { ok: false, error: body?.error ?? 'Erro ao cadastrar a assessoria.', fields: body?.fields }
    }

    setReloadKey(k => k + 1)
    return { ok: true, organization: body.organization, studentAccessUrl: body.studentAccessUrl }
  }, [])

  return { organizations, isLoading, error, createOrganization }
}
