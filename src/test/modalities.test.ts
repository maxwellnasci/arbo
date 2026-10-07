import { describe, it, expect } from 'vitest'
import {
  blockDraftsToPayload,
  blockTitle,
  describeBlockTarget,
  emptyBlock,
  formatSeconds,
  hasBlocksModality,
  isModality,
  officialHyroxBlocks,
  parseTimeInput,
} from '../lib/modalities'

describe('modalidades', () => {
  it('reconhece modalidades e quais usam blocos', () => {
    expect(isModality('hyrox')).toBe(true)
    expect(isModality('natação')).toBe(false)
    expect(hasBlocksModality('corrida')).toBe(false)
    expect(hasBlocksModality('crossfit')).toBe(true)
    expect(hasBlocksModality(null)).toBe(false)
  })
})

describe('tempo', () => {
  it('formata segundos', () => {
    expect(formatSeconds(270)).toBe('4:30')
    expect(formatSeconds(3735)).toBe('1:02:15')
    expect(formatSeconds(null)).toBe('')
  })

  it('lê m:ss, h:mm:ss e segundos', () => {
    expect(parseTimeInput('4:30')).toBe(270)
    expect(parseTimeInput('1:02:15')).toBe(3735)
    expect(parseTimeInput('90')).toBe(90)
    expect(parseTimeInput(' ')).toBeNull()
    expect(parseTimeInput('4:75')).toBeNull()
    expect(parseTimeInput('abc')).toBeNull()
    expect(parseTimeInput('1:2:3:4')).toBeNull()
  })
})

describe('blocos', () => {
  const stations = [
    { id: 'wall', default_distance_m: null, default_reps: 100, sort_order: 8 },
    { id: 'ski', default_distance_m: 1000, default_reps: null, sort_order: 1 },
  ]

  it('monta o Hyrox oficial: corrida de 1 km + estação, na ordem da prova', () => {
    const blocks = officialHyroxBlocks(stations)
    expect(blocks.map(b => [b.block_type, b.exercise_id, b.distance_m, b.reps])).toEqual([
      ['run', null, 1000, null],
      ['station', 'ski', 1000, null],
      ['run', null, 1000, null],
      ['station', 'wall', null, 100],
    ])
    expect(new Set(blocks.map(b => b.key)).size).toBe(4)
  })

  it('gera o payload da RPC: só valores positivos, sem exercício em corrida/descanso', () => {
    const run = { ...emptyBlock('run'), exercise_id: 'x', distance_m: 0 }
    const station = { ...emptyBlock('station', stations[1]), id: 'b1', load_kg: 20, notes: '  forte  ' }
    expect(blockDraftsToPayload([run, station])).toEqual([
      { block_type: 'run', exercise_id: null, distance_m: null, reps: null, load_kg: null, duration_seconds: null, target_pace_seconds_per_km: null, rounds: null, notes: null },
      { id: 'b1', block_type: 'station', exercise_id: 'ski', distance_m: 1000, reps: null, load_kg: 20, duration_seconds: null, target_pace_seconds_per_km: null, rounds: null, notes: 'forte' },
    ])
  })

  it('descreve a meta e o título do bloco', () => {
    expect(describeBlockTarget({ distance_m: 1000, reps: null, load_kg: null, duration_seconds: null, rounds: null, target_pace_seconds_per_km: 300 }))
      .toBe('1 km · pace 5:00/km')
    expect(describeBlockTarget({ distance_m: null, reps: 21, load_kg: 43, duration_seconds: null, rounds: 3, target_pace_seconds_per_km: null }))
      .toBe('3× · 21 reps · 43 kg')
    expect(blockTitle({ block_type: 'run' }, null)).toBe('Corrida')
    expect(blockTitle({ block_type: 'station' }, 'SkiErg')).toBe('SkiErg')
    expect(blockTitle({ block_type: 'wod' }, null)).toBe('Exercício')
  })
})
