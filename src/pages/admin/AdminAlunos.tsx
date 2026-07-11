import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAlunos } from '../../hooks/useAdminAlunos'
import type { Profile } from '../../lib/types'
import { motion } from 'framer-motion'
import { ChevronRight, Search, Filter } from 'lucide-react'
import { ListSkeleton } from '../../components/ui/ListSkeleton'

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
      if (group === 'null') return !aluno.group_id
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
        <h1 style={{ fontFamily: 'var(--heading)', margin: 0 }}>Alunos</h1>
        <button
          onClick={() => navigate('/admin/convites')}
          style={{ background: 'var(--orange)', color: 'var(--text-on-brand)', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
        >
          + Convidar
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: '16px', top: '16px' }} />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              padding: '14px 16px 14px 44px',
              borderRadius: '12px',
              outline: 'none',
              width: '100%',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--orange)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
          />
        </div>
        <div style={{ position: 'relative', flex: '1 1 150px' }}>
          <Filter size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: '16px', top: '16px' }} />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              padding: '14px 16px 14px 44px',
              borderRadius: '12px',
              outline: 'none',
              width: '100%',
              fontSize: '14px',
              cursor: 'pointer',
              appearance: 'none',
              boxSizing: 'border-box'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--orange)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
          >
            <option value="all">Todos os alunos</option>
            <option value="group:null">Sem Turma</option>
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
      </div>

      {error && <p style={{ color: 'var(--red-accent)', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? <ListSkeleton /> : alunos.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border-default)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum aluno ainda. Convide o primeiro!</p>
        </div>
      ) : filteredAlunos.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border-default)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum aluno encontrado para os filtros selecionados.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' as const }}
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          {filteredAlunos.map((aluno: Profile) => (
            <AlunoRow key={aluno.id} aluno={aluno} levelLabel={levelLabel} />
          ))}
        </motion.div>
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
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'var(--bg-surface)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        border: '1px solid var(--border-default)',
        cursor: 'pointer',
        fontFamily: 'inherit',
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
      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 700, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {aluno.full_name ?? 'Novo Aluno (sem nome)'}
          {!aluno.group_id && (
            <span style={{ background: 'var(--red-accent)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
              Sem Turma
            </span>
          )}
        </p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', margin: 0, fontWeight: 500 }}>
          {aluno.level ? levelLabel[aluno.level] ?? aluno.level : 'Nível não definido'}
        </p>
      </div>
      <ChevronRight size={18} color="var(--text-tertiary)" />
    </button>
  )
}
