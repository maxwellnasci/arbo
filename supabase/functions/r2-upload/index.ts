import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'

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

const ALLOWED_CONTENT_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

// Remove acentos/caracteres especiais preservando a extensão — a chave do objeto
// no R2 vira parte de uma URL pública, então precisa ser um path seguro.
function sanitizeFilename(name: string): string {
  const lastDot = name.lastIndexOf('.')
  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  const ext = lastDot > 0 ? name.slice(lastDot) : ''
  const safeBase = base.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]/g, '_').slice(0, 80)
  const safeExt = ext.replace(/[^\w.]/g, '').slice(0, 10)
  return `${safeBase || 'video'}${safeExt}`
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
    return new Response('Acesso negado. Apenas professores podem enviar vídeos.', {
      status: 403,
      headers: corsHeaders,
    })
  }

  let body: { trainingId?: string; filename?: string; contentType?: string; fileSize?: number }
  try {
    body = await req.json()
  } catch {
    return new Response('Corpo da requisição inválido.', { status: 400, headers: corsHeaders })
  }

  const trainingId = body.trainingId?.trim()
  const filename = body.filename?.trim()
  const contentType = body.contentType?.trim()
  const fileSize = body.fileSize

  if (!trainingId || !filename || !contentType || typeof fileSize !== 'number') {
    return new Response('trainingId, filename, contentType e fileSize são obrigatórios.', {
      status: 400,
      headers: corsHeaders,
    })
  }

  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return new Response('Tipo de arquivo não permitido. Use MP4, WebM ou MOV.', { status: 400, headers: corsHeaders })
  }

  if (fileSize > MAX_FILE_SIZE) {
    return new Response('Arquivo excede o limite de 500MB.', { status: 413, headers: corsHeaders })
  }

  // trainingId sanitizado também — evita path traversal caso venha manipulado
  // (ex: "../../outro-bucket-path") já que ele vira parte literal da key no R2.
  const safeTrainingId = trainingId.replace(/[^\w-]/g, '')
  const safeFilename = sanitizeFilename(filename)
  const key = `videos/${safeTrainingId}/${safeFilename}`

  // Presigned URL (S3 SigV4 via aws4fetch) em vez de proxiar os bytes do vídeo
  // por esta function: Edge Functions têm limites de memória/tempo de execução
  // incompatíveis com arquivos de até 500MB. O browser faz o PUT direto pro R2
  // usando esta URL assinada — as credenciais nunca saem do servidor.
  const aws = new AwsClient({
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${r2AccountId}.r2.cloudflarestorage.com/${r2BucketName}/${key}`

  const signedRequest = await aws.sign(objectUrl, {
    method: 'PUT',
    aws: { signQuery: true },
    headers: { 'content-type': contentType },
  })

  const publicBase = r2PublicUrl.replace(/\/$/, '')

  return new Response(
    JSON.stringify({
      uploadUrl: signedRequest.url,
      publicUrl: `${publicBase}/${key}`,
      key,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
