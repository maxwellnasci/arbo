import { Link, useLocation } from 'react-router-dom'
import { useLogout } from '../../hooks/useLogout'
import { useAuth } from '../../contexts/AuthContext'
import { LogOut } from 'lucide-react'
import styles from './AdminLayout.module.css'

export function AdminSidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { pathname } = useLocation()
  const logout = useLogout()
  const { user } = useAuth()

  const links: { to: string; label: string; exact: boolean }[] = [
    { to: '/admin', label: 'Início', exact: true },
    { to: '/admin/alunos', label: 'Alunos', exact: false },
    { to: '/admin/turmas', label: 'Turmas', exact: false },
    { to: '/admin/treinos', label: 'Treinos', exact: false },
    { to: '/admin/feedbacks', label: 'Feedbacks', exact: false },
    { to: '/admin/convites', label: 'Convites', exact: false },
  ]

  return (
    <nav className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
      <h2 className={styles.sidebarTitle}>ARBO</h2>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {links.map(link => {
          const isActive = link.exact ? pathname === link.to : pathname.startsWith(link.to)
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={onClose}
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
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px', padding: '0 8px' }}>{user?.email}</p>
        <button 
          onClick={logout} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            background: 'transparent', 
            border: 'none', 
            color: '#ff6b6b', 
            cursor: 'pointer', 
            padding: '12px 10px', 
            width: '100%',
            borderRadius: '8px',
            transition: 'background 0.2s',
            fontSize: '15px',
            fontWeight: 500
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#ff3b301a'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </nav>
  )
}
