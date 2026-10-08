import { lazy, Suspense, useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, useRouteError } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from './contexts/AuthContext'

// Componentes estruturais — estáticos (necessários no primeiro render)
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { AdminLayout } from './pages/admin/AdminLayout'
import ErrorBoundary from './components/ErrorBoundary'
import { hardReload, isChunkLoadError, recoverFromChunkError } from './lib/chunkRecovery'

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
const AdminMinhaAssessoria = lazy(() => import('./pages/admin/AdminMinhaAssessoria'))
const AlunoDashboard   = lazy(() => import('./pages/aluno/AlunoDashboard'))
const AnamnesisForm    = lazy(() => import('./pages/aluno/AnamnesisForm'))
const StravaCallback   = lazy(() => import('./pages/aluno/StravaCallback'))

// ── Suspense fallback ────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--orange-border)',
        borderTopColor: 'var(--orange)',
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

  const isChunkError = isChunkLoadError(error)
  // true quando a recuperação automática já foi tentada há menos de 60 s:
  // mostra a tela de erro (antes ficava num spinner para sempre).
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function recover() {
      if (!isChunkError) return
      // limpa service worker + caches e recarrega (trava de 60 s contra loop)
      const recovered = await recoverFromChunkError()
      if (!recovered && !cancelled) setGaveUp(true)
    }
    recover()
    return () => { cancelled = true }
  }, [isChunkError])

  if (isChunkError && !gaveUp) return <PageLoader />

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '24px',
      textAlign: 'center',
    }}>
      <div style={{
        background: 'var(--orange-subtle)',
        border: '1px solid var(--orange-border)',
        padding: '40px',
        borderRadius: '24px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: 'var(--shadow-card)',
      }}>
        <h1 style={{ color: 'var(--orange)', margin: '0 0 16px 0', fontSize: '28px', fontWeight: 600 }}>
          Oops! Algo deu errado.
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px 0', lineHeight: 1.6, fontSize: '15px' }}>
          Ocorreu um erro inesperado no aplicativo.
        </p>
        <div style={{
          background: 'var(--bg-input)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '24px',
          textAlign: 'left',
          border: '1px solid var(--border-subtle)',
          overflowX: 'auto',
        }}>
          <code style={{ color: 'var(--orange)', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {msg}
          </code>
        </div>
        <button
          onClick={() => { void hardReload() }}
          style={{
            background: 'var(--orange)',
            color: 'var(--text-primary)',
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
      // Link da assessoria (white-label): login já com logo e cores do box
      { path: '/a/:slug', element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense> },
      { path: '/a/:slug/login', element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense> },
      { path: '/set-password', element: <Suspense fallback={<PageLoader />}><SetPassword /></Suspense> },
      { path: '/strava/callback', element: <Suspense fallback={<PageLoader />}><StravaCallback /></Suspense> },
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
                  { path: 'configuracoes', element: <Suspense fallback={<PageLoader />}><AdminMinhaAssessoria /></Suspense> },
                ]
              },
              { path: '/preview-aluno', element: <Suspense fallback={<PageLoader />}><AlunoDashboard previewStudentId="00000000-0000-0000-0000-000000000000" /></Suspense> },
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
