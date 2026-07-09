import { useState, useMemo, useEffect } from 'react'
import { useAdminTreinos } from '../../hooks/useAdminTreinos'
import { useTreinoMutations } from '../../hooks/useTreinoMutations'
import { useTrainingPrograms } from '../../hooks/useTrainingPrograms'
import { TreinoCard } from '../../components/admin/TreinoCard'
import { TreinoFormPanel } from '../../components/admin/TreinoFormPanel'
import { NewProgramModal } from '../../components/admin/NewProgramModal'
import { FilterDropdown } from '../../components/admin/FilterDropdown'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import type { TrainingWithTag } from '../../hooks/useAdminTreinos'
import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { Tag, TrainingCustomType } from '../../lib/types'
import { insertTag, insertTrainingType, PROGRAM_COLOR_VAR_MAP, CATEGORY_OPTIONS, CATEGORY_LABELS } from '../../lib/trainingUtils'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, Trash2 } from 'lucide-react'

type TrainingInsert = Database['public']['Tables']['trainings']['Insert']

export function AdminTreinos() {
  const { treinos, loading, error, refetch } = useAdminTreinos()
  const { createTraining, updateTraining, deleteTraining } = useTreinoMutations()
  const { programs, error: programsError, createProgram, deleteProgram } = useTrainingPrograms()
  const { user } = useAuth()
  const [tags, setTags] = useState<Tag[]>([])
  const [customTypes, setCustomTypes] = useState<TrainingCustomType[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [programFilter, setProgramFilter] = useState<string>('todos')
  const [categoryFilter, setCategoryFilter] = useState<string>('todos')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [treinoToEdit, setTreinoToEdit] = useState<TrainingWithTag | null>(null)
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [isNewProgramModalOpen, setIsNewProgramModalOpen] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    description: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', description: '', onConfirm: () => {} })

  const programsBySlug = useMemo(() => {
    const map = new Map<string, typeof programs[number]>()
    programs.forEach(p => map.set(p.slug, p))
    return map
  }, [programs])

  useEffect(() => {
    if (programsError) toast.error(programsError)
  }, [programsError])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [tagsRes, typesRes] = await Promise.all([
        supabase.from('tags').select('id, name, color, created_at, created_by, updated_at').order('name'),
        supabase.from('training_types').select('id, name, is_custom, created_at, created_by').eq('is_custom', true).order('name'),
      ])
      if (cancelled) return
      if (tagsRes.error) { toast.error('Erro ao carregar etiquetas: ' + tagsRes.error.message); return }
      if (typesRes.error) { toast.error('Erro ao carregar tipos: ' + typesRes.error.message); return }
      if (tagsRes.data) setTags(tagsRes.data)
      if (typesRes.data) setCustomTypes(typesRes.data)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filteredTreinos = useMemo(() => {
    return treinos.filter(t => {
      const matchesSearch = !searchTerm.trim() || t.title.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesProgram = programFilter === 'todos' || t.program === programFilter
      const matchesCategory = categoryFilter === 'todos' || t.category === categoryFilter
      return matchesSearch && matchesProgram && matchesCategory
    })
  }, [treinos, searchTerm, programFilter, categoryFilter])

  const handleEdit = (treino: TrainingWithTag) => {
    setTreinoToEdit(treino)
    setIsFormOpen(true)
  }

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Excluir Treino',
      description: 'Tem certeza que deseja excluir este treino?',
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }))
        try {
          await deleteTraining(id)
          toast.success('Treino excluído com sucesso')
          refetch()
        } catch {
          toast.error('Erro ao excluir treino')
        }
      }
    })
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

  const handleDeleteTag = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Excluir Etiqueta',
      description: 'Excluir esta etiqueta? Ela será removida de todos os treinos que a utilizam.',
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }))
        const { error } = await supabase.from('tags').delete().eq('id', id)
        if (error) { toast.error(error.message); return }
        setTags(prev => prev.filter(t => t.id !== id))
        toast.success('Etiqueta excluída')
      }
    })
  }

  const handleDeleteType = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Excluir Tipo',
      description: 'Excluir este tipo? Treinos com este tipo poderão ficar sem classificação.',
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }))
        const { error } = await supabase.from('training_types').delete().eq('id', id)
        if (error) { toast.error(error.message); return }
        setCustomTypes(prev => prev.filter(t => t.id !== id))
        toast.success('Tipo excluído')
      }
    })
  }

  const handleDeleteProgram = (id: string, slug: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Excluir Biblioteca',
      description: 'Excluir esta biblioteca? Os treinos que pertencem a ela não serão excluídos, apenas deixarão de aparecer no filtro e perderão a etiqueta de biblioteca.',
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }))
        const { error: deleteError } = await deleteProgram(id)
        if (deleteError) { toast.error(deleteError); return }
        if (programFilter === slug) setProgramFilter('todos')
        toast.success('Biblioteca excluída')
      }
    })
  }

  const handleCreateTag = async (name: string, color: string): Promise<Tag | null> => {
    if (!user) { toast.error('Sessão expirada. Recarregue a página.'); return null }
    const { data, error } = await insertTag(user.id, name, color)
    if (error || !data) {
      if (error?.code === '23505') toast.error('Já existe uma etiqueta com esse nome')
      else toast.error(error?.message ?? 'Erro ao criar etiqueta')
      return null
    }
    setTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }

  const handleCreateType = async (name: string): Promise<TrainingCustomType | null> => {
    if (!user) { toast.error('Sessão expirada. Recarregue a página.'); return null }
    const { data, error } = await insertTrainingType(user.id, name)
    if (error || !data) {
      if (error?.code === '23505') toast.error('Já existe um tipo com esse nome')
      else toast.error(error?.message ?? 'Erro ao criar tipo')
      return null
    }
    setCustomTypes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }

  const handleUploadVideo = async (
    file: File,
    trainingId: string,
    onProgress: (percent: number) => void,
  ): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          trainingId,
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Erro ao preparar upload do vídeo.')
      }

      const { uploadUrl, publicUrl } = await res.json()

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error('Falha no upload para o armazenamento.'))
        }
        xhr.onerror = () => reject(new Error('Falha de rede durante o upload.'))
        xhr.send(file)
      })

      return publicUrl as string
    } catch (e: unknown) {
      console.error('Erro ao enviar vídeo:', e)
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar vídeo.')
      return null
    }
  }

  return (
    <div style={{ overflowX: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--heading)', margin: 0 }}>Treinos</h1>
        <button
          onClick={() => { setTreinoToEdit(null); setIsFormOpen(true) }}
          style={{
            background: 'var(--orange)',
            color: 'var(--text-on-brand)',
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

      {error && <p style={{ color: 'var(--red-accent)', marginBottom: '16px' }}>{error}</p>}

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

      <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', flexWrap: 'nowrap', marginBottom: '32px', overflowX: 'auto' }}>
        <FilterDropdown
          idleLabel="Biblioteca de Treinos"
          allOptionLabel="Todas as Bibliotecas"
          selectedKey={programFilter}
          onSelect={setProgramFilter}
          options={programs.map(program => ({
            key: program.slug,
            label: program.name,
            dotColor: PROGRAM_COLOR_VAR_MAP[program.color]?.accent ?? 'var(--text-secondary)',
          }))}
          footer={{ label: '+ Nova Biblioteca', onClick: () => setIsNewProgramModalOpen(true) }}
        />

        <FilterDropdown
          idleLabel="Todas as Categorias"
          allOptionLabel="Todas as Categorias"
          selectedKey={categoryFilter}
          onSelect={setCategoryFilter}
          options={CATEGORY_OPTIONS.map(category => ({ key: category, label: CATEGORY_LABELS[category] }))}
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
          Gerenciar Etiquetas, Tipos e Bibliotecas
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
                <div style={{ width: '1px', background: 'var(--border-default)' }}></div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bibliotecas</h3>
                  {programs.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nenhuma biblioteca</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {programs.map(program => (
                        <div key={program.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: PROGRAM_COLOR_VAR_MAP[program.color]?.accent ?? 'var(--text-secondary)' }}></div>
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{program.name}</span>
                          </div>
                          <button onClick={() => handleDeleteProgram(program.id, program.slug)} style={{ background: 'none', border: 'none', color: 'var(--red-accent)', cursor: 'pointer', padding: '4px' }}><Trash2 size={14} /></button>
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

      {loading ? null : filteredTreinos.length === 0 ? (
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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' as const }}
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
              program={treino.program ? programsBySlug.get(treino.program) : null}
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
        programs={programs}
        onCreateTag={handleCreateTag}
        onCreateType={handleCreateType}
        onUploadVideo={handleUploadVideo}
      />

      <NewProgramModal
        isOpen={isNewProgramModalOpen}
        onClose={() => setIsNewProgramModalOpen(false)}
        onCreate={createProgram}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        description={confirmState.description}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

export default AdminTreinos
