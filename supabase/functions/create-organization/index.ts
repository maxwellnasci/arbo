import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateCreateOrganizationInput } from '../_shared/organizationInput.ts'

// Onboarding de assessoria (Painel Super Admin): cria a organização e convida
// o professor responsável, já como admin dela. Só o dono da plataforma
// (app_metadata.is_super_admin === true) pode chamar.
//
// Tudo ou nada: se qualquer etapa depois de criar a organização falhar, as
// etapas anteriores são desfeitas (conta convidada removida, organização
// removida) — nunca fica assessoria sem professor ou professor sem vínculo.

const ALLOWED_ORIGINS = [
  'https://arbo.mxos.com.br',
  'https://arbo-weld.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido.' })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'Não autorizado.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://arbo.mxos.com.br').replace(/\/$/, '')

  const userClient = createClient(supabaseUrl, anonKey)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'Não autorizado.' })

  // Só app_metadata (escrito pelo servidor) — nunca user_metadata.
  if (user.app_metadata?.is_super_admin !== true) {
    return json(403, { error: 'Acesso restrito ao dono da plataforma.' })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Corpo da requisição inválido.' })
  }

  const parsed = validateCreateOrganizationInput(body)
  if (!parsed.ok) return json(400, { error: 'Dados inválidos.', fields: parsed.errors })
  const input = parsed.value

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // 1. Organização
  const { data: org, error: orgError } = await adminClient
    .from('organizations')
    .insert({
      name: input.name,
      slug: input.slug,
      brand_name: input.name,
      primary_color: input.primaryColor,
      coach_display_name: input.coachDisplayName,
    })
    .select('id, name, slug, brand_name, primary_color, coach_display_name, logo_url, created_at')
    .single()

  if (orgError || !org) {
    if (orgError?.code === '23505') {
      return json(409, { error: 'Esse slug já está em uso. Escolha outro link.', fields: { slug: 'Slug já em uso.' } })
    }
    console.error('Erro ao criar organização:', orgError?.message)
    return json(500, { error: 'Erro ao criar a assessoria.' })
  }

  const rollbackOrg = async () => {
    const { error } = await adminClient.from('organizations').delete().eq('id', org.id)
    if (error) console.error('Rollback da organização falhou:', error.message)
  }

  // 2. Convite do professor. E-mail já cadastrado NÃO é movido de assessoria
  // (pode ser aluno/professor de outro box) — desfaz e avisa.
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(input.adminEmail, {
    redirectTo: `${siteUrl}/set-password`,
  })

  if (inviteError || !inviteData?.user) {
    await rollbackOrg()
    const msg = inviteError?.message ?? ''
    if (msg.includes('already been registered') || msg === 'User already registered') {
      return json(409, {
        error: 'Esse e-mail já tem conta no Arbo. Use outro e-mail para o professor da nova assessoria.',
        fields: { adminEmail: 'E-mail já cadastrado.' },
      })
    }
    console.error('Erro ao convidar professor:', msg)
    return json(500, { error: 'Erro ao enviar o convite do professor.' })
  }

  const invitedId = inviteData.user.id
  const rollbackAll = async () => {
    const { error } = await adminClient.auth.admin.deleteUser(invitedId)
    if (error) console.error('Rollback da conta convidada falhou:', error.message)
    await rollbackOrg()
  }

  // 3. Claims no servidor (role + organização) — o trigger set_user_role criou
  // a conta como aluno da organização padrão.
  const { error: metaError } = await adminClient.auth.admin.updateUserById(invitedId, {
    app_metadata: { role: 'admin', org_id: org.id },
  })

  // 4. Perfil (service_role passa pelos triggers de proteção de role/org).
  const { error: profileError } = metaError
    ? { error: null }
    : await adminClient.from('profiles').update({ role: 'admin', organization_id: org.id }).eq('id', invitedId)

  if (metaError || profileError) {
    console.error('Erro ao vincular professor:', metaError?.message ?? profileError?.message)
    await rollbackAll()
    return json(500, { error: 'Erro ao vincular o professor à assessoria. Nada foi criado.' })
  }

  // 5. Log do convite (não desfaz o onboarding se só o log falhar).
  const { error: logError } = await adminClient.from('invites').insert({
    email: input.adminEmail,
    role: 'admin',
    status: 'sent',
    invited_by: user.id,
    organization_id: org.id,
  })
  if (logError) console.error('Erro ao gravar log do convite:', logError.message)

  return json(200, {
    organization: org,
    studentAccessUrl: `${siteUrl}/a/${org.slug}`,
  })
})
