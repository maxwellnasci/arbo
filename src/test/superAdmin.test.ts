import { describe, it, expect } from 'vitest'
import { buildWelcomeWhatsappMessage, isSuperAdminUser, studentAccessUrl } from '../lib/superAdmin'

describe('isSuperAdminUser', () => {
  it('só app_metadata.is_super_admin === true (booleano) vale', () => {
    expect(isSuperAdminUser({ app_metadata: { is_super_admin: true } })).toBe(true)
    expect(isSuperAdminUser({ app_metadata: { is_super_admin: 'true' } })).toBe(false)
    expect(isSuperAdminUser({ app_metadata: {} })).toBe(false)
    expect(isSuperAdminUser(null)).toBe(false)
  })

  it('ignora user_metadata (editável pelo próprio usuário)', () => {
    const user = { app_metadata: { role: 'admin' }, user_metadata: { is_super_admin: true } }
    expect(isSuperAdminUser(user)).toBe(false)
  })
})

describe('studentAccessUrl', () => {
  it('monta o link /a/:slug sem barra dupla', () => {
    expect(studentAccessUrl('https://arbo.mxos.com.br', 'alpha-cross')).toBe('https://arbo.mxos.com.br/a/alpha-cross')
    expect(studentAccessUrl('https://arbo.mxos.com.br/', 'x')).toBe('https://arbo.mxos.com.br/a/x')
  })
})

describe('buildWelcomeWhatsappMessage', () => {
  const base = {
    organizationName: 'Alpha Cross',
    coachName: 'Coach Carlos',
    adminEmail: 'coach@exemplo.com',
    studentUrl: 'https://arbo.mxos.com.br/a/alpha-cross',
  }

  it('cumprimenta pelo nome e traz e-mail, passos e link dos alunos', () => {
    const msg = buildWelcomeWhatsappMessage(base)
    expect(msg.startsWith('Olá, Coach Carlos!')).toBe(true)
    expect(msg).toContain('A Alpha Cross já está no Arbo!')
    expect(msg).toContain('coach@exemplo.com')
    expect(msg).toContain('Minha Assessoria')
    expect(msg).toContain(base.studentUrl)
  })

  it('sem nome do treinador usa cumprimento neutro', () => {
    expect(buildWelcomeWhatsappMessage({ ...base, coachName: null }).startsWith('Olá! 👋')).toBe(true)
  })
})
