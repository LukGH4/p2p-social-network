import { Routes, Route, Navigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AccountSetup from './pages/AccountSetup'
import ProfileCreate from './pages/ProfileCreate'
import MatchFeed from './pages/MatchFeed'
import Chat from './pages/Chat'
import NotificationToast from './components/NotificationToast'

// Requires Privy authentication
function AuthRoute({ children }) {
  const { authenticated, ready } = usePrivy()
  if (!ready) return null
  return authenticated ? children : <Navigate to="/login" replace />
}

// Requires app profile (user has completed setup)
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { ready } = usePrivy()

  if (!ready) {
    return <div className="loading">Initializing...</div>
  }

  return (
    <>
      <NotificationToast />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Authenticated but not setup */}
        <Route path="/account-setup" element={<AuthRoute><AccountSetup /></AuthRoute>} />
        
        {/* Setup profile (legacy, kept for compatibility) */}
        <Route path="/profile/create" element={<ProfileCreate />} />
        
        {/* Fully authenticated routes */}
        <Route path="/feed" element={<ProtectedRoute><MatchFeed /></ProtectedRoute>} />
        <Route path="/chat/:peerId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}
