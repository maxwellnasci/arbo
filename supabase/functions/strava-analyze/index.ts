import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildUserPrompt,
  extractRawMetrics,
  firstName,
  parseCoachFeedback,
  type ActivityRow,
  type PlannedTraining,
  type RecentRun,
} from './coach.ts'

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
  const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')

  const userClient = createClient(supabaseUrl, anonKey)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)

  if (authError || !user) {
    return new Response(`Não autorizado: ${authError?.message ?? 'Usuário não encontrado'}`, {
      status: 401,
      headers: corsHeaders,
    })
  }

  // Só o id da atividade vem do cliente — métricas, nome e contexto são lidos do
  // banco. A v1 confiava em distância/tempo/pace enviados no body, o que deixava
  // o aluno gerar (e gravar) análise de uma corrida inventada.
  // `activity.id` continua aceito para compatibilidade com o frontend antigo.
  let body: { activityId?: unknown; activity?: { id?: unknown } }
  try {
    body = await req.json()
  } catch {
    return new Response('Corpo da requisição inválido.', { status: 400, headers: corsHeaders })
  }

  const activityId = body.activityId ?? body.activity?.id
  if (typeof activityId !== 'number' || !Number.isSafeInteger(activityId) || activityId <= 0) {
    return new Response('Campo "activityId" ausente ou inválido.', { status: 400, headers: corsHeaders })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // service_role ignora RLS — filtro explícito por user_id para nunca analisar
  // atividade de outro aluno.
  const { data: activity, error: activityError } = await adminClient
    .from('strava_activities')
    .select('name, distance_m, duration_seconds, pace_seconds_per_km, start_date, raw')
    .eq('user_id', user.id)
    .eq('strava_id', activityId)
    .maybeSingle<ActivityRow>()

  if (activityError) {
    console.error('Erro ao buscar atividade:', activityError.message)
    return new Response('Erro ao buscar atividade.', { status: 500, headers: corsHeaders })
  }
  if (!activity) {
    return new Response('Atividade não encontrada. Sincronize o Strava e tente novamente.', {
      status: 404,
      headers: corsHeaders,
    })
  }

  // UNIQUE(student_id, activity_id) — no máximo uma análise por corrida. Análises
  // de versão anterior do prompt são regeneradas (só acontece para a atividade
  // pedida, ou seja, no máximo uma chamada extra por aluno).
  const { data: existing, error: existingError } = await adminClient
    .from('strava_analysis')
    .select('summary, analysis, tip, message, highlight, next_step, prompt_version')
    .eq('student_id', user.id)
    .eq('activity_id', activityId)
    .maybeSingle()

  if (existingError) {
    console.error('Erro ao buscar análise existente:', existingError.message)
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  if (existing && (existing.prompt_version ?? 1) >= PROMPT_VERSION) {
    return new Response(JSON.stringify(existing), { status: 200, headers: jsonHeaders })
  }

  // Sem DeepSeek disponível, uma análise antiga ainda é melhor que erro.
  const fallback = () =>
    existing
      ? new Response(JSON.stringify(existing), { status: 200, headers: jsonHeaders })
      : null

  if (!deepseekApiKey) {
    console.error('DEEPSEEK_API_KEY não configurada nos Secrets do Supabase.')
    return fallback() ?? new Response('Serviço de análise não configurado.', { status: 500, headers: corsHeaders })
  }

  // Contexto do aluno — falhas aqui não impedem a análise, só a deixam menos rica.
  // Dados de saúde da anamnese (limitações, FC máxima, peso) ficam de fora de
  // propósito: só o necessário para o tom da mensagem vai para a API externa.
  const [profileRes, anamnesisRes, checkinRes, recentRes] = await Promise.all([
    adminClient.from('profiles').select('full_name, level').eq('id', user.id).maybeSingle(),
    adminClient
      .from('anamnesis')
      .select('objectives, experience_years')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('checkins')
      .select('perceived_effort, trainings(title, type, distance_m, target_pace_seconds_per_km)')
      .eq('student_id', user.id)
      .eq('strava_activity_id', activityId)
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('strava_activities')
      .select('distance_m, pace_seconds_per_km')
      .eq('user_id', user.id)
      .eq('type', 'Run')
      .lt('start_date', activity.start_date)
      .order('start_date', { ascending: false })
      .limit(5),
  ])

  for (const [label, res] of [
    ['profiles', profileRes],
    ['anamnesis', anamnesisRes],
    ['checkins', checkinRes],
    ['histórico', recentRes],
  ] as const) {
    if (res.error) console.error(`Erro ao buscar contexto (${label}):`, res.error.message)
  }

  // JOIN N:1 (checkins → trainings) volta como objeto, não array.
  const checkin = checkinRes.data as
    | { perceived_effort: number | null; trainings: Omit<PlannedTraining, 'perceived_effort'> | null }
    | null
  const planned: PlannedTraining | null = checkin?.trainings
    ? { ...checkin.trainings, perceived_effort: checkin.perceived_effort }
    : null

  const userPrompt = buildUserPrompt(
    activity,
    {
      firstName: firstName(profileRes.data?.full_name),
      level: profileRes.data?.level ?? null,
      objectives: anamnesisRes.data?.objectives ?? null,
      experienceYears: anamnesisRes.data?.experience_years ?? null,
    },
    planned,
    (recentRes.data ?? []) as RecentRun[],
  )

  const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 600,
      temperature: 0.8,
    }),
  })

  if (!deepseekRes.ok) {
    console.error('Erro ao chamar DeepSeek:', await deepseekRes.text())
    return fallback() ?? new Response('Erro ao gerar análise da atividade.', { status: 502, headers: corsHeaders })
  }

  const deepseekData = await deepseekRes.json()
  const rawContent: string | undefined = deepseekData?.choices?.[0]?.message?.content

  const feedback = rawContent ? parseCoachFeedback(rawContent) : null
  if (!feedback) {
    console.error('Resposta inválida do DeepSeek:', rawContent ?? JSON.stringify(deepseekData))
    return fallback() ?? new Response('Não foi possível interpretar a análise gerada.', { status: 502, headers: corsHeaders })
  }

  const metrics = extractRawMetrics(activity.raw)
  const averageSpeed = metrics.averageSpeedMs
    ?? (activity.duration_seconds > 0 ? activity.distance_m / activity.duration_seconds : 0)

  // analysis/tip (NOT NULL, formato v1) continuam preenchidos com message/next_step
  // para o frontend antigo seguir funcionando durante a transição.
  const row = {
    summary: feedback.summary,
    analysis: feedback.message,
    tip: feedback.next_step,
    message: feedback.message,
    highlight: feedback.highlight,
    next_step: feedback.next_step,
    prompt_version: PROMPT_VERSION,
  }

  const { error: upsertError } = await adminClient
    .from('strava_analysis')
    .upsert(
      {
        student_id: user.id,
        activity_id: activityId,
        activity_name: activity.name,
        distance_m: activity.distance_m,
        moving_time_seconds: activity.duration_seconds,
        average_speed: averageSpeed,
        ...row,
      },
      { onConflict: 'student_id,activity_id' },
    )

  if (upsertError) {
    console.error('Erro ao salvar análise Strava:', upsertError.message)
    // Não falha a resposta ao usuário por causa disso — a análise já foi gerada.
  }

  return new Response(JSON.stringify(row), { status: 200, headers: jsonHeaders })
})
