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

type TrainingInsert = Database['public']['Tables']['trainings']['Insert']

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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Treinos</h1>
        <button
          onClick={() => { setTreinoToEdit(null); setIsFormOpen(true) }}
          style={{
            background: '#E8521A',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          + Novo Treino
        </button>
      </div>

      {error && <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</p>}

      {/* Busca */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <span
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#555',
            fontSize: '14px',
            pointerEvents: 'none',
          }}
        >
          🔍
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar por título..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#1c1c1e',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            padding: '10px 16px 10px 38px',
            color: '#fff',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </div>

      {/* Conteúdo */}
      {loading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : filteredTreinos.length === 0 ? (
        <div
          style={{
            background: '#1c1c1e',
            borderRadius: '12px',
            padding: '48px 32px',
            textAlign: 'center',
            border: '1px solid #2a2a2a',
          }}
        >
          <p style={{ color: '#555' }}>
            {searchTerm
              ? 'Nenhum treino encontrado para esta busca.'
              : 'Nenhum treino cadastrado ainda. Crie o primeiro!'}
          </p>
        </div>
      ) : (
        <div
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
        </div>
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
