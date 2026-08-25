import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'

// Mesma allowlist da r2-upload — nunca '*' (CORS dinâmico por origem validada)
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

// Extrai a key (path dentro do bucket) a partir de uma URL pública do R2.
// Aceita tanto o domínio público (R2_PUBLIC_URL) quanto o endpoint de storage
// da conta (.r2.cloudflarestorage.com) — o chamador envia a URL inteira, nós
// separamos a parte relevante.
//
// Segurança: força prefixo "videos/" — qualquer key fora desse path é rejeitada
// (defesa em profundidade contra path traversal/abuso via keys de outros paths).
function extractKeyFromPublicUrl(publicUrl: string, publicBase: string): string | null {
  try {
    const trimmed = publicBase.replace(/\/$/, '')
    let path: string
    if (publicUrl.startsWith(trimmed + '/')) {
      path = publicUrl.slice(trimmed.length + 1)
    } else {
      // Fallback: parsear como URL absoluta
      const u = new URL(publicUrl)
      path = u.pathname.replace(/^\//, '')
    }
    if (!path.startsWith('videos/')) return null
    return path
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
  const r2AccountId = Deno.env.get('R2_ACCOUNT_ID')!
  const r2AccessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')!
  const r2SecretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')!
  const r2BucketName = Deno.env.get('R2_BUCKET_NAME')!
  const r2PublicUrl = Deno.env.get('R2_PUBLIC_URL')!

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
    return new Response('Acesso negado. Apenas professores podem remover vídeos.', {
      status: 403,
      headers: corsHeaders,
    })
  }

  let body: { publicUrl?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Corpo da requisição inválido.', { status: 400, headers: corsHeaders })
  }

  const publicUrl = body.publicUrl?.trim()
  if (!publicUrl) {
    return new Response('publicUrl é obrigatório.', { status: 400, headers: corsHeaders })
  }

  const key = extractKeyFromPublicUrl(publicUrl, r2PublicUrl)
  if (!key) {
    // Defesa em profundidade: nunca aceitar paths fora de videos/ — rejeita
    // tentativas de manipular keys de outros lugares do bucket.
    return new Response('URL inválida ou fora do bucket autorizado.', {
      status: 400,
      headers: corsHeaders,
    })
  }

  const aws = new AwsClient({
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${r2AccountId}.r2.cloudflarestorage.com/${r2BucketName}/${key}`

  const signedRequest = await aws.sign(objectUrl, {
    method: 'DELETE',
    aws: { signQuery: true },
  })

  const res = await fetch(signedRequest.url, { method: 'DELETE' })

  // Idempotência: 404 (objeto já não existe) é tratado como sucesso — evita
  // loops de erro na UI quando o mesmo vídeo é removido duas vezes ou quando
  // o objeto já tinha sido limpo por outro motivo (migração, manutenção manual).
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    console.error('Erro ao remover objeto do R2:', res.status, text)
    return new Response('Erro ao remover o vídeo do armazenamento.', {
      status: 502,
      headers: corsHeaders,
    })
  }

  return new Response(
    JSON.stringify({ ok: true, key }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})