import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import SetPassword from './pages/SetPassword'
import DashboardRedirect from './pages/DashboardRedirect'
import { AdminLayout } from './pages/admin/AdminLayout'
import AdminHome from './pages/admin/AdminHome'
import AdminAlunos from './pages/admin/AdminAlunos'
import AdminFeedbacks from './pages/admin/AdminFeedbacks'
import AdminConvites from './pages/admin/AdminConvites'
import AlunoDashboard from './pages/aluno/AlunoDashboard'
import AnamnesisForm from './pages/aluno/AnamnesisForm'

function LoginPage() {
  const { session, isLoading } = useAuth()
  if (isLoading) return null
  if (session) return <Navigate to="/dashboard" replace />
  return <Login />
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/set-password', element: <SetPassword /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <DashboardRedirect /> },
      {
        element: <AdminRoute />,
        children: [
          {
            path: '/admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminHome /> },
              { path: 'alunos', element: <AdminAlunos /> },
              { path: 'feedbacks', element: <AdminFeedbacks /> },
              { path: 'convites', element: <AdminConvites /> },
            ]
          },
        ],
      },
      { path: '/aluno', element: <AlunoDashboard /> },
      { path: '/onboarding', element: <AnamnesisForm /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
