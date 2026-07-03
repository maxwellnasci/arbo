import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import AdminPRFeed from './AdminPRFeed'
import { motion } from 'framer-motion'
import { Users, LayoutGrid, Trophy, MessageSquare, Calculator } from 'lucide-react'
import PaceCalculator from '../../components/shared/PaceCalculator'

type Stats = {
  totalAlunos: number
  feedbacksThisWeek: number
  prsThisWeek: number
  turmasAtivas: number
}

const RunnerSVG = () => (
  <svg width="140" height="200" viewBox="0 0 140 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', right: '-10px', bottom: 0, opacity: 0.15 }}>
    <ellipse cx="95" cy="22" rx="14" ry="14" fill="#E8521A"/>
    <line x1="95" y1="36" x2="88" y2="85" stroke="#E8521A" strokeWidth="8" strokeLinecap="round"/>
    <line x1="92" y1="55" x2="60" y2="72" stroke="#E8521A" strokeWidth="6" strokeLinecap="round"/>
    <line x1="92" y1="55" x2="115" y2="70" stroke="#E8521A" strokeWidth="6" strokeLinecap="round"/>
    <line x1="88" y1="85" x2="65" y2="130" stroke="#E8521A" strokeWidth="7" strokeLinecap="round"/>
    <line x1="65" y1="130" x2="45" y2="165" stroke="#E8521A" strokeWidth="6" strokeLinecap="round"/>
    <line x1="88" y1="85" x2="108" y2="125" stroke="#E8521A" strokeWidth="7" strokeLinecap="round"/>
    <line x1="108" y1="125" x2="120" y2="155" stroke="#E8521A" strokeWidth="6" strokeLinecap="round"/>
  </svg>
)

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' as const }
  })
}

export default function AdminHome() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ totalAlunos: 0, feedbacksThisWeek: 0, prsThisWeek: 0, turmasAtivas: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [showCalculator, setShowCalculator] = useState(false)

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
          { count: prsThisWeek },
          { count: turmasAtivas },
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'aluno'),
          supabase.from('checkins').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
          supabase.from('records').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
          supabase.from('groups').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ])

        if (!cancelled) {
          setStats({
            totalAlunos: totalAlunos || 0,
            feedbacksThisWeek: feedbacksThisWeek || 0,
            prsThisWeek: prsThisWeek || 0,
            turmasAtivas: turmasAtivas || 0,
          })
        }
      } catch (err: unknown) {
        console.error('Error fetching admin stats:', err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user])

  const name = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Professor'

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  return (
    <div>
      <div style={{
        background: 'linear-gradient(160deg, var(--bg-hero) 0%, var(--bg-primary) 65%)',
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 20px 28px',
        margin: '-24px -24px 24px -24px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ position: 'absolute', top: '-20px', left: '-20px', width: '150px', height: '150px', background: 'var(--orange)', opacity: 0.07, filter: 'blur(40px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '20px', right: '40px', width: '100px', height: '100px', background: 'var(--orange)', opacity: 0.07, filter: 'blur(50px)', borderRadius: '50%' }} />
        <RunnerSVG />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, var(--bg-primary) 100%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontFamily: 'var(--sans)', fontSize: '10px', fontWeight: 700, letterSpacing: '2.5px', color: 'var(--orange)', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
              PAINEL DO PROFESSOR
            </p>
            <h1 style={{ fontFamily: 'var(--heading)', fontSize: '30px', fontWeight: 700, margin: '0 0 8px 0', lineHeight: 1.1 }}>
              Sua turma,<br />
              <span style={{ color: 'var(--orange)', fontStyle: 'italic' }}>em</span> forma.
            </h1>
            <p style={{ fontFamily: 'var(--sans)', fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              {greeting()}, {name} — {isLoading ? '…' : stats.prsThisWeek} PRs essa semana 🔥
            </p>
          </div>
          
          <button 
            onClick={() => setShowCalculator(true)}
            aria-label="Abrir Calculadora de Pace"
            style={{
              background: 'var(--orange-subtle)',
              border: '1px solid var(--border-default)',
              color: 'var(--orange)',
              padding: '10px', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}
          >
            <Calculator size={20} />
          </button>
        </div>
      </div>

      <PaceCalculator isOpen={showCalculator} onClose={() => setShowCalculator(false)} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '32px' }}>
        <motion.div variants={cardVariants} custom={0} initial="hidden" animate="visible" style={{ background: 'var(--bg-card-green)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-green)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Users size={16} color="var(--green-accent)" />
          <p style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-1px', margin: 0, color: 'var(--green-accent)' }}>{isLoading ? '…' : stats.totalAlunos}</p>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--green-accent)', opacity: 0.7, margin: 0, fontWeight: 700 }}>Alunos Ativos</p>
        </motion.div>

        <motion.div variants={cardVariants} custom={1} initial="hidden" animate="visible" style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <LayoutGrid size={16} color="var(--text-tertiary)" />
          <p style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-1px', margin: 0, color: 'var(--text-primary)' }}>{isLoading ? '…' : stats.turmasAtivas}</p>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-tertiary)', margin: 0, fontWeight: 700 }}>Turmas Ativas</p>
        </motion.div>

        <motion.div variants={cardVariants} custom={2} initial="hidden" animate="visible" style={{ background: 'var(--bg-card-orange)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-orange)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Trophy size={16} color="var(--orange)" />
          <p style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-1px', margin: 0, color: 'var(--orange)' }}>{isLoading ? '…' : stats.prsThisWeek}</p>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--orange)', opacity: 0.7, margin: 0, fontWeight: 700 }}>PRs Esta Semana</p>
        </motion.div>

        <motion.div variants={cardVariants} custom={3} initial="hidden" animate="visible" style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <MessageSquare size={16} color="var(--text-tertiary)" />
          <p style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-1px', margin: 0, color: 'var(--text-primary)' }}>{isLoading ? '…' : stats.feedbacksThisWeek}</p>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-tertiary)', margin: 0, fontWeight: 700 }}>Feedbacks</p>
        </motion.div>
      </div>

      <div>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '12px', marginLeft: '4px' }}>Recordes Recentes</p>
        <AdminPRFeed />
      </div>
    </div>
  )
}
