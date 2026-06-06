import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DistanceCategory } from '../lib/types';

export interface AdminPRData {
  id: string;
  student_id: string;
  distance_category: DistanceCategory;
  time_seconds: number;
  achieved_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function useAdminPRs(limit = 10) {
  const [prs, setPrs] = useState<AdminPRData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('records')
          .select('id, student_id, distance_category, time_seconds, achieved_at, profiles(full_name, avatar_url)')
          .order('achieved_at', { ascending: false })
          .limit(limit);

        if (cancelled) return;
        if (error) throw error;

        setPrs(data as unknown as AdminPRData[]);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao buscar PRs');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { prs, isLoading, error };
}
