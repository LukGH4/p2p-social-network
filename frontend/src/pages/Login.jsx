import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import { useAuth } from '../context/AuthContext'
import { getProfile } from '../lib/db'

export default function Login() {
  const navigate = useNavigate()
  const { user: privyUser, ready: privyReady, login: privyLogin } = usePrivy()
  const { user: appUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // We want to make the user go to the feed page in the case that the user already has the profile
  useEffect(() => {
    if (appUser) {
      navigate('/feed', { replace: true })
    }
  }, [appUser, navigate])


  // If the user does not have the profile then they need to be navigated to the account setup page
  useEffect(() => {
    if (privyReady && privyUser && !appUser) {
      navigate('/account-setup', { replace: true })
    }
  }, [privyReady, privyUser, appUser, navigate])

  async function handleEmailLogin() {
    setError('')
    setLoading(true)
    try {
      await privyLogin()
    } catch (err) {
      console.error('Login failed:', err)
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // For as long as privy is not ready we just show the login page to the user
  if (!privyReady) {
    return (
      <div className="login-page">
        <div className="login-container">
          <h1>FindYourPeer</h1>
          <p>Loading...</p>
        </div>
      </div>
    )
  }


  // For as long as the user doesnt have a profile we keep showing the prompt to the user for the setting up of the profile
  if (privyUser && !appUser) {
    return (
      <div className="login-page">
        <div className="login-container">
          <h1>Welcome back!</h1>
          <p>Let's set up your profile...</p>
          <button className="btn-primary" onClick={() => navigate('/account-setup')}>
            Continue to Setup
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>FindYourPeer</h1>
          <p className="tagline">Find Georgia Tech students who watch the same stuff as you.</p>
        </div>

        <div className="login-form">
          <h2>Sign In</h2>
          <p className="login-description">
            Use Privy to securely sign in or create your account.
          </p>

          <button 
            className="btn-primary btn-large" 
            onClick={handleEmailLogin}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In with Email'}
          </button>

          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          <div className="login-footer">
            <p className="security-note">
              Your security is important. Privy uses industry-standard authentication and encryption.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
