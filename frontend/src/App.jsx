import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Onboarding      from './pages/Onboarding'
import ProfileCreate   from './pages/ProfileCreate'
import MatchFeed       from './pages/MatchFeed'
import Chat            from './pages/Chat'
import NotificationToast from './components/NotificationToast'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <>
      <NotificationToast />
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/profile/create" element={<ProfileCreate />} />
        <Route path="/feed" element={<PrivateRoute><MatchFeed /></PrivateRoute>} />
        <Route path="/chat/:peerId" element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
