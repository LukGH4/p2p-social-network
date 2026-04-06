import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Onboarding() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/feed', { replace: true })
  }, [user, loading, navigate])

  if (loading) return null

  return (
    <div className="onboarding">
      <h1>FindYourPeer</h1>
      <p className="tagline">Find Georgia Tech students who watch the same stuff as you.</p>
      <p className="description">
        Pick your movie preferences and we will match you with peers based on how similar your tastes are.
        No algorithms, just math — cosine similarity on your picks.
      </p>
      <button className="btn-primary" onClick={() => navigate('/profile/create')}>
        Get Started
      </button>
    </div>
  )
}
