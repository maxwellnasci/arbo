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
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  }
}

// GET → status da conexão (nunca retorna access_token/refresh_token ao cliente)
// DELETE → remove a conexão (desconectar)
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'DELETE') {
    return new Response('Método não permitido', { status: 405, headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Não autorizado', { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, anonKey)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)

  if (authError || !user) {
    return new Response(`Não autorizado: ${authError?.message ?? 'Usuário não encontrado'}`, {
      status: 401,
      headers: corsHeaders,
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  if (req.method === 'DELETE') {
    const { error: deleteError } = await adminClient
      .from('strava_connections')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Erro ao desconectar do Strava:', deleteError.message)
      return new Response('Erro ao desconectar do Strava.', { status: 500, headers: corsHeaders })
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const { data: connection, error: connError } = await adminClient
    .from('strava_connections')
    .select('strava_athlete_id, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (connError) {
    console.error('Erro ao verificar conexão Strava:', connError.message)
    return new Response('Erro ao verificar conexão com o Strava.', { status: 500, headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      isConnected: !!connection,
      athleteId: connection?.strava_athlete_id ?? null,
      connectedAt: connection?.created_at ?? null,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
