import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { TrainingBlocksEditor } from '../components/admin/TrainingBlocksEditor'
import type { BlockDraft, Exercise, Modality } from '../lib/modalities'

const HYROX = ['SkiErg', 'Sled Push', 'Sled Pull', 'Burpee Broad Jump', 'Rowing', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls']

const exercises: Exercise[] = [
  ...HYROX.map((name, i) => ({
    id: `hx-${i}`, name, modality: 'hyrox', metric: name === 'Wall Balls' ? 'reps' : 'distance',
    default_distance_m: name === 'Wall Balls' ? null : 100, default_reps: name === 'Wall Balls' ? 100 : null,
    sort_order: i + 1, organization_id: null, created_at: '',
  })),
  { id: 'cf-pullup', name: 'Pull-up', modality: 'crossfit', metric: 'reps', default_distance_m: null, default_reps: 15, sort_order: 10, organization_id: null, created_at: '' },
]

// tsconfig usa lib ES2020 (sem Array.prototype.at)
function lastCall(fn: ReturnType<typeof vi.fn>): BlockDraft[] {
  return fn.mock.calls[fn.mock.calls.length - 1][0]
}

function Harness({ modality, onBlocks }: { modality: Modality; onBlocks?: (b: BlockDraft[]) => void }) {
  const [blocks, setBlocks] = useState<BlockDraft[]>([])
  return (
    <TrainingBlocksEditor
      modality={modality}
      blocks={blocks}
      exercises={exercises}
      onChange={next => { setBlocks(next); onBlocks?.(next) }}
    />
  )
}

describe('TrainingBlocksEditor', () => {
  it('monta o Hyrox oficial com 16 blocos (8 corridas + 8 estações)', () => {
    const onBlocks = vi.fn()
    render(<Harness modality="hyrox" onBlocks={onBlocks} />)
    fireEvent.click(screen.getByRole('button', { name: /Montar Hyrox oficial/ }))
    const blocks: BlockDraft[] = lastCall(onBlocks)
    expect(blocks).toHaveLength(16)
    expect(blocks.filter(b => b.block_type === 'run')).toHaveLength(8)
    expect(blocks[1].exercise_id).toBe('hx-0') // SkiErg depois da 1ª corrida
    expect(blocks[15].reps).toBe(100) // Wall Balls por último
    // o atalho some quando já existem blocos
    expect(screen.queryByRole('button', { name: /Montar Hyrox oficial/ })).toBeNull()
  })

  it('adiciona, move e remove blocos no CrossFit', () => {
    const onBlocks = vi.fn()
    render(<Harness modality="crossfit" onBlocks={onBlocks} />)
    expect(screen.queryByRole('button', { name: /Montar Hyrox oficial/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Exercício/ }))
    fireEvent.click(screen.getByRole('button', { name: /Descanso/ }))
    let blocks: BlockDraft[] = lastCall(onBlocks)
    expect(blocks.map(b => b.block_type)).toEqual(['wod', 'rest'])

    fireEvent.click(screen.getAllByRole('button', { name: 'Descer bloco' })[0])
    blocks = lastCall(onBlocks)
    expect(blocks.map(b => b.block_type)).toEqual(['rest', 'wod'])

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover bloco' })[0])
    blocks = lastCall(onBlocks)
    expect(blocks.map(b => b.block_type)).toEqual(['wod'])
  })

  it('escolher o exercício aplica a meta padrão quando o bloco está vazio', () => {
    const onBlocks = vi.fn()
    render(<Harness modality="crossfit" onBlocks={onBlocks} />)
    fireEvent.click(screen.getByRole('button', { name: /Exercício/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Exercício' }), { target: { value: 'cf-pullup' } })
    const blocks: BlockDraft[] = lastCall(onBlocks)
    expect(blocks[0].exercise_id).toBe('cf-pullup')
    expect(blocks[0].reps).toBe(15)
  })
})
