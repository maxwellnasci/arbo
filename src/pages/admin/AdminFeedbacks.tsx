import { useAdminFeedbacks, type FeedbackItem } from '../../hooks/useAdminFeedbacks'

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
  return `${(m / 1000).toFixed(1).replace('.', ',')}km`
}

export default function AdminFeedbacks() {
  const { feedbacks, isLoading, error } = useAdminFeedbacks()

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>Feedbacks</h1>

      {error && <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</p>}

      {isLoading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : feedbacks.length === 0 ? (
        <p style={{ color: '#555' }}>Nenhum feedback nos últimos 30 dias.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {feedbacks.map((fb: FeedbackItem) => (
            <FeedbackCard key={fb.id} fb={fb} />
          ))}
        </div>
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
    <div style={{
      background: '#1c1c1e',
      borderRadius: '10px',
      padding: '14px 16px',
      border: `1px solid ${fb.hasPR ? '#4caf5044' : '#2a2a2a'}`,
      borderLeft: fb.hasPR ? '3px solid #4caf50' : '1px solid #2a2a2a',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
          {fb.profiles?.full_name ?? '—'}
        </span>
        {fb.hasPR && (
          <span style={{ background: '#4caf5022', color: '#4caf50', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
            🏆 PR
          </span>
        )}
      </div>

      {fb.notes ? (
        <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 8px', lineHeight: 1.5 }}>"{fb.notes}"</p>
      ) : (
        <p style={{ color: '#444', fontSize: '12px', margin: '0 0 8px', fontStyle: 'italic' }}>sem observação</p>
      )}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: '#555', fontSize: '12px' }}>{date}</span>
        {dist && <span style={{ color: '#666', fontSize: '12px' }}>{dist}</span>}
        {duration && <span style={{ color: '#666', fontSize: '12px' }}>{duration}</span>}
        {effort != null && <span style={{ color: '#666', fontSize: '12px' }}>{effortEmoji[effort]} {effort}/5</span>}
      </div>
    </div>
  )
}
