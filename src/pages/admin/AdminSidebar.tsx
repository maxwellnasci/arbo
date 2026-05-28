import { Link, useLocation } from 'react-router-dom'
import { useLogout } from '../../hooks/useLogout'
import { useAuth } from '../../contexts/AuthContext'

export function AdminSidebar() {
  const { pathname } = useLocation()
  const logout = useLogout()
  const { user } = useAuth()

  const links = [
    { to: '/admin', label: 'Início', exact: true },
    { to: '/admin/alunos', label: 'Alunos', exact: false },
    { to: '/admin/turmas', label: 'Turmas (em breve)', disabled: true },
    { to: '/admin/treinos', label: 'Treinos (em breve)', disabled: true },
    { to: '/admin/feedbacks', label: 'Feedbacks', exact: false },
    { to: '/admin/convites', label: 'Convites', exact: false },
  ]

  return (
    <nav style={{ width: '240px', borderRight: '1px solid #333', padding: '24px', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ color: '#E8521A', margin: '0 0 24px' }}>ARBO</h2>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {links.map(link => {
          const isActive = link.exact ? pathname === link.to : pathname.startsWith(link.to)
          return link.disabled ? (
              <span
                key={link.to}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  color: '#555',
                  display: 'block',
                  cursor: 'default',
                  userSelect: 'none',
                }}
              >
                {link.label}
              </span>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  color: isActive ? '#fff' : '#aaa',
                  backgroundColor: isActive ? '#2a2a2a' : 'transparent',
                  textDecoration: 'none',
                  display: 'block',
                }}
              >
                {link.label}
              </Link>
          )
        })}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid #333' }}>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{user?.email}</p>
        <button onClick={logout} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: 0 }}>
          Sair
        </button>
      </div>
    </nav>
  )
}
