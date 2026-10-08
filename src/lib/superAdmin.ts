// Painel Super Admin (dono da plataforma): helpers puros e testáveis.

export type ManagedOrganization = {
  id: string
  name: string
  slug: string
  brand_name: string | null
  primary_color: string
  coach_display_name: string | null
  logo_url: string | null
  created_at: string
}

export const MANAGED_ORGANIZATION_COLUMNS =
  'id, name, slug, brand_name, primary_color, coach_display_name, logo_url, created_at'

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
