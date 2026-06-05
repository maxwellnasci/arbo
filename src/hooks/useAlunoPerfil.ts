import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { UserLevel } from '../lib/types';

export interface AlunoPerfilData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  level: UserLevel | null;
  groups: {
    name: string;
  } | null;
  strava_connected: boolean;
}

export function useAlunoPerfil(studentId: string) {
  const [perfil, setPerfil] = useState<AlunoPerfilData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const [profileRes, stravaRes] = await Promise.all([
          supabase.from('profiles').select('*, groups(name)').eq('id', studentId).single(),
          supabase.from('strava_connections').select('id').eq('user_id', studentId).maybeSingle()
        ]);

        if (cancelled) return;
        if (profileRes.error) throw profileRes.error;

        const data = profileRes.data as unknown as AlunoPerfilData;
        setPerfil({
          id: data.id,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          level: data.level,
          groups: data.groups,
          strava_connected: !!stravaRes.data
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar perfil');
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
  }, [studentId]);

  return { perfil, isLoading, error };
}
