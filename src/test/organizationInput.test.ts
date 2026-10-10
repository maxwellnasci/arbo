import { describe, it, expect } from 'vitest'
import {
  AI_TONE_MAX_LENGTH,
  SLUG_RE,
  slugify,
  validateCreateOrganizationInput,
  validateUpdateOrganizationInput,
} from '../../supabase/functions/_shared/organizationInput'

describe('slugify', () => {
  it('gera slug em minúsculas, sem acento e com hífen', () => {
    expect(slugify('Alpha Cross')).toBe('alpha-cross')
    expect(slugify('  Box São João — Running!! ')).toBe('box-sao-joao-running')
    expect(slugify('RunClub 2026')).toBe('runclub-2026')
  })

  it('sempre produz um slug aceito pelo CHECK do banco (ou vazio)', () => {
    for (const name of ['---', 'Ação & Reação', 'a'.repeat(80), 'X-', 'Çç']) {
      const s = slugify(name)
      expect(s === '' || SLUG_RE.test(s)).toBe(true)
    }
    expect(slugify('a'.repeat(80)).length).toBe(50)
  })
})

describe('validateCreateOrganizationInput', () => {
  const valid = {
    name: '  Alpha Cross ',
    slug: 'Alpha-Cross',
    primaryColor: '#1d4ed8',
    adminEmail: ' Coach@Exemplo.COM ',
    coachDisplayName: '  Coach Carlos ',
  }

  it('aceita e normaliza (trim, slug/e-mail em minúsculas, cor em maiúsculas)', () => {
    expect(validateCreateOrganizationInput(valid)).toEqual({
      ok: true,
      value: {
        name: 'Alpha Cross',
        slug: 'alpha-cross',
        primaryColor: '#1D4ED8',
        adminEmail: 'coach@exemplo.com',
        coachDisplayName: 'Coach Carlos',
      },
    })
  })

  it('treinador vazio vira null', () => {
    const r = validateCreateOrganizationInput({ ...valid, coachDisplayName: '   ' })
    expect(r.ok && r.value.coachDisplayName).toBeNull()
  })

  it('aponta cada campo inválido', () => {
    const r = validateCreateOrganizationInput({
      name: '', slug: '-ruim-', primaryColor: 'red', adminEmail: 'sem-arroba', coachDisplayName: 'x'.repeat(81),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['adminEmail', 'coachDisplayName', 'name', 'primaryColor', 'slug'])
  })

  it('tolera corpo ausente ou com tipos errados', () => {
    expect(validateCreateOrganizationInput(null).ok).toBe(false)
    expect(validateCreateOrganizationInput({ name: 42, slug: ['x'] }).ok).toBe(false)
  })
})

describe('validateUpdateOrganizationInput', () => {
  const base = {
    name: ' Box Azul ', slug: 'Box-Azul', brandName: '', coachDisplayName: '  ',
    primaryColor: '#1d4ed8', secondaryColor: '', accentColor: '#22c55e', aiTone: '',
  }

  it('normaliza e transforma opcionais vazios em null', () => {
    const r = validateUpdateOrganizationInput(base)
    expect(r).toEqual({
      ok: true,
      value: {
        name: 'Box Azul', slug: 'box-azul', brandName: null, coachDisplayName: null,
        primaryColor: '#1D4ED8', secondaryColor: null, accentColor: '#22C55E', aiTone: null,
      },
    })
  })

  it('cor secundária/destaque preenchida tem que ser #RRGGBB; a primária é obrigatória', () => {
    const r = validateUpdateOrganizationInput({ ...base, primaryColor: '', secondaryColor: 'azul', accentColor: '#12345' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(Object.keys(r.errors).sort()).toEqual(['accentColor', 'primaryColor', 'secondaryColor'])
  })

  it('respeita os limites do banco (marca/treinador 80, tom da IA 500, slug)', () => {
    const r = validateUpdateOrganizationInput({
      ...base,
      brandName: 'b'.repeat(81),
      coachDisplayName: 'c'.repeat(81),
      aiTone: 't'.repeat(AI_TONE_MAX_LENGTH + 1),
      slug: '-ruim-',
      name: '',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(Object.keys(r.errors).sort()).toEqual(['aiTone', 'brandName', 'coachDisplayName', 'name', 'slug'])
    expect(validateUpdateOrganizationInput({ ...base, aiTone: 't'.repeat(AI_TONE_MAX_LENGTH) }).ok).toBe(true)
  })

  it('corpo inválido não lança', () => {
    expect(validateUpdateOrganizationInput(null).ok).toBe(false)
    expect(validateUpdateOrganizationInput({ name: 42 }).ok).toBe(false)
  })
})
