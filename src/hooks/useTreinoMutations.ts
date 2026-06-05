import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Training } from '../lib/types';
import type { Database } from '../lib/database.types';

type TrainingInsert = Database['public']['Tables']['trainings']['Insert'];
type TrainingUpdate = Database['public']['Tables']['trainings']['Update'];

export interface UseTreinoMutationsReturn {
  createTraining: (training: TrainingInsert) => Promise<Training>;
  updateTraining: (training: TrainingUpdate & { id: string }) => Promise<Training>;
  deleteTraining: (id: string) => Promise<void>;
  isMutating: boolean;
}

export function useTreinoMutations(): UseTreinoMutationsReturn {
  const [isMutating, setIsMutating] = useState<boolean>(false);

  const createTraining = useCallback(async (training: TrainingInsert): Promise<Training> => {
    setIsMutating(true);
    try {
      const { data, error } = await supabase
        .from('trainings')
        .insert(training)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Nenhum dado retornado após criação');

      return data as Training;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const updateTraining = useCallback(async (training: TrainingUpdate & { id: string }): Promise<Training> => {
    setIsMutating(true);
    try {
      const { id, ...updates } = training;
      const { data, error } = await supabase
        .from('trainings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Nenhum dado retornado após atualização');

      return data as Training;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const deleteTraining = useCallback(async (id: string): Promise<void> => {
    setIsMutating(true);
    try {
      const { error } = await supabase
        .from('trainings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } finally {
      setIsMutating(false);
    }
  }, []);

  return { createTraining, updateTraining, deleteTraining, isMutating };
}
