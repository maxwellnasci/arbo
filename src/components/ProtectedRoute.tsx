import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute() {
  const { session, isLoading } = useAuth()

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

  return <Outlet />
}
