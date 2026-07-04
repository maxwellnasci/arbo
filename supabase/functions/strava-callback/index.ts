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

type StravaTokenResponse = {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete: { id: number }
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
  const stravaClientId = Deno.env.get('STRAVA_CLIENT_ID')!
  const stravaClientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')!

  // Valida o JWT do chamador com a anon key — é o único jeito de saber
  // a qual aluno esta conexão pertence.
  const userClient = createClient(supabaseUrl, anonKey)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)

  if (authError || !user) {
    return new Response(`Não autorizado: ${authError?.message ?? 'Usuário não encontrado'}`, {
      status: 401,
      headers: corsHeaders,
    })
  }

  let code: string
  try {
    const body = await req.json()
    code = body?.code?.trim()
  } catch {
    return new Response('Corpo da requisição inválido.', { status: 400, headers: corsHeaders })
  }

  if (!code) {
    return new Response('code é obrigatório.', { status: 400, headers: corsHeaders })
  }

  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    console.error('Erro ao trocar code por token no Strava:', text)
    return new Response('Falha ao autenticar com o Strava.', { status: 502, headers: corsHeaders })
  }

  const tokenData = await tokenRes.json() as StravaTokenResponse

  // service_role — strava_connections não tem GRANT para authenticated,
  // é a única forma de gravar a conexão (contém access_token/refresh_token).
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { error: upsertError } = await adminClient
    .from('strava_connections')
    .upsert(
      {
        user_id: user.id,
        strava_athlete_id: tokenData.athlete.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
        scope: 'activity:read_all',
      },
      { onConflict: 'user_id' },
    )

  if (upsertError) {
    console.error('Erro ao salvar conexão Strava:', upsertError.message)
    return new Response('Erro ao salvar conexão com o Strava.', { status: 500, headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
