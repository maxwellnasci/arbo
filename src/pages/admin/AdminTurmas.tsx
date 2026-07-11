import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminTurmas, type GroupWithCount } from '../../hooks/useAdminTurmas'
import { CreateGroupModal } from '../../components/admin/CreateGroupModal'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { ListSkeleton } from '../../components/ui/ListSkeleton'

const goalLabel: Record<string, string> = {
  '5k': '5K',
  '10k': '10K',
  '21k': '21K',
  evoluir_10k: 'Evolução 10K',
  evoluir_21k: 'Evolução 21K',
}

const frequencyLabel: Record<string, string> = {
  '2x': '2×/sem',
  '3x': '3×/sem',
}

const planTypeLabel: Record<string, string> = {
  grupo: 'Grupo',
  individual: 'Individual',
}

export default function AdminTurmas() {
  const { turmas, isLoading, error, refetch } = useAdminTurmas()
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--heading)', margin: 0 }}>Turmas</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            background: 'var(--orange)',
            color: 'var(--text-on-brand)',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >
          + Nova Turma
        </button>
      </div>

      {error && <p style={{ color: 'var(--red-accent)', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? <ListSkeleton /> : turmas.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border-default)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Nenhuma turma cadastrada ainda.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' as const }}
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          {turmas.map((turma: GroupWithCount) => (
            <TurmaRow key={turma.id} turma={turma} />
          ))}
        </motion.div>
      )}

      {isModalOpen && (
        <CreateGroupModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function TurmaRow({ turma }: { turma: GroupWithCount }) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/admin/turmas/${turma.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/admin/turmas/${turma.id}`)}
      style={{
        background: 'var(--bg-surface)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid var(--border-default)',
        gap: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease-out'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-surface-hover)';
        e.currentTarget.style.transform = 'scale(0.995)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-surface)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            color: 'var(--text-primary)',
            fontSize: '15px',
            fontWeight: 700,
            margin: '0 0 4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {turma.name}
        </p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', margin: 0, fontWeight: 500 }}>
          {goalLabel[turma.goal] ?? turma.goal}
          {' · '}
          {frequencyLabel[turma.frequency] ?? turma.frequency}
          {' · '}
          {planTypeLabel[turma.plan_type] ?? turma.plan_type}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
          {turma.studentCount} {turma.studentCount === 1 ? 'aluno' : 'alunos'}
        </span>
        <span
          style={{
            color: turma.is_active ? 'var(--green-accent)' : 'var(--text-secondary)',
            background: turma.is_active ? 'rgba(74, 222, 128, 0.1)' : 'var(--text-disabled)',
            border: turma.is_active ? '1px solid rgba(74, 222, 128, 0.2)' : '1px solid var(--text-tertiary)',
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {turma.is_active ? 'Ativa' : 'Inativa'}
        </span>
        <ChevronRight size={18} color="var(--text-tertiary)" />
      </div>
    </div>
  )
}
