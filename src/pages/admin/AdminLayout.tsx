import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AdminSidebar } from './AdminSidebar'
import AdminBottomNav from '../../components/AdminBottomNav'
import styles from './AdminLayout.module.css'
import { useAuth } from '../../contexts/AuthContext'
import { useLogout } from '../../hooks/useLogout'
import { LogOut, Sun, Moon, Settings, Eye, Building2 } from 'lucide-react'
import arboLogo from '../../assets/arbo-run-logo.webp'
import { useBrand } from '../../contexts/BrandContext'

export function AdminLayout() {
  const { user, isSuperAdmin } = useAuth()
  const { brand } = useBrand()
  const logout = useLogout()
  const navigate = useNavigate()
  const name = user?.user_metadata?.full_name || user?.email || 'A'
  const initials = name.substring(0, 2).toUpperCase()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <img
            src={brand.logoUrl ?? arboLogo}
            alt={brand.brandName}
            width="32"
            height="32"
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
          {/* Arbo mantém o "ARBO" curto de sempre; outras assessorias usam o nome da marca */}
          <span className={styles.headerTitle}>{brand.slug === 'arbo' ? 'ARBO' : brand.brandName}</span>
        </div>
        
        <div className={styles.avatarContainer} ref={menuRef}>
          <button 
            className={styles.avatar} 
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ border: menuOpen ? '2px solid var(--orange)' : 'none', cursor: 'pointer' }}
          >
            {initials}
          </button>
          
          {menuOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownHeader}>
                <p className={styles.dropdownName}>{name}</p>
                <p className={styles.dropdownEmail}>{user?.email}</p>
              </div>
              <div className={styles.dropdownDivider} />
              <button 
                className={styles.dropdownItem} 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              </button>
              <button
                className={styles.dropdownItem}
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/admin/configuracoes')
                }}
              >
                <Settings size={16} /> Minha Assessoria
              </button>
              {isSuperAdmin && (
                <button
                  className={styles.dropdownItem}
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/admin/clientes')
                  }}
                >
                  <Building2 size={16} /> Clientes (Super Admin)
                </button>
              )}
              <div className={styles.dropdownDivider} />
              <button 
                className={styles.dropdownItem} 
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/preview-aluno')
                }}
              >
                <Eye size={16} /> Testar como Aluno
              </button>
              <button className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`} onClick={logout}>
                <LogOut size={16} /> Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={styles.contentWrapper}>
        <div 
          className={`${styles.sidebarOverlay} ${sidebarOpen ? styles.sidebarOverlayOpen : ''}`} 
          onClick={() => setSidebarOpen(false)}
        />
        <AdminSidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>

      <AdminBottomNav />
    </div>
  )
}
