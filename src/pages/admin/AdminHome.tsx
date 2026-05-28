import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { PersonalRecord, Profile } from '../../lib/types'

type RecentPR = PersonalRecord & { profiles: Profile }

type Stats = {
  totalAlunos: number
  feedbacksThisWeek: number
  prsThisWeek: number
}

export default function AdminHome() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ totalAlunos: 0, feedbacksThisWeek: 0, prsThisWeek: 0 })
  const [recentPRs, setRecentPRs] = useState<RecentPR[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoIso = weekAgo.toISOString()

    async function fetchStats() {
      const [
        { count: totalAlunos },
        { count: feedbacksThisWeek },
        { data: prs },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('id', user!.id),
        supabase.from('checkins').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
        supabase.from('records').select('*, profiles(*)').gte('created_at', weekAgoIso).order('created_at', { ascending: false }).limit(5),
      ])

      setStats({
        totalAlunos: totalAlunos ?? 0,
        feedbacksThisWeek: feedbacksThisWeek ?? 0,
        prsThisWeek: prs?.length ?? 0,
      })
      setRecentPRs((prs ?? []) as RecentPR[])
      setIsLoading(false)
    }

    fetchStats()
  }, [user])

  function formatSeconds(s: number | null) {
    if (!s) return '—'
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Resumo</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Alunos ativos" value={isLoading ? '…' : String(stats.totalAlunos)} />
        <StatCard label="Feedbacks (7 dias)" value={isLoading ? '…' : String(stats.feedbacksThisWeek)} />
        <StatCard label="PRs esta semana" value={isLoading ? '…' : String(stats.prsThisWeek)} accent="#4caf50" />
        <StatCard label="Turmas ativas" value="—" muted />
      </div>

      <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#aaa' }}>Recordes recentes</h2>
      {isLoading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : recentPRs.length === 0 ? (
        <p style={{ color: '#555' }}>Nenhum recorde esta semana.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentPRs.map(pr => (
            <div key={pr.id} style={{ background: '#1c1c1e', borderRadius: '10px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #2a2a2a' }}>
              <span style={{ color: '#fff', fontSize: '14px' }}>{pr.profiles?.full_name ?? '—'}</span>
              <span style={{ color: '#4caf50', fontSize: '13px', fontWeight: 600 }}>🏆 {pr.distance_category} · {formatSeconds(pr.time_seconds)}</span>
              <span style={{ color: '#555', fontSize: '12px' }}>{pr.created_at ? new Date(pr.created_at).toLocaleDateString('pt-BR') : '—'}</span>
            </div>
          ))}
        </div>
      )}
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
