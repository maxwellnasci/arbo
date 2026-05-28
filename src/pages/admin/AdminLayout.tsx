import { Outlet } from 'react-router-dom'
import { AdminSidebar } from './AdminSidebar'

export function AdminLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100svh', backgroundColor: '#111111', color: '#fff' }}>
      <AdminSidebar />
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
