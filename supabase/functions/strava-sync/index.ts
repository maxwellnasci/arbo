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

type StravaActivity = {
  id: number
  name: string
  type: string
  distance: number
  moving_time: number
  start_date: string
}

type StravaRefreshResponse = {
  access_token: string
  refresh_token: string
  expires_at: number
}

function paceSecondsPerKm(distanceMeters: number, movingTimeSeconds: number): number | null {
  if (distanceMeters <= 0) return null
  return Math.round(movingTimeSeconds / (distanceMeters / 1000))
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

  // Filtra explicitamente por user.id mesmo usando service_role (que ignora RLS)
  // — nunca confiar apenas no bypass de RLS para isolar dados entre alunos.
  const { data: connection, error: connError } = await adminClient
    .from('strava_connections')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (connError) {
    console.error('Erro ao buscar conexão Strava:', connError.message)
    return new Response('Erro ao buscar conexão com o Strava.', { status: 500, headers: corsHeaders })
  }

  if (!connection) {
    return new Response('Nenhuma conexão com o Strava encontrada.', { status: 404, headers: corsHeaders })
  }

  let accessToken = connection.access_token
  const expiresAtMs = new Date(connection.token_expires_at).getTime()

  if (expiresAtMs <= Date.now()) {
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!refreshRes.ok) {
      const text = await refreshRes.text()
      console.error('Erro ao renovar token do Strava:', text)
      return new Response('Falha ao renovar autenticação com o Strava. Reconecte sua conta.', {
        status: 502,
        headers: corsHeaders,
      })
    }

    const refreshData = await refreshRes.json() as StravaRefreshResponse
    accessToken = refreshData.access_token

    const { error: updateError } = await adminClient
      .from('strava_connections')
      .update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        token_expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Erro ao atualizar token renovado:', updateError.message)
    }
  }

  const activitiesRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!activitiesRes.ok) {
    const text = await activitiesRes.text()
    console.error('Erro ao buscar atividades do Strava:', text)
    return new Response('Falha ao buscar atividades do Strava.', { status: 502, headers: corsHeaders })
  }

  const rawActivities = await activitiesRes.json() as StravaActivity[]
  const runs = rawActivities.filter((a) => a.type === 'Run').slice(0, 10)

  if (runs.length > 0) {
    const rows = runs.map((a) => ({
      user_id: user.id,
      strava_id: a.id,
      name: a.name,
      type: a.type,
      distance_m: Math.round(a.distance),
      duration_seconds: a.moving_time,
      pace_seconds_per_km: paceSecondsPerKm(a.distance, a.moving_time),
      start_date: a.start_date,
      raw: a,
    }))

    const { error: upsertError } = await adminClient
      .from('strava_activities')
      .upsert(rows, { onConflict: 'strava_id' })

    if (upsertError) {
      console.error('Erro ao salvar atividades do Strava:', upsertError.message)
    }
  }

  const activities = runs.map((a) => ({
    id: a.id,
    name: a.name,
    distanceKm: Number((a.distance / 1000).toFixed(2)),
    paceSecondsPerKm: paceSecondsPerKm(a.distance, a.moving_time),
    date: a.start_date,
  }))

  return new Response(
    JSON.stringify({ activities }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
