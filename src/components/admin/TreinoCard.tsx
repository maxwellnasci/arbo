import type { TrainingWithTag } from '../../hooks/useAdminTreinos'
import { motion } from 'framer-motion'

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
  corrida: 'var(--orange)',
  hiit: 'var(--red-accent)',
  recovery: 'var(--green-accent)',
  forca: 'var(--blue-accent)',
  mobilidade: 'var(--purple-accent)',
}

const typeBgColor: Record<string, string> = {
  corrida: 'var(--orange-subtle)',
  hiit: 'var(--red-subtle)',
  recovery: 'var(--green-subtle)',
  forca: 'var(--blue-subtle)',
  mobilidade: 'var(--purple-subtle)',
}

const typeBorderColor: Record<string, string> = {
  corrida: 'var(--orange-border)',
  hiit: 'var(--red-border)',
  recovery: 'var(--green-border)',
  forca: 'var(--blue-border)',
  mobilidade: 'var(--purple-border)',
}

const listItem = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1 }
}

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return '—'
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = secondsPerKm % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}/km`
}

// Helper formatting function
function formatDistance(meters: number | null): string {
  if (!meters) return '—'
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

export function TreinoCard({ treino, onClickEdit, onClickDelete }: TreinoCardProps) {
  const color = typeColor[treino.type] ?? 'var(--text-secondary)'
  const bgColor = typeBgColor[treino.type] ?? 'var(--bg-surface-hover)'
  const borderColor = typeBorderColor[treino.type] ?? 'var(--border-default)'
  const label = typeLabel[treino.type] ?? treino.type

  return (
    <motion.div
      variants={listItem}
      style={{
        background: 'var(--bg-surface)',
        borderRadius: '16px',
        border: '1px solid var(--border-default)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        transition: 'all 0.2s ease-out',
        cursor: 'default'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-surface-hover)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-surface)';
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Pills: tipo + etiqueta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            background: bgColor,
            color,
            borderRadius: '20px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            border: `1px solid ${borderColor}`
          }}
        >
          {label}
        </span>
        {treino.tag && (
          <span
            style={{
              background: treino.tag.color + '1a',
              color: treino.tag.color,
              borderRadius: '20px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              border: `1px solid ${treino.tag.color}33`
            }}
          >
            {treino.tag.name}
          </span>
        )}
      </div>

      {/* Título e descrição */}
      <div>
        <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, margin: '0 0 4px', lineHeight: 1.3 }}>
          {treino.title}
        </p>
        {treino.description && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '12px',
              margin: 0,
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
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '16px',
          marginTop: 'auto'
        }}
      >
        {onClickEdit && (
          <button
            onClick={onClickEdit}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              transition: 'color 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
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
              color: 'var(--red-accent)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              transition: 'opacity 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.7'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            Excluir
          </button>
        )}
      </div>
    </motion.div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-input)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--border-default)' }}>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '10px', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
        {label}
      </p>
      <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700, margin: 0 }}>{value}</p>
    </div>
  )
}
