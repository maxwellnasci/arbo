import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Exclusão definitiva de uma assessoria (Painel Super Admin). Só o dono da
// plataforma (app_metadata.is_super_admin === true).
//
// 1. Confere o nome digitado (confirmação forte, também validada aqui).
// 2. public.delete_organization_cascade (uma transação, só service_role):
//    dados de treino/turma/check-ins, contas dos usuários da org e a org.
//    Bloqueia a Arbo (padrão/vitrine) e org que tenha super admin.
// 3. Só depois do banco: remove a pasta {orgId}/ do bucket brand-assets
//    (falha aqui só deixa arquivo órfão — não desfaz a exclusão).
// Pendente: vídeos do R2 em videos/{orgId}/ continuam no bucket.

const ALLOWED_ORIGINS = [
  'https://arbo.mxos.com.br',
  'https://arbo-weld.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const DEFAULT_ORG_ID = '00000000-0000-4000-a000-000000000001'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  const userClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return json(401, { error: 'Não autorizado.' })
  if (user.app_metadata?.is_super_admin !== true) {
    return json(403, { error: 'Acesso restrito ao dono da plataforma.' })
  }

  let body: { organizationId?: unknown; confirmName?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Corpo da requisição inválido.' })
  }

  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : ''
  const confirmName = typeof body.confirmName === 'string' ? body.confirmName.trim() : ''
  if (!UUID_RE.test(organizationId)) return json(400, { error: 'organizationId inválido.' })
  if (organizationId === DEFAULT_ORG_ID) {
    return json(403, { error: 'A organização padrão Arbo Run não pode ser excluída.' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: org, error: orgError } = await adminClient
    .from('organizations')
    .select('id, name, slug')
    .eq('id', organizationId)
    .maybeSingle()

  if (orgError) {
    console.error('Erro ao buscar organização:', orgError.message)
    return json(500, { error: 'Erro ao buscar a assessoria.' })
  }
  if (!org) return json(404, { error: 'Assessoria não encontrada.' })
  if (org.slug === 'arbo') return json(403, { error: 'A organização padrão Arbo Run não pode ser excluída.' })
  if (confirmName !== org.name.trim()) {
    return json(400, { error: 'O nome digitado não confere com o nome da assessoria.' })
  }

  const { data: result, error: deleteError } = await adminClient.rpc('delete_organization_cascade', {
    p_org_id: organizationId,
  })
  if (deleteError) {
    console.error('Erro ao excluir organização:', deleteError.message)
    return json(500, { error: 'Erro ao excluir a assessoria. Nada foi apagado.' })
  }

  // Arquivos de marca (logo) — melhor esforço, depois do banco.
  let filesRemoved = 0
  const { data: files, error: listError } = await adminClient.storage.from('brand-assets').list(organizationId, { limit: 1000 })
  if (listError) {
    console.error('Erro ao listar arquivos de marca:', listError.message)
  } else if (files && files.length > 0) {
    const paths = files.map((f) => `${organizationId}/${f.name}`)
    const { error: removeError } = await adminClient.storage.from('brand-assets').remove(paths)
    if (removeError) console.error('Erro ao remover arquivos de marca:', removeError.message)
    else filesRemoved = paths.length
  }

  return json(200, { deleted: result, brandFilesRemoved: filesRemoved })
})
