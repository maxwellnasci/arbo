import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Rotas do dono da plataforma (Painel Super Admin). Proteção de UI — o
// servidor também exige is_super_admin (RLS de organizations e Edge Function
// create-organization).
export default function SuperAdminRoute() {
  const { isSuperAdmin } = useAuth()

  if (!isSuperAdmin) return <Navigate to="/admin" replace />

  return <Outlet />
}
