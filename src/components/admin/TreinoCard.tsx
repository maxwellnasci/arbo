import type { TrainingWithTag } from '../../hooks/useAdminTreinos'

interface TreinoCardProps {
  treino: TrainingWithTag
  onClickEdit?: () => void
  onClickDelete?: () => void
}

const typeLabel: Record<string, string> = {
  corrida: 'Corrida',
  hiit: 'HIIT',
  recovery: 'Recuperação',
  forca: 'Força',
  mobilidade: 'Mobilidade',
}

const typeColor: Record<string, string> = {
  corrida: '#E8521A',
  hiit: '#EF4444',
  recovery: '#22C55E',
  forca: '#3B82F6',
  mobilidade: '#A855F7',
}

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return '—'
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = secondsPerKm % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}/km`
}

function formatDistance(meters: number | null): string {
  if (!meters) return '—'
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

export function TreinoCard({ treino, onClickEdit, onClickDelete }: TreinoCardProps) {
  const color = typeColor[treino.type] ?? '#888'
  const label = typeLabel[treino.type] ?? treino.type

  return (
    <div
      style={{
        background: '#1c1c1e',
        borderRadius: '12px',
        border: '1px solid #2a2a2a',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Pills: tipo + etiqueta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            background: color + '22',
            color,
            borderRadius: '6px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {treino.tag && (
          <span
            style={{
              background: treino.tag.color + '33',
              color: treino.tag.color,
              borderRadius: '6px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {treino.tag.name}
          </span>
        )}
      </div>

      {/* Título e descrição */}
      <div>
        <p style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
          {treino.title}
        </p>
        {treino.description && (
          <p
            style={{
              color: '#888',
              fontSize: '12px',
              margin: '4px 0 0',
              lineHeight: 1.5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {treino.description}
          </p>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <StatCell label="Distância" value={formatDistance(treino.distance_m)} />
        <StatCell label="Duração" value={treino.duration_minutes ? `${treino.duration_minutes} min` : '—'} />
        <StatCell label="Pace alvo" value={formatPace(treino.target_pace_seconds_per_km)} />
        <StatCell label="Séries" value={treino.sets ? String(treino.sets) : '1'} />
      </div>

      {/* Ações */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '16px',
          borderTop: '1px solid #2a2a2a',
          paddingTop: '12px',
        }}
      >
        {onClickEdit && (
          <button
            onClick={onClickEdit}
            style={{
              background: 'none',
              border: 'none',
              color: '#aaa',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Editar
          </button>
        )}
        {onClickDelete && (
          <button
            onClick={onClickDelete}
            style={{
              background: 'none',
              border: 'none',
              color: '#ff6b6b',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Excluir
          </button>
        )}
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#111', borderRadius: '8px', padding: '10px 12px' }}>
      <p style={{ color: '#555', fontSize: '11px', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </p>
      <p style={{ color: '#fff', fontSize: '13px', fontWeight: 600, margin: 0 }}>{value}</p>
    </div>
  )
}
