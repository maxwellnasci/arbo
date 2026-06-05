import { useState, useMemo, useEffect } from 'react'
import { useAdminTreinos } from '../../hooks/useAdminTreinos'
import { useTreinoMutations } from '../../hooks/useTreinoMutations'
import { TreinoCard } from '../../components/admin/TreinoCard'
import { TreinoFormPanel } from '../../components/admin/TreinoFormPanel'
import type { TrainingWithTag } from '../../hooks/useAdminTreinos'
import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { Tag } from '../../lib/types'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'

type TrainingInsert = Database['public']['Tables']['trainings']['Insert']

const listContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

export function AdminTreinos() {
  const { treinos, loading, error, refetch } = useAdminTreinos()
  const { createTraining, updateTraining, deleteTraining } = useTreinoMutations()
  const [tags, setTags] = useState<Tag[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [treinoToEdit, setTreinoToEdit] = useState<TrainingWithTag | null>(null)

  useEffect(() => {
    supabase.from('tags').select('*').then(({ data }) => {
      if (data) setTags(data)
    })
  }, [])

  const filteredTreinos = useMemo(() => {
    if (!searchTerm.trim()) return treinos
    return treinos.filter(t =>
      t.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [treinos, searchTerm])

  const handleEdit = (treino: TrainingWithTag) => {
    setTreinoToEdit(treino)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este treino?')) return
    try {
      await deleteTraining(id)
      toast.success('Treino excluído com sucesso')
      refetch()
    } catch {
      toast.error('Erro ao excluir treino')
    }
  }

  const handleClosePanel = () => {
    setIsFormOpen(false)
    setTreinoToEdit(null)
  }

  const handleSubmit = async (data: Omit<TrainingInsert, 'created_by'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      if (treinoToEdit) {
        await updateTraining({ id: treinoToEdit.id, ...data })
        toast.success('Treino atualizado com sucesso')
      } else {
        await createTraining({ ...data, created_by: user.id })
        toast.success('Treino criado com sucesso')
      }
      refetch()
      handleClosePanel()
    } catch (e: unknown) {
      console.error('Erro ao salvar treino:', e)
      toast.error('Erro ao salvar o treino')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--heading)', margin: 0 }}>Treinos</h1>
        <button
          onClick={() => { setTreinoToEdit(null); setIsFormOpen(true) }}
          style={{
            background: 'var(--orange)',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '13px',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >
          + Novo Treino
        </button>
      </div>

      {error && <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</p>}

      <div style={{ position: 'relative', marginBottom: '32px' }}>
        <Search size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: '16px', top: '16px' }} />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar por título..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            padding: '14px 16px 14px 44px',
            borderRadius: '12px',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={e => e.target.style.borderColor = 'var(--orange)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
        />
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
      ) : filteredTreinos.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: '16px',
            padding: '48px 32px',
            textAlign: 'center',
            border: '1px solid var(--border-default)',
          }}
        >
          <p style={{ color: 'var(--text-secondary)' }}>
            {searchTerm
              ? 'Nenhum treino encontrado para esta busca.'
              : 'Nenhum treino cadastrado ainda. Crie o primeiro!'}
          </p>
        </div>
      ) : (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
          {filteredTreinos.map(treino => (
            <TreinoCard
              key={treino.id}
              treino={treino}
              onClickEdit={() => handleEdit(treino)}
              onClickDelete={() => handleDelete(treino.id)}
            />
          ))}
        </motion.div>
      )}

      <TreinoFormPanel
        isOpen={isFormOpen}
        treinoToEdit={treinoToEdit}
        onSubmit={handleSubmit}
        onClose={handleClosePanel}
        tags={tags}
      />
    </div>
  )
}

export default AdminTreinos
