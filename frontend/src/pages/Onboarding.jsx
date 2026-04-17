import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Onboarding() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  // We navigate the user to the feed page when we know that the user is logged in
  useEffect(() => {
    if (!loading && user) navigate('/feed', { replace: true })
  }, [user, loading, navigate])

  // Of course if we are still in the loading phase then we wont show anything for the user
  if (loading) return null

  // Once we are done loading then we can return this ui components which will show the whole onboarding
  // page to the user
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
