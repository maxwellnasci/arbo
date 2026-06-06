import { useState, useMemo, useEffect } from 'react'
import { useAdminTreinos } from '../../hooks/useAdminTreinos'
import { useTreinoMutations } from '../../hooks/useTreinoMutations'
import { TreinoCard } from '../../components/admin/TreinoCard'
import { TreinoFormPanel } from '../../components/admin/TreinoFormPanel'
import type { TrainingWithTag } from '../../hooks/useAdminTreinos'
import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { Tag, TrainingCustomType } from '../../lib/types'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, Trash2 } from 'lucide-react'

type TrainingInsert = Database['public']['Tables']['trainings']['Insert']

const listContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

export function AdminTreinos() {
  const { treinos, loading, error, refetch } = useAdminTreinos()
  const { createTraining, updateTraining, deleteTraining } = useTreinoMutations()
  const [tags, setTags] = useState<Tag[]>([])
  const [customTypes, setCustomTypes] = useState<TrainingCustomType[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [treinoToEdit, setTreinoToEdit] = useState<TrainingWithTag | null>(null)
  const [isManageOpen, setIsManageOpen] = useState(false)

  useEffect(() => {
    supabase.from('tags').select('*').order('name').then(({ data }) => {
      if (data) setTags(data)
    })
    supabase.from('training_types').select('*').order('name').then(({ data }) => {
      if (data) setCustomTypes(data)
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

  const handleDeleteTag = async (id: string) => {
    if (!window.confirm('Excluir esta etiqueta? Ela será removida de todos os treinos que a utilizam.')) return
    try {
      await supabase.from('tags').delete().eq('id', id)
      setTags(prev => prev.filter(t => t.id !== id))
      toast.success('Etiqueta excluída')
      refetch()
    } catch {
      toast.error('Erro ao excluir etiqueta')
    }
  }

  const handleDeleteType = async (id: string) => {
    if (!window.confirm('Excluir este tipo? Treinos com este tipo poderão ficar sem classificação.')) return
    try {
      await supabase.from('training_types').delete().eq('id', id)
      setCustomTypes(prev => prev.filter(t => t.id !== id))
      toast.success('Tipo excluído')
    } catch {
      toast.error('Erro ao excluir tipo')
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

      <div style={{ marginBottom: '32px' }}>
        <button
          onClick={() => setIsManageOpen(!isManageOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: 0
          }}
        >
          Gerenciar Etiquetas e Tipos
          <ChevronDown size={16} style={{ transform: isManageOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        
        <AnimatePresence>
          {isManageOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px', display: 'flex', gap: '32px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Etiquetas</h3>
                  {tags.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nenhuma etiqueta</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {tags.map(tag => (
                        <div key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: tag.color }}></div>
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{tag.name}</span>
                          </div>
                          <button onClick={() => handleDeleteTag(tag.id)} style={{ background: 'none', border: 'none', color: 'var(--red-accent)', cursor: 'pointer', padding: '4px' }}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ width: '1px', background: 'var(--border-default)' }}></div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipos Personalizados</h3>
                  {customTypes.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nenhum tipo personalizado</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {customTypes.map(ct => (
                        <div key={ct.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{ct.name}</span>
                          <button onClick={() => handleDeleteType(ct.id)} style={{ background: 'none', border: 'none', color: 'var(--red-accent)', cursor: 'pointer', padding: '4px' }}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
        customTypes={customTypes}
        onTagCreated={tag => setTags(prev => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))}
        onTypeCreated={type => setCustomTypes(prev => [...prev, type].sort((a, b) => a.name.localeCompare(b.name)))}
      />
    </div>
  )
}

export default AdminTreinos
