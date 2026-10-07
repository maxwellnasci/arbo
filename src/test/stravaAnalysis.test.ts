import { describe, it, expect } from 'vitest'
import { toCoachFeedback } from '../lib/stravaAnalysis'

describe('toCoachFeedback', () => {
  it('usa os campos da v2 quando existem', () => {
    expect(
      toCoachFeedback({
        summary: '8 km em 42:00',
        analysis: 'texto antigo',
        tip: 'dica antiga',
        message: 'Ana, mandou bem!',
        highlight: 'Pace estável',
        next_step: 'Descanse amanhã',
        prompt_version: 2,
      }),
    ).toEqual({
      message: 'Ana, mandou bem!',
      highlight: 'Pace estável',
      nextStep: 'Descanse amanhã',
      summary: '8 km em 42:00',
      promptVersion: 2,
    })
  })

  it('cai para analysis/tip em análises v1 (sem colunas novas)', () => {
    expect(
      toCoachFeedback({ summary: 'resumo', analysis: 'análise', tip: 'dica' }),
    ).toEqual({
      message: 'análise',
      highlight: null,
      nextStep: 'dica',
      summary: 'resumo',
      promptVersion: 1,
    })
  })

  it('trata colunas v2 nulas ou em branco como ausentes', () => {
    const feedback = toCoachFeedback({
      summary: 'resumo',
      analysis: 'análise',
      tip: 'dica',
      message: null,
      highlight: '   ',
      next_step: null,
      prompt_version: 1,
    })
    expect(feedback.message).toBe('análise')
    expect(feedback.highlight).toBeNull()
    expect(feedback.nextStep).toBe('dica')
  })
})
