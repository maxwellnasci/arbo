import React, { useState, useMemo, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useAdminTreinos } from '../../hooks/useAdminTreinos';
import { useTreinoMutations } from '../../hooks/useTreinoMutations';
import { TreinoCard } from '../../components/admin/TreinoCard';
import { TreinoFormPanel } from '../../components/admin/TreinoFormPanel';
import type { TrainingWithTag } from '../../hooks/useAdminTreinos';
import type { Database } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import type { Tag } from '../../lib/types';
import { toast } from 'sonner';

type TrainingInsert = Database['public']['Tables']['trainings']['Insert'];

export function AdminTreinos() {
  const { treinos, loading, error, refetch } = useAdminTreinos();
  const { createTraining, updateTraining, deleteTraining, isMutating } = useTreinoMutations();
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    supabase.from('tags').select('*').then(({ data }) => {
      if (data) setTags(data);
    });
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [treinoToEdit, setTreinoToEdit] = useState<TrainingWithTag | null>(null);

  const filteredTreinos = useMemo(() => {
    if (!searchTerm.trim()) return treinos;
    return treinos.filter((treino) =>
      treino.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [treinos, searchTerm]);

  const handleNewTreino = () => {
    setTreinoToEdit(null);
    setIsFormOpen(true);
  };

  const handleEdit = (treino: TrainingWithTag) => {
    setTreinoToEdit(treino);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este treino?')) return;
    try {
      await deleteTraining(id);
      toast.success('Treino excluído com sucesso');
      refetch();
    } catch (err) {
      toast.error('Erro ao excluir treino');
    }
  };

  const handleClosePanel = () => {
    setIsFormOpen(false);
    setTreinoToEdit(null);
  };

  const handleSubmit = async (data: Omit<TrainingInsert, 'created_by'>) => {
    try {
      // Fetching the user to get 'created_by'
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      if (treinoToEdit) {
        await updateTraining({ id: treinoToEdit.id, ...data });
        toast.success('Treino atualizado com sucesso');
      } else {
        await createTraining({ ...data, created_by: user.id });
        toast.success('Treino criado com sucesso');
      }
      refetch();
      handleClosePanel();
    } catch (error) {
      console.error('Erro ao salvar treino:', error);
      toast.error('Erro ao salvar o treino');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-500">Erro: {error}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-4xl tracking-tight text-gray-900 dark:text-white" style={{ fontFamily: 'Bebas Neue' }}>
          Biblioteca de Treinos
        </h1>
        <button
          onClick={handleNewTreino}
          className="bg-black text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors shadow-sm font-medium text-sm dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          + Novo Treino
        </button>
      </div>

      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar treino por título..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none text-sm dark:bg-gray-900 dark:border-gray-700 dark:focus:ring-white dark:focus:border-white"
        />
      </div>

      {/* Grid de Treinos */}
      {filteredTreinos.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200 dark:bg-gray-800/50 dark:border-gray-700">
          <p className="text-gray-500">
            {searchTerm ? 'Nenhum treino encontrado para esta busca.' : 'Nenhum treino cadastrado ainda. Crie o primeiro!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTreinos.map((treino) => (
            <TreinoCard 
              key={treino.id} 
              treino={treino} 
              onClickEdit={() => handleEdit(treino)} 
              onClickDelete={() => handleDelete(treino.id)}
            />
          ))}
        </div>
      )}

      {/* Side Panel do formulário */}
      <TreinoFormPanel
        isOpen={isFormOpen}
        treinoToEdit={treinoToEdit}
        onSubmit={handleSubmit}
        onClose={handleClosePanel}
        tags={tags}
      />
    </div>
  );
}

export default AdminTreinos;
