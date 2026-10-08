// Validação do cadastro de assessoria (Painel Super Admin). Puro, sem APIs do
// Deno — usado pela Edge Function create-organization e pela tela
// AdminSuperClientes (mesmas regras dos dois lados) e testado no Vitest.
// As regras espelham os CHECKs de public.organizations.

export type CreateOrganizationInput = {
  name: string
  slug: string
  primaryColor: string
  adminEmail: string
  coachDisplayName: string | null
}

export type InputErrors = Partial<Record<keyof CreateOrganizationInput, string>>

// Mesmo CHECK de organizations.slug: minúsculas, números e hífen, sem hífen
// nas pontas, até 50 caracteres.
export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/
const HEX_RE = /^#[0-9a-fA-F]{6}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// "Alpha Cross São Paulo!" → "alpha-cross-sao-paulo"
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function validateCreateOrganizationInput(body: unknown):
  | { ok: true; value: CreateOrganizationInput }
  | { ok: false; errors: InputErrors } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const name = str(b.name)
  const slug = str(b.slug).toLowerCase()
  const primaryColor = str(b.primaryColor)
  const adminEmail = str(b.adminEmail).toLowerCase()
  const coach = str(b.coachDisplayName)

  const errors: InputErrors = {}
  if (!name) errors.name = 'Informe o nome da assessoria.'
  else if (name.length > 120) errors.name = 'Nome muito longo (máx. 120 caracteres).'

  if (!slug) errors.slug = 'Informe o slug do link.'
  else if (!SLUG_RE.test(slug)) errors.slug = 'Use só letras minúsculas, números e hífen (sem hífen no começo/fim).'

  if (!HEX_RE.test(primaryColor)) errors.primaryColor = 'Use uma cor no formato #RRGGBB.'

  if (!EMAIL_RE.test(adminEmail) || adminEmail.length > 254) errors.adminEmail = 'Informe um e-mail válido.'

  if (coach.length > 80) errors.coachDisplayName = 'Nome do treinador muito longo (máx. 80 caracteres).'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: { name, slug, primaryColor: primaryColor.toUpperCase(), adminEmail, coachDisplayName: coach || null },
  }
}
