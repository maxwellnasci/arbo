import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Método não permitido', { status: 405, headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Não autorizado', { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'

  // Valida o JWT do chamador com a anon key
  const userClient = createClient(supabaseUrl, anonKey)

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)

  if (authError || !user) {
    console.error('Auth Error:', authError)
    return new Response(`Não autorizado: ${authError?.message || 'Usuário não encontrado'}`, { status: 401, headers: corsHeaders })
  }

  // Role SEMPRE de app_metadata — nunca de user_metadata
  if (user.app_metadata?.role !== 'admin') {
    return new Response('Acesso negado. Apenas professores podem convidar alunos.', {
      status: 403,
      headers: corsHeaders,
    })
  }

  let email: string
  let role: 'aluno' | 'admin' = 'aluno'
  let redirectTo = `${siteUrl}/set-password`

  const allowedRedirectHosts = new Set([
    'arbo.mxos.com.br',
    'arbo-weld.vercel.app',
    new URL(siteUrl).hostname,
  ])

  try {
    const body = await req.json()
    email = body?.email?.trim()
    if (body?.role === 'admin' || body?.role === 'aluno') {
      role = body.role
    }
    if (body?.redirectTo) {
      try {
        const u = new URL(body.redirectTo)
        if (
          (u.protocol === 'https:' || u.protocol === 'http:') &&
          allowedRedirectHosts.has(u.hostname) &&
          u.pathname === '/set-password'
        ) {
          redirectTo = u.toString()
        }
      } catch { /* URL inválida — mantém o redirectTo padrão */ }
    }
  } catch {
    return new Response('Corpo da requisição inválido.', { status: 400, headers: corsHeaders })
  }

  if (!email || !email.includes('@')) {
    return new Response('Email inválido.', { status: 400, headers: corsHeaders })
  }

  // Assessoria de quem convida — app_metadata é escrito só pelo servidor.
  const orgId = typeof user.app_metadata?.org_id === 'string' ? user.app_metadata.org_id : null
  if (!orgId) {
    return new Response('Professor sem assessoria vinculada.', { status: 403, headers: corsHeaders })
  }

  // Envia o convite com service_role — nunca exposto ao frontend
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // A role NÃO vai mais em user_metadata (editável pelo usuário): o trigger
  // set_user_role cria toda conta como 'aluno' e a promoção/vínculo com a
  // assessoria é feito logo abaixo pelo servidor.
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  })

  if (!inviteError && inviteData?.user) {
    const invitedId = inviteData.user.id

    const { error: metaError } = await adminClient.auth.admin.updateUserById(invitedId, {
      app_metadata: { role, org_id: orgId },
    })
    // service_role passa pelos triggers de proteção de role/organization_id;
    // trg_sync_org_claim mantém app_metadata.org_id em dia.
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ role, organization_id: orgId })
      .eq('id', invitedId)

    if (metaError || profileError) {
      console.error('Erro ao vincular convidado:', metaError?.message ?? profileError?.message)
      return new Response('Convite enviado, mas falhou ao vincular a conta à assessoria.', {
        status: 500,
        headers: corsHeaders,
      })
    }
  }

  if (inviteError) {
    if (inviteError.message.includes('already been registered') || inviteError.message === 'User already registered') {
      // Fallback: se já existe, manda um e-mail de "recuperação de senha" que serve como re-convite
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (resetError) {
        console.error('Erro no fallback de re-convite (reset password):', resetError.message)
        return new Response(`Erro ao reenviar convite: ${resetError.message}`, { status: 500, headers: corsHeaders })
      }
      // Se deu certo o re-envio, a execução segue normalmente para salvar o log na tabela invites
    } else {
      console.error('Erro ao convidar:', inviteError.message)
      return new Response(`Erro ao enviar convite: ${inviteError.message}`, { status: 500, headers: corsHeaders })
    }
  }

  const { error: insertError } = await adminClient.from('invites').insert({
    email,
    role,
    status: 'sent',
    invited_by: user.id,
    organization_id: orgId,
  })

  if (insertError) {
    console.error('Erro ao salvar no log de convites:', insertError.message)
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
