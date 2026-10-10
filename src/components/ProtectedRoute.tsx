import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBrand } from '../contexts/BrandContext'
import OrganizationPausedScreen from './OrganizationPausedScreen'

export default function ProtectedRoute() {
  const { session, isLoading, isSuperAdmin } = useAuth()
  const { isPaused } = useBrand()

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--orange)',
        fontSize: '1rem',
        fontFamily: 'sans-serif',
      }}>
        Carregando...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // Assessoria pausada: o banco já não libera nenhum dado (current_org_id()
  // volta NULL); aqui só mostramos uma tela amigável em vez de telas vazias.
  // O dono da plataforma nunca é bloqueado.
  if (isPaused && !isSuperAdmin) return <OrganizationPausedScreen />

  return <Outlet />
}
