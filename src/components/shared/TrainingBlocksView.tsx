import { Footprints, Dumbbell, Timer, Coffee } from 'lucide-react'
import { useTrainingBlocks } from '../../hooks/useTrainingBlocks'
import {
  MODALITY_LABELS,
  WOD_FORMAT_LABELS,
  blockTitle,
  describeBlockTarget,
  formatSeconds,
  hasBlocksModality,
  type BlockType,
  type Modality,
  type WodFormat,
} from '../../lib/modalities'
import styles from './TrainingBlocksView.module.css'

type TrainingLike = {
  id: string
  modality?: string | null
  wod_format?: string | null
  time_cap_seconds?: number | null
}

const BLOCK_ICONS: Record<BlockType, typeof Footprints> = {
  run: Footprints,
  station: Dumbbell,
  wod: Dumbbell,
  rest: Coffee,
}

// Estações do Hyrox / blocos do WOD. Treino de corrida (ou sem modality, dado
// antigo) não renderiza nada e não faz requisição — card igual ao de sempre.
export function TrainingBlocksView({ training }: { training: TrainingLike }) {
  const usesBlocks = hasBlocksModality(training.modality)
  const { blocks, isLoading, error } = useTrainingBlocks(training.id, usesBlocks)

  if (!usesBlocks) return null

  const modality = training.modality as Modality
  const wodFormat = training.wod_format as WodFormat | null

  return (
    <section className={styles.wrapper} aria-label={`Blocos do treino de ${MODALITY_LABELS[modality]}`}>
      <div className={styles.header}>
        <span className={`${styles.badge} ${modality === 'hyrox' ? styles.badgeHyrox : styles.badgeCrossfit}`}>
          {MODALITY_LABELS[modality]}
        </span>
        {wodFormat && <span className={styles.meta}>{WOD_FORMAT_LABELS[wodFormat]}</span>}
        {training.time_cap_seconds && (
          <span className={styles.meta}>
            <Timer size={12} aria-hidden="true" /> cap {formatSeconds(training.time_cap_seconds)}
          </span>
        )}
      </div>

      {isLoading && <p className={styles.muted}>Carregando blocos...</p>}
      {error && <p className={styles.muted}>Não foi possível carregar os blocos.</p>}
      {!isLoading && !error && blocks.length === 0 && (
        <p className={styles.muted}>Nenhum bloco cadastrado ainda.</p>
      )}

      <ol className={styles.list}>
        {blocks.map((block, index) => {
          const Icon = BLOCK_ICONS[block.block_type as BlockType] ?? Dumbbell
          const target = describeBlockTarget(block)
          return (
            <li key={block.id} className={`${styles.item} ${block.block_type === 'run' ? styles.itemRun : ''}`}>
              <span className={styles.index}>{index + 1}</span>
              <Icon size={16} className={styles.icon} aria-hidden="true" />
              <div className={styles.body}>
                <span className={styles.name}>{blockTitle(block, block.exercises?.name)}</span>
                {target && <span className={styles.target}>{target}</span>}
                {block.notes && <span className={styles.notes}>{block.notes}</span>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
