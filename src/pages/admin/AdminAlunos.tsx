import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAlunos } from '../../hooks/useAdminAlunos'
import type { Profile } from '../../lib/types'

export default function AdminAlunos() {
  const { alunos, isLoading, error } = useAdminAlunos()
  const navigate = useNavigate()

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  const uniqueGroups = Array.from(new Set(alunos?.map((a: Profile) => a.group_id).filter(Boolean))) as string[];

  const filteredAlunos = (alunos || []).filter((aluno: Profile) => {
    const matchesSearch = (aluno.full_name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false

    if (filterType === 'all') return true
    if (filterType.startsWith('level:')) {
      const level = filterType.split(':')[1]
      return aluno.level === level
    }
    if (filterType.startsWith('group:')) {
      const group = filterType.split(':')[1]
      return String(aluno.group_id) === group
    }
    return true
  })

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

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            background: '#1e1e1e',
            color: '#fff',
            border: '1px solid #2a2a2a',
            padding: '12px 16px',
            borderRadius: '10px',
            outline: 'none',
            flex: '1 1 200px',
            fontSize: '14px'
          }}
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            background: '#1e1e1e',
            color: '#fff',
            border: '1px solid #2a2a2a',
            padding: '12px 16px',
            borderRadius: '10px',
            outline: 'none',
            flex: '1 1 150px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <option value="all">Todos os alunos</option>
          <optgroup label="Por Nível">
            <option value="level:iniciante">Nível: Iniciante</option>
            <option value="level:intermediario">Nível: Intermediário</option>
            <option value="level:avancado">Nível: Avançado</option>
          </optgroup>
          {uniqueGroups.length > 0 && (
            <optgroup label="Por Turma">
              {uniqueGroups.map(gId => (
                <option key={gId} value={`group:${gId}`}>Turma: {gId}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {error && <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : alunos.length === 0 ? (
        <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#555' }}>Nenhum aluno ainda. Convide o primeiro!</p>
        </div>
      ) : filteredAlunos.length === 0 ? (
        <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#555' }}>Nenhum aluno encontrado para os filtros selecionados.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredAlunos.map((aluno: Profile) => (
            <AlunoRow key={aluno.id} aluno={aluno} levelLabel={levelLabel} />
          ))}
        </div>
      )}
    </div>
  )
}

function AlunoRow({ aluno, levelLabel }: { aluno: Profile; levelLabel: Record<string, string> }) {
  const navigate = useNavigate()
  const initials = (aluno.full_name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <button 
      onClick={() => navigate(`/admin/alunos/${aluno.id}`)}
      style={{ width: '100%', textAlign: 'left', background: '#1c1c1e', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #2a2a2a', cursor: 'pointer' }}
    >
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
      <div style={{ color: '#555', fontSize: '16px' }}>›</div>
    </button>
  )
}
