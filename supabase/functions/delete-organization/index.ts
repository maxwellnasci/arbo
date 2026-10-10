import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { isOrganizationVideoKey, organizationVideoPrefix, parseListObjectsV2 } from '../_shared/r2Keys.ts'

// Exclusão definitiva de uma assessoria (Painel Super Admin). Só o dono da
// plataforma (app_metadata.is_super_admin === true).
//
// 1. Confere o nome digitado (confirmação forte, também validada aqui).
// 2. public.delete_organization_cascade (uma transação, só service_role):
//    dados de treino/turma/check-ins, contas dos usuários da org e a org.
//    Bloqueia a Arbo (padrão/vitrine) e org que tenha super admin.
// 3. Só depois do banco (melhor esforço — falha aqui só deixa arquivo órfão,
//    nunca desfaz a exclusão nem deixa dado apontando para vídeo apagado):
//    - pasta {orgId}/ do bucket brand-assets (logo)
//    - pasta videos/{orgId}/ do R2 (vídeos dos treinos), listada com
//      ListObjectsV2 e apagada objeto a objeto (mesma assinatura SigV4 do
//      r2-delete). Chaves legadas videos/{trainingId}/... são todas da Arbo,
//      que nunca é excluída.

const ALLOWED_ORIGINS = [
  'https://arbo.mxos.com.br',
  'https://arbo-weld.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const DEFAULT_ORG_ID = '00000000-0000-4000-a000-000000000001'
// Teto de segurança para caber no tempo da Edge Function (20 páginas × 1000).
const R2_MAX_PAGES = 20
const R2_DELETE_CONCURRENCY = 8

type VideoCleanup = { removed: number; failed: number; skipped: boolean }

async function removeOrganizationVideos(organizationId: string): Promise<VideoCleanup> {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucket = Deno.env.get('R2_BUCKET_NAME')
  const prefix = organizationVideoPrefix(organizationId)
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !prefix) {
    console.error('Limpeza do R2 pulada: credenciais ausentes ou organização inválida.')
    return { removed: 0, failed: 0, skipped: true }
  }

  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`
  let removed = 0
  let failed = 0
  let token: string | null = null

  for (let page = 0; page < R2_MAX_PAGES; page++) {
    const listUrl = new URL(base)
    listUrl.searchParams.set('list-type', '2')
    listUrl.searchParams.set('prefix', prefix)
    listUrl.searchParams.set('max-keys', '1000')
    if (token) listUrl.searchParams.set('continuation-token', token)

    const listRes = await aws.fetch(listUrl.toString(), { method: 'GET' })
    if (!listRes.ok) {
      console.error('Erro ao listar vídeos no R2:', listRes.status, await listRes.text())
      return { removed, failed: failed + 1, skipped: false }
    }
    const { keys, isTruncated, nextContinuationToken } = parseListObjectsV2(await listRes.text())
    const toDelete = keys.filter((key) => isOrganizationVideoKey(key, organizationId))

    for (let i = 0; i < toDelete.length; i += R2_DELETE_CONCURRENCY) {
      const batch = toDelete.slice(i, i + R2_DELETE_CONCURRENCY)
      const results = await Promise.all(batch.map(async (key) => {
        const objectUrl = `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
        const res = await aws.fetch(objectUrl, { method: 'DELETE' })
        // 404 = já não existe: idempotente, conta como removido.
        if (!res.ok && res.status !== 404) {
          console.error('Erro ao remover vídeo do R2:', key, res.status)
          return false
        }
        return true
      }))
      removed += results.filter(Boolean).length
      failed += results.filter((ok) => !ok).length
    }

    if (!isTruncated || !nextContinuationToken) return { removed, failed, skipped: false }
    token = nextContinuationToken
  }

  console.error(`Limpeza do R2 parou no teto de ${R2_MAX_PAGES} páginas; restam vídeos em ${prefix}`)
  return { removed, failed: failed + 1, skipped: false }
}
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

  // Vídeos dos treinos no R2 — melhor esforço, depois do banco.
  let videos: VideoCleanup = { removed: 0, failed: 0, skipped: true }
  try {
    videos = await removeOrganizationVideos(organizationId)
  } catch (e: unknown) {
    console.error('Erro inesperado na limpeza do R2:', e instanceof Error ? e.message : e)
    videos = { removed: 0, failed: 1, skipped: false }
  }

  return json(200, {
    deleted: result,
    brandFilesRemoved: filesRemoved,
    videosRemoved: videos.removed,
    videosFailed: videos.failed,
    videosSkipped: videos.skipped,
  })
})
