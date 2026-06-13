import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Training, Tag } from '../lib/types';

export type TrainingWithTag = Training & {
  tag: Tag | null;
};

export interface UseAdminTreinosReturn {
  treinos: TrainingWithTag[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAdminTreinos(): UseAdminTreinosReturn {
  const [treinos, setTreinos] = useState<TrainingWithTag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchFlag, setRefetchFlag] = useState<number>(0);

  const refetch = useCallback(() => {
    setRefetchFlag((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchTrainings() {
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('trainings')
          .select(`
            id, title, type, description, distance_m, duration_minutes, sets, target_pace_seconds_per_km, tag_id, created_at,
            tag:tags(id, name, color)
          `)
          .order('created_at', { ascending: false })
          .limit(200);

        if (cancelled) return;

        if (fetchError) {
          throw fetchError;
        }

        setTreinos((data as TrainingWithTag[]) || []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar treinos');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTrainings();

    return () => {
      cancelled = true;
    };
  }, [refetchFlag]);

  return { treinos, loading, error, refetch };
}
