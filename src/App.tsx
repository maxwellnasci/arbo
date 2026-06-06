import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, useRouteError } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from './contexts/AuthContext'

// Componentes estruturais — estáticos (necessários no primeiro render)
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { AdminLayout } from './pages/admin/AdminLayout'
import ErrorBoundary from './components/ErrorBoundary'

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

// ── Router-level error boundary ──────────────────────────────────────────────
// React Router's data-router catches route errors internally before they reach
// our outer ErrorBoundary. This errorElement restores proper handling:
// chunk-load failures → auto-reload once; other errors → friendly UI.
function RouterErrorElement() {
  const error = useRouteError()
  const msg = error instanceof Error ? error.message : String(error ?? 'Erro desconhecido')

  const isChunkError =
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Failed to load module script') ||
    msg.includes('Unable to preload CSS') ||
    msg.includes('error loading dynamically imported module')

  useEffect(() => {
    if (!isChunkError) return
    const key = 'arbo_chunk_reload'
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      window.location.reload()
    }
  }, [isChunkError])

  if (isChunkError) return <PageLoader />

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      background: '#111111',
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '24px',
      textAlign: 'center',
    }}>
      <div style={{
        background: 'rgba(232, 82, 26, 0.05)',
        border: '1px solid rgba(232, 82, 26, 0.15)',
        padding: '40px',
        borderRadius: '24px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <h1 style={{ color: '#E8521A', margin: '0 0 16px 0', fontSize: '28px', fontWeight: 600 }}>
          Oops! Algo deu errado.
        </h1>
        <p style={{ color: '#a0a0a0', margin: '0 0 24px 0', lineHeight: 1.6, fontSize: '15px' }}>
          Ocorreu um erro inesperado no aplicativo.
        </p>
        <div style={{
          background: '#0a0a0a',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '24px',
          textAlign: 'left',
          border: '1px solid rgba(255,255,255,0.05)',
          overflowX: 'auto',
        }}>
          <code style={{ color: '#E8521A', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {msg}
          </code>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#E8521A',
            color: '#ffffff',
            border: 'none',
            padding: '14px 24px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Recarregar a página
        </button>
      </div>
    </div>
  )
}

const router = createBrowserRouter([
  {
    errorElement: <RouterErrorElement />,
    children: [
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
    ],
  },
])

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="bottom-center" richColors />
    </ErrorBoundary>
  )
}
