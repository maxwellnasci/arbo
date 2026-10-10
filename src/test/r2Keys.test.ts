import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ORG_ID,
  buildVideoKey,
  canDeleteVideoKey,
  isOrganizationVideoKey,
  organizationVideoPrefix,
  parseListObjectsV2,
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

describe('limpeza de vídeos ao excluir assessoria', () => {
  it('prefixo é a pasta da org, nunca a da Arbo nem id inválido', () => {
    expect(organizationVideoPrefix(BOX)).toBe(`videos/${BOX}/`)
    expect(organizationVideoPrefix(BOX.toUpperCase())).toBe(`videos/${BOX}/`)
    expect(organizationVideoPrefix(ARBO)).toBeNull()
    expect(organizationVideoPrefix('')).toBeNull()
    expect(organizationVideoPrefix('../videos')).toBeNull()
  })

  it('só apaga chave dentro da pasta da org excluída', () => {
    expect(isOrganizationVideoKey(`videos/${BOX}/${TRAINING}/aula.mp4`, BOX)).toBe(true)
    expect(isOrganizationVideoKey(`videos/${ARBO}/${TRAINING}/aula.mp4`, BOX)).toBe(false)
    expect(isOrganizationVideoKey(`videos/${TRAINING}/aula.mp4`, BOX)).toBe(false)
    expect(isOrganizationVideoKey(`videos/${BOX}x/${TRAINING}/aula.mp4`, BOX)).toBe(false)
    expect(isOrganizationVideoKey(`videos/${BOX}/../${TRAINING}/aula.mp4`, BOX)).toBe(false)
    expect(isOrganizationVideoKey(`videos/${ARBO}/${TRAINING}/aula.mp4`, ARBO)).toBe(false)
  })

  it('lê a listagem ListObjectsV2 com paginação e entidades XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>arbo-videos</Name><Prefix>videos/${BOX}/</Prefix><KeyCount>2</KeyCount>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>abc&amp;123</NextContinuationToken>
  <Contents><Key>videos/${BOX}/${TRAINING}/a.mp4</Key><Size>10</Size></Contents>
  <Contents><Key>videos/${BOX}/${TRAINING}/b&amp;c.webm</Key><Size>20</Size></Contents>
</ListBucketResult>`
    expect(parseListObjectsV2(xml)).toEqual({
      keys: [`videos/${BOX}/${TRAINING}/a.mp4`, `videos/${BOX}/${TRAINING}/b&c.webm`],
      isTruncated: true,
      nextContinuationToken: 'abc&123',
    })
  })

  it('listagem vazia / última página', () => {
    const xml = '<ListBucketResult><KeyCount>0</KeyCount><IsTruncated>false</IsTruncated></ListBucketResult>'
    expect(parseListObjectsV2(xml)).toEqual({ keys: [], isTruncated: false, nextContinuationToken: null })
  })
})
