import { describe, it, expect } from 'vitest'
import { brandInitials } from '../lib/brandInitials'

describe('brandInitials', () => {
  it('usa a inicial das duas primeiras palavras', () => {
    expect(brandInitials('Run Club')).toBe('RC')
    expect(brandInitials('CrossFit Nitro')).toBe('CN')
    expect(brandInitials('Alpha Cross São Paulo')).toBe('AC')
  })

  it('palavra única vira as duas primeiras letras', () => {
    expect(brandInitials('Alpha')).toBe('AL')
    expect(brandInitials('x')).toBe('X')
  })

  it('ignora conectivos e símbolos', () => {
    expect(brandInitials('Box da Vila')).toBe('BV')
    expect(brandInitials('Corrida & Cia')).toBe('CC')
    expect(brandInitials('  -- Team!!  Hyrox -- ')).toBe('TH')
    expect(brandInitials('de')).toBe('DE')
  })

  it('mantém acentos e números em maiúsculas', () => {
    expect(brandInitials('équipe ágil')).toBe('ÉÁ')
    expect(brandInitials('42 Runners')).toBe('4R')
  })

  it('nome vazio ou sem letras nunca quebra', () => {
    expect(brandInitials('')).toBe('?')
    expect(brandInitials('   ')).toBe('?')
    expect(brandInitials('!!!')).toBe('?')
    expect(brandInitials(null)).toBe('?')
  })

  it('nunca passa de 2 caracteres', () => {
    for (const name of ['Run Club Elite Team', 'Supercalifragilístico', 'A B C D']) {
      expect(Array.from(brandInitials(name)).length).toBeLessThanOrEqual(2)
    }
  })
})
