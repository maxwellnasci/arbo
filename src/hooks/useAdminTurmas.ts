import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group } from '../lib/types'

export type GroupWithCount = Group & { studentCount: number }

export function useAdminTurmas() {
  const [turmas, setTurmas] = useState<GroupWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchTurmas() {
      const [
        { data: groups, error: groupsError },
        { data: members, error: membersError },
      ] = await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase
          .from('profiles')
          .select('group_id')
          .eq('role', 'aluno')
          .not('group_id', 'is', null),
      ])

      if (cancelled) return

      if (groupsError || membersError) {
        setError(groupsError?.message ?? membersError?.message ?? 'Erro desconhecido')
        setIsLoading(false)
        return
      }

      const countMap = new Map<string, number>()
      for (const m of members ?? []) {
        if (m.group_id) {
          countMap.set(m.group_id, (countMap.get(m.group_id) ?? 0) + 1)
        }
      }

      const result: GroupWithCount[] = (groups ?? []).map(g => ({
        ...g,
        studentCount: countMap.get(g.id) ?? 0,
      }))

      setTurmas(result)
      setIsLoading(false)
    }

    fetchTurmas()
    return () => { cancelled = true }
  }, [refreshKey])

  const refetch = () => setRefreshKey(k => k + 1)

  return { turmas, isLoading, error, refetch }
}
