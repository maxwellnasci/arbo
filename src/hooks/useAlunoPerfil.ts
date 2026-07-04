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

        const [profileRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url, level, groups(name)').eq('id', studentId).single()
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
