import { useAdminFeedbacks, type FeedbackItem } from '../../hooks/useAdminFeedbacks'
import { motion } from 'framer-motion'
import { Trophy, Clock, Route, Activity } from 'lucide-react'

const effortEmoji: Record<number, string> = { 1: '😊', 2: '🙂', 3: '😅', 4: '😰', 5: '🥵' }

function formatSeconds(s: number | null) {
  if (!s) return null
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}'`
  return `${m}'${String(sec).padStart(2, '0')}`
}

function formatDistance(m: number | null) {
  if (!m) return null
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

const listContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const listItem = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 }
}

export default function AdminFeedbacks() {
  const { feedbacks, isLoading, error } = useAdminFeedbacks()

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--heading)', marginBottom: '32px', color: 'var(--text-primary)' }}>Feedbacks</h1>

      {error && <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
      ) : feedbacks.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', padding: '40px', borderRadius: '16px', textAlign: 'center', border: '1px solid var(--border-default)' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Nenhum feedback nos últimos 30 dias.</p>
        </div>
      ) : (
        <motion.div variants={listContainer} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {feedbacks.map((fb: FeedbackItem) => (
            <FeedbackCard key={fb.id} fb={fb} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

function FeedbackCard({ fb }: { fb: FeedbackItem }) {
  const dist = formatDistance(fb.actual_distance_m)
  const duration = formatSeconds(fb.actual_duration_seconds)
  const date = fb.created_at ? new Date(fb.created_at).toLocaleDateString('pt-BR') : '—'
  const effort = fb.perceived_effort

  return (
    <motion.div 
      variants={listItem}
      style={{
        background: 'var(--bg-surface)',
        borderRadius: '16px',
        padding: '20px',
        border: `1px solid ${fb.hasPR ? 'rgba(232, 82, 26, 0.3)' : 'var(--border-default)'}`,
        borderLeft: fb.hasPR ? '4px solid var(--orange)' : '1px solid var(--border-default)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-surface-hover)';
        e.currentTarget.style.transform = 'translateX(4px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-surface)';
        e.currentTarget.style.transform = 'translateX(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 700 }}>
          {fb.profiles?.full_name ?? '—'}
        </span>
        {fb.hasPR && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(232, 82, 26, 0.1)', color: 'var(--orange)', fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, border: '1px solid rgba(232, 82, 26, 0.2)' }}>
            <Trophy size={12} /> PR
          </span>
        )}
      </div>

      {fb.notes ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 16px', lineHeight: 1.5, fontStyle: 'italic' }}>"{fb.notes}"</p>
      ) : (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: '0 0 16px', fontStyle: 'italic' }}>sem observação</p>
      )}

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600 }}>{date}</span>
        
        {dist && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
            <Route size={14} color="var(--text-tertiary)" /> {dist}
          </span>
        )}
        
        {duration && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
            <Clock size={14} color="var(--text-tertiary)" /> {duration}
          </span>
        )}
        
        {effort != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
            <Activity size={14} color="var(--text-tertiary)" /> {effortEmoji[effort]} {effort}/5
          </span>
        )}
      </div>
    </motion.div>
  )
}
