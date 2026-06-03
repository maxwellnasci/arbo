import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from './contexts/AuthContext'

// Componentes estruturais — estáticos (necessários no primeiro render)
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { AdminLayout } from './pages/admin/AdminLayout'

// ── Lazy imports por rota ────────────────────────────────────────────────────
const Login            = lazy(() => import('./components/Login'))
const SetPassword      = lazy(() => import('./pages/SetPassword'))
const DashboardRedirect = lazy(() => import('./pages/DashboardRedirect'))
const AdminHome        = lazy(() => import('./pages/admin/AdminHome'))
const AdminAlunos      = lazy(() => import('./pages/admin/AdminAlunos'))
const AdminFeedbacks   = lazy(() => import('./pages/admin/AdminFeedbacks'))
const AdminConvites    = lazy(() => import('./pages/admin/AdminConvites'))
const AdminTurmas      = lazy(() => import('./pages/admin/AdminTurmas'))
const AdminTurmaDetail = lazy(() => import('./pages/admin/AdminTurmaDetail'))
const AdminAlunoDetail = lazy(() => import('./pages/admin/AdminAlunoDetail'))
const AdminTreinos     = lazy(() => import('./pages/admin/AdminTreinos'))
const AlunoDashboard   = lazy(() => import('./pages/aluno/AlunoDashboard'))
const AnamnesisForm    = lazy(() => import('./pages/aluno/AnamnesisForm'))

// ── Suspense fallback ────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      background: '#111111',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid rgba(232, 82, 26, 0.2)',
        borderTopColor: '#E8521A',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function LoginPage() {
  const { session, isLoading } = useAuth()
  if (isLoading) return null
  if (session) return <Navigate to="/dashboard" replace />
  return <Login />
}

const router = createBrowserRouter([
  { path: '/login', element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense> },
  { path: '/set-password', element: <Suspense fallback={<PageLoader />}><SetPassword /></Suspense> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <Suspense fallback={<PageLoader />}><DashboardRedirect /></Suspense> },
      {
        element: <AdminRoute />,
        children: [
          {
            path: '/admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <Suspense fallback={<PageLoader />}><AdminHome /></Suspense> },
              { path: 'alunos', element: <Suspense fallback={<PageLoader />}><AdminAlunos /></Suspense> },
              { path: 'feedbacks', element: <Suspense fallback={<PageLoader />}><AdminFeedbacks /></Suspense> },
              { path: 'convites', element: <Suspense fallback={<PageLoader />}><AdminConvites /></Suspense> },
              { path: 'turmas', element: <Suspense fallback={<PageLoader />}><AdminTurmas /></Suspense> },
              { path: 'turmas/:id', element: <Suspense fallback={<PageLoader />}><AdminTurmaDetail /></Suspense> },
              { path: 'alunos/:id', element: <Suspense fallback={<PageLoader />}><AdminAlunoDetail /></Suspense> },
              { path: 'treinos', element: <Suspense fallback={<PageLoader />}><AdminTreinos /></Suspense> },
            ]
          },
        ],
      },
      { path: '/aluno', element: <Suspense fallback={<PageLoader />}><AlunoDashboard /></Suspense> },
      { path: '/onboarding', element: <Suspense fallback={<PageLoader />}><AnamnesisForm /></Suspense> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="bottom-center" richColors />
    </>
  )
}
