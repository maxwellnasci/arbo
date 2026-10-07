import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ORG_ID,
  buildVideoKey,
  canDeleteVideoKey,
  sanitizeFilename,
} from '../../supabase/functions/_shared/r2Keys'

const ARBO = DEFAULT_ORG_ID
const BOX = '11111111-2222-4333-8444-555555555555'
const TRAINING = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('buildVideoKey', () => {
  it('coloca o vídeo na pasta da organização', () => {
    expect(buildVideoKey(BOX, TRAINING, 'Aquecimento Ágil.mp4')).toBe(`videos/${BOX}/${TRAINING}/Aquecimento_Agil.mp4`)
  })

  it('sanitiza trainingId e nome (path traversal)', () => {
    expect(buildVideoKey(BOX, '../../outro', '../x.mp4')).toBe(`videos/${BOX}/outro/___x.mp4`)
    expect(sanitizeFilename('meu vídeo!!.MOV')).toBe('meu_video__.MOV')
  })
})

describe('canDeleteVideoKey', () => {
  it('permite apagar vídeos da própria organização', () => {
    expect(canDeleteVideoKey(`videos/${BOX}/${TRAINING}/a.mp4`, BOX)).toBe(true)
  })

  it('bloqueia vídeos de outra organização', () => {
    expect(canDeleteVideoKey(`videos/${ARBO}/${TRAINING}/a.mp4`, BOX)).toBe(false)
    expect(canDeleteVideoKey(`videos/${BOX}/${TRAINING}/a.mp4`, ARBO)).toBe(false)
  })

  it('chave legada (anterior ao multi-tenant) só para a Arbo', () => {
    expect(canDeleteVideoKey(`videos/${TRAINING}/a.mp4`, ARBO)).toBe(true)
    expect(canDeleteVideoKey(`videos/${TRAINING}/a.mp4`, BOX)).toBe(false)
  })

  it('recusa chaves fora de videos/, com .. ou segmentos vazios', () => {
    expect(canDeleteVideoKey(`outra/${BOX}/x/a.mp4`, BOX)).toBe(false)
    expect(canDeleteVideoKey(`videos/${BOX}/../a.mp4`, BOX)).toBe(false)
    expect(canDeleteVideoKey(`videos//${TRAINING}/a.mp4`, ARBO)).toBe(false)
    expect(canDeleteVideoKey(`videos/${BOX}/x/y/a.mp4`, BOX)).toBe(false)
    expect(canDeleteVideoKey(`videos/${BOX}/x/a.mp4`, 'nao-e-uuid')).toBe(false)
  })
})
