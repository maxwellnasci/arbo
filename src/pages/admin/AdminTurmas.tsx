import { useAdminTurmas, type GroupWithCount } from '../../hooks/useAdminTurmas'

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
  const { turmas, isLoading, error } = useAdminTurmas()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Turmas</h1>
        <button
          disabled
          title="Em breve"
          style={{
            background: '#E8521A',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 600,
            opacity: 0.4,
            cursor: 'not-allowed',
          }}
        >
          + Nova Turma
        </button>
      </div>

      {error && <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : turmas.length === 0 ? (
        <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#555' }}>Nenhuma turma cadastrada ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {turmas.map((turma: GroupWithCount) => (
            <TurmaRow key={turma.id} turma={turma} />
          ))}
        </div>
      )}
    </div>
  )
}

function TurmaRow({ turma }: { turma: GroupWithCount }) {
  return (
    <div
      style={{
        background: '#1c1c1e',
        borderRadius: '10px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid #2a2a2a',
        gap: '12px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {turma.name}
        </p>
        <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
          {goalLabel[turma.goal] ?? turma.goal}
          {' · '}
          {frequencyLabel[turma.frequency] ?? turma.frequency}
          {' · '}
          {planTypeLabel[turma.plan_type] ?? turma.plan_type}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <span style={{ color: '#aaa', fontSize: '12px' }}>
          {turma.studentCount} {turma.studentCount === 1 ? 'aluno' : 'alunos'}
        </span>
        <span
          style={{
            color: turma.is_active ? '#4caf50' : '#555',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <span aria-hidden="true">●</span>{' '}{turma.is_active ? 'Ativa' : 'Inativa'}
        </span>
      </div>
    </div>
  )
}
