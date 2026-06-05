import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AdminSidebar } from './AdminSidebar'
import AdminBottomNav from '../../components/AdminBottomNav'
import styles from './AdminLayout.module.css'
import { useAuth } from '../../contexts/AuthContext'

export function AdminLayout() {
  const { user } = useAuth()
  const name = user?.user_metadata?.full_name || user?.email || 'A'
  const initials = name.substring(0, 2).toUpperCase()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="36" height="36" rx="10" fill="#0d2818"/>
            <rect x="16.5" y="22" width="3" height="8" rx="1.5" fill="#E8521A"/>
            <rect x="16.5" y="10" width="3" height="13" rx="1.5" fill="#E8521A"/>
            <line x1="18" y1="20" x2="10" y2="16" stroke="#E8521A" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="18" y1="20" x2="26" y2="16" stroke="#E8521A" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="18" y1="14" x2="12" y2="9" stroke="#E8521A" strokeWidth="2" strokeLinecap="round"/>
            <line x1="18" y1="14" x2="24" y2="9" stroke="#E8521A" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="9" x2="9" y2="6" stroke="#E8521A" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="12" y1="9" x2="13" y2="6" stroke="#E8521A" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="24" y1="9" x2="23" y2="6" stroke="#E8521A" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="24" y1="9" x2="27" y2="6" stroke="#E8521A" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="18" y1="10" x2="18" y2="7" stroke="#E8521A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className={styles.headerTitle}>ARBO</span>
        </div>
        
        <div className={styles.avatar}>
          {initials}
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
