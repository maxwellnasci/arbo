import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AdminSidebar } from './AdminSidebar'
import { Menu } from 'lucide-react'
import styles from './AdminLayout.module.css'

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className={styles.container}>
      <div className={styles.headerMobile}>
        <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <span className={styles.headerTitle}>ARBO ADMIN</span>
      </div>

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
  )
}
