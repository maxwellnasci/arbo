import { useNavigate } from 'react-router-dom'
import { useAdminAlunos } from '../../hooks/useAdminAlunos'
import type { Profile } from '../../lib/types'

export default function AdminAlunos() {
  const { alunos, isLoading, error } = useAdminAlunos()
  const navigate = useNavigate()

  const levelLabel: Record<string, string> = {
    iniciante: 'Iniciante',
    intermediario: 'Intermediário',
    avancado: 'Avançado',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Alunos</h1>
        <button
          onClick={() => navigate('/admin/convites')}
          style={{ background: '#E8521A', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          + Convidar
        </button>
      </div>

      {error && <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : alunos.length === 0 ? (
        <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#555' }}>Nenhum aluno ainda. Convide o primeiro!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alunos.map((aluno: Profile) => (
            <AlunoRow key={aluno.id} aluno={aluno} levelLabel={levelLabel} />
          ))}
        </div>
      )}
    </div>
  )
}

function AlunoRow({ aluno, levelLabel }: { aluno: Profile; levelLabel: Record<string, string> }) {
  const initials = (aluno.full_name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <div style={{ background: '#1c1c1e', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #2a2a2a' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#fff', fontSize: '14px', fontWeight: 600, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {aluno.full_name ?? '(sem nome)'}
        </p>
        <p style={{ color: '#555', fontSize: '12px', margin: 0 }}>
          {aluno.level ? levelLabel[aluno.level] ?? aluno.level : 'Nível não definido'}
        </p>
      </div>
    </div>
  )
}
