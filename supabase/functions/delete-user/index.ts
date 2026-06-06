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

  const userClient = createClient(supabaseUrl, anonKey)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)

  if (authError || !user) {
    return new Response(`Não autorizado: ${authError?.message ?? 'Usuário não encontrado'}`, {
      status: 401,
      headers: corsHeaders,
    })
  }

  if (user.app_metadata?.role !== 'admin') {
    return new Response('Acesso negado. Apenas professores podem excluir alunos.', {
      status: 403,
      headers: corsHeaders,
    })
  }

  let userId: string
  try {
    const body = await req.json()
    userId = body?.userId?.trim()
  } catch {
    return new Response('Corpo da requisição inválido.', { status: 400, headers: corsHeaders })
  }

  if (!userId) {
    return new Response('userId é obrigatório.', { status: 400, headers: corsHeaders })
  }

  if (userId === user.id) {
    return new Response('Não é possível excluir sua própria conta.', { status: 400, headers: corsHeaders })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

  if (deleteError) {
    console.error('Erro ao excluir usuário:', deleteError.message)
    return new Response(`Erro ao excluir aluno: ${deleteError.message}`, { status: 500, headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
