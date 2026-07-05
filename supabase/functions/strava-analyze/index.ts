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

type ActivityInput = {
  id: number
  name: string
  distanceKm: number
  paceSecondsPerKm: number | null
  durationSeconds: number
  date: string
}

type StravaAnalysis = {
  summary: string
  analysis: string
  tip: string
}

const SYSTEM_PROMPT = `Você é um coach de corrida experiente e motivador.
Analise os dados de corrida do atleta e responda SEMPRE em português brasileiro.
Responda APENAS em formato JSON com exatamente 3 campos:
{
  "summary": "resumo objetivo da atividade em 1 frase (distância, pace, tempo)",
  "analysis": "análise do desempenho em 2-3 frases (pontos positivos e o que melhorar)",
  "tip": "uma dica prática e motivadora para o próximo treino em 1 frase"
}
Seja direto, motivador e use linguagem simples. Não use markdown dentro do JSON.`

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return '--:--'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// DeepSeek às vezes envolve o JSON em ```json ... ``` mesmo quando instruído a
// não usar markdown — remove o fence antes de parsear.
function parseAnalysisJson(raw: string): StravaAnalysis | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed.summary === 'string' && typeof parsed.analysis === 'string' && typeof parsed.tip === 'string') {
      return { summary: parsed.summary, analysis: parsed.analysis, tip: parsed.tip }
    }
    return null
  } catch {
    return null
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

  let body: { activity?: ActivityInput }
  try {
    body = await req.json()
  } catch {
    return new Response('Corpo da requisição inválido.', { status: 400, headers: corsHeaders })
  }

  const activity = body.activity
  if (
    !activity ||
    typeof activity.id !== 'number' ||
    typeof activity.name !== 'string' ||
    typeof activity.distanceKm !== 'number' ||
    typeof activity.durationSeconds !== 'number'
  ) {
    return new Response('Campo "activity" ausente ou inválido.', { status: 400, headers: corsHeaders })
  }

  const distanceM = Math.round(activity.distanceKm * 1000)
  const movingTimeSeconds = Math.round(activity.durationSeconds)
  const paceSecondsPerKm = activity.paceSecondsPerKm ?? (distanceM > 0 ? Math.round(movingTimeSeconds / (distanceM / 1000)) : null)
  const averageSpeed = movingTimeSeconds > 0 ? distanceM / movingTimeSeconds : 0 // m/s

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Evita rechamar a API do DeepSeek para uma atividade já analisada —
  // UNIQUE(student_id, activity_id) garante no máximo uma análise por corrida.
  const { data: existing, error: existingError } = await adminClient
    .from('strava_analysis')
    .select('summary, analysis, tip')
    .eq('student_id', user.id)
    .eq('activity_id', activity.id)
    .maybeSingle()

  if (existingError) {
    console.error('Erro ao buscar análise existente:', existingError.message)
  }

  if (existing) {
    return new Response(JSON.stringify(existing), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!deepseekApiKey) {
    console.error('DEEPSEEK_API_KEY não configurada nos Secrets do Supabase.')
    return new Response('Serviço de análise não configurado.', { status: 500, headers: corsHeaders })
  }

  const userPrompt = `Analise esta atividade de corrida:
Nome: ${activity.name}
Distância: ${activity.distanceKm.toFixed(2)} km
Tempo: ${formatTime(movingTimeSeconds)}
Pace médio: ${formatPace(paceSecondsPerKm)} min/km
Velocidade média: ${(averageSpeed * 3.6).toFixed(1)} km/h`

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
      max_tokens: 300,
      temperature: 0.7,
    }),
  })

  if (!deepseekRes.ok) {
    const text = await deepseekRes.text()
    console.error('Erro ao chamar DeepSeek:', text)
    return new Response('Erro ao gerar análise da atividade.', { status: 502, headers: corsHeaders })
  }

  const deepseekData = await deepseekRes.json()
  const rawContent: string | undefined = deepseekData?.choices?.[0]?.message?.content

  if (!rawContent) {
    console.error('Resposta do DeepSeek sem conteúdo:', JSON.stringify(deepseekData))
    return new Response('Resposta inválida do serviço de análise.', { status: 502, headers: corsHeaders })
  }

  const parsed = parseAnalysisJson(rawContent)
  if (!parsed) {
    console.error('Falha ao interpretar JSON do DeepSeek:', rawContent)
    return new Response('Não foi possível interpretar a análise gerada.', { status: 502, headers: corsHeaders })
  }

  const { error: upsertError } = await adminClient
    .from('strava_analysis')
    .upsert(
      {
        student_id: user.id,
        activity_id: activity.id,
        activity_name: activity.name,
        distance_m: distanceM,
        moving_time_seconds: movingTimeSeconds,
        average_speed: averageSpeed,
        summary: parsed.summary,
        analysis: parsed.analysis,
        tip: parsed.tip,
      },
      { onConflict: 'student_id,activity_id' },
    )

  if (upsertError) {
    console.error('Erro ao salvar análise Strava:', upsertError.message)
    // Não falha a resposta ao usuário por causa disso — a análise já foi gerada.
  }

  return new Response(
    JSON.stringify(parsed),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
