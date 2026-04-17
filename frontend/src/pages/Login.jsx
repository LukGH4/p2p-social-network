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

  // If user is already logged in with app profile, go to feed
  useEffect(() => {
    if (appUser) {
      navigate('/feed', { replace: true })
    }
  }, [appUser, navigate])

  // If Privy user is authenticated but no app profile, go to account setup
  useEffect(() => {
    if (privyReady && privyUser && !appUser) {
      navigate('/account-setup', { replace: true })
    }
  }, [privyReady, privyUser, appUser, navigate])

  async function handleEmailLogin() {
    setError('')
    setLoading(true)
    try {
      // Privy's built-in email login - this will prompt the user
      await privyLogin()
    } catch (err) {
      console.error('Login failed:', err)
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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

  // If already authenticated with Privy, show account setup prompt
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
            Use Privy to securely sign in or create your account. Your identity can be verified with blockchain.
          </p>

          <button 
            className="btn-primary btn-large" 
            onClick={handleEmailLogin}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In with Email'}
          </button>

          <div className="login-methods">
            <p className="methods-label">Other ways to sign in:</p>
            <p className="methods-note">
              Privy supports email, SMS, Google, Apple, and wallet sign-in. 
              Configure additional methods in your Privy dashboard.
            </p>
          </div>

          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          <div className="login-footer">
            <p className="security-note">
              🔒 Your security is important. Privy uses industry-standard authentication and encryption.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
