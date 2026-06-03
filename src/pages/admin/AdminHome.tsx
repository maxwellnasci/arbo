import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import AdminPRFeed from './AdminPRFeed'


type Stats = {
  totalAlunos: number
  feedbacksThisWeek: number
  prsThisWeek: number
  turmasAtivas: number
}

export default function AdminHome() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ totalAlunos: 0, feedbacksThisWeek: 0, prsThisWeek: 0, turmasAtivas: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoIso = weekAgo.toISOString()

      try {
        const [
          { count: totalAlunos },
          { count: feedbacksThisWeek },
          { data: prs },
          { count: turmasAtivas },
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'aluno'),
          supabase.from('checkins').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
          supabase.from('records').select('*, profiles(*)').gte('created_at', weekAgoIso).order('created_at', { ascending: false }).limit(5),
          supabase.from('groups').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ])

        if (cancelled) return
        setStats({
          totalAlunos: totalAlunos ?? 0,
          feedbacksThisWeek: feedbacksThisWeek ?? 0,
          prsThisWeek: prs?.length ?? 0,
          turmasAtivas: turmasAtivas ?? 0,
        })
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user])

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Resumo</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Alunos ativos" value={isLoading ? '…' : String(stats.totalAlunos)} />
        <StatCard label="Feedbacks (7 dias)" value={isLoading ? '…' : String(stats.feedbacksThisWeek)} />
        <StatCard label="PRs esta semana" value={isLoading ? '…' : String(stats.prsThisWeek)} accent="#4caf50" />
        <StatCard label="Turmas ativas" value={isLoading ? '…' : String(stats.turmasAtivas)} />
      </div>

      <div style={{ marginTop: '32px' }}>
        <AdminPRFeed />
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, muted }: { label: string; value: string; accent?: string; muted?: boolean }) {
  return (
    <div style={{ background: '#1c1c1e', padding: '20px 24px', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
      <p style={{ color: '#888', fontSize: '12px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ color: muted ? '#444' : accent ?? '#fff', fontSize: '28px', fontWeight: 800, margin: 0 }}>{value}</p>
    </div>
  )
}
