// Painel Super Admin (dono da plataforma): helpers puros e testáveis.

export type ManagedOrganization = {
  id: string
  name: string
  slug: string
  brand_name: string | null
  primary_color: string
  secondary_color: string | null
  accent_color: string | null
  coach_display_name: string | null
  ai_tone: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
}

export const MANAGED_ORGANIZATION_COLUMNS =
  'id, name, slug, brand_name, primary_color, secondary_color, accent_color, coach_display_name, ai_tone, logo_url, is_active, created_at'

// Organização padrão (vitrine Arbo Run): nunca pausada nem excluída, slug fixo.
// O banco garante (trg_protect_arbo_default / trg_protect_organization_fields)
// e a Edge Function delete-organization recusa; a tela só esconde as ações.
export const DEFAULT_ORGANIZATION_ID = '00000000-0000-4000-a000-000000000001'
export const DEFAULT_ORGANIZATION_SLUG = 'arbo'

export function isDefaultOrganization(org: { id: string; slug: string }): boolean {
  return org.id === DEFAULT_ORGANIZATION_ID || org.slug === DEFAULT_ORGANIZATION_SLUG
}

// Confirmação forte da exclusão: o nome digitado tem que ser igual ao nome
// cadastrado (espaços nas pontas ignorados; maiúsculas importam).
export function deleteConfirmationMatches(typed: string, organizationName: string): boolean {
  const t = typed.trim()
  return t.length > 0 && t === organizationName.trim()
}

// Super admin vem só de app_metadata (escrito pelo servidor), nunca de
// user_metadata — mesma regra da role.
export function isSuperAdminUser(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.app_metadata?.is_super_admin === true
}

export function studentAccessUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, '')}/a/${slug}`
}

// Mensagem pronta para o Max colar no WhatsApp do professor.
export function buildWelcomeWhatsappMessage(params: {
  organizationName: string
  coachName: string | null
  adminEmail: string
  studentUrl: string
}): string {
  const greeting = params.coachName ? `Olá, ${params.coachName}! 👋` : 'Olá! 👋'
  return [
    greeting,
    '',
    `A ${params.organizationName} já está no Arbo! 🏃‍♂️`,
    '',
    `1️⃣ Acabei de enviar um convite para o seu e-mail (${params.adminEmail}). Abra o e-mail e crie sua senha para acessar o painel do professor.`,
    '',
    '2️⃣ Lá em "Minha Assessoria" você coloca a logo e a cor da sua marca.',
    '',
    '3️⃣ Este é o link para os seus alunos entrarem no app com a cara da sua assessoria:',
    params.studentUrl,
    '',
    'Qualquer dúvida, é só me chamar!',
  ].join('\n')
}
