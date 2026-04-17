import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import { useAuth } from '../context/AuthContext'
import { emptyTags } from '../schema/interestSchema'
import { createProfile, getOrCreateIdentityMaterial } from '../lib/profile'
import { broadcastProfile } from '../lib/gossipBridge'
import InterestTagSelector from '../components/InterestTagSelector'

export default function AccountSetup() {
  const navigate = useNavigate()
  const { user: privyUser, ready: privyReady } = usePrivy()
  const { user: appUser, login: appLogin } = useAuth()
  
  const [peerId] = useState(() => crypto.randomUUID())
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [selected, setSelected] = useState(emptyTags())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)


  // For the account setup if we find that the profile is already there or if the user is not properly logged in
  // then we need to redirect the user
  useEffect(() => {
    if (!privyReady) return
    if (!privyUser) {
      navigate('/login', { replace: true })
      return
    }
    if (appUser) {
      navigate('/feed', { replace: true })
      return
    }
  }, [privyReady, privyUser, appUser, navigate])

  // Toggle tag will basically just modify the tags based on which of the interest tags were selected
  function toggleTag(category, tag) {
    setSelected(prev => {
      const current = prev[category]
      const next = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag]
      return { ...prev, [category]: next }
    })
  }

  // This function is very simple and just counts how many of the itnerests in total were selected by the user
  function totalSelected() {
    return Object.values(selected).reduce((sum, arr) => sum + arr.length, 0)
  }

  // We have some constraints for the username length which we use this function to properly enforce
  function handleNextStep() {
    if (!username.trim()) {
      setError('Please enter a username.')
      return
    }
    if (username.length < 2) {
      setError('Username must be at least 2 characters.')
      return
    }
    if (username.length > 30) {
      setError('Username must be 30 characters or less.')
      return
    }
    setError('')
    setStep(2)
  }

  // Here we will start by making the profile and then navigting the user to the feed page
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (totalSelected() < 3) {
      setError('Select at least 3 movie interests so we can match you properly.')
      return
    }

    setSaving(true)
    try {
      const signed = await createProfile(
        {
          username,
          bio,
          selectedTags: selected,
        },
        peerId
      )

      await appLogin(signed)
      broadcastProfile(signed)
      navigate('/feed', { replace: true })
    } catch (err) {
      console.error('Failed to create profile:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!privyReady || !privyUser) {
    return null
  }

  // We return these frontend elements to get the user's username and their bio first and then
  // we also get their movie preferences to make their entire profile
  return (
    <div className="form-page account-setup">
      <div className="setup-header">
        <h1>{step === 1 ? 'Create Your Profile' : 'Choose Your Interests'}</h1>
        {step === 2 && (
          <div className="setup-progress">
            <div className={`progress-step active`}>1</div>
            <div className={`progress-line active`}></div>
            <div className={`progress-step active`}>2</div>
          </div>
        )}
      </div>

      {step === 1 ? (
        <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="setup-form">
          <div className="field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Choose a unique username"
              maxLength={30}
              autoFocus
            />
            <span className="char-count">{username.length}/30</span>
          </div>

          <div className="field">
            <label>Bio <span className="optional">(optional)</span></label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell us a bit about yourself..."
              maxLength={200}
              rows={3}
            />
            <span className="char-count">{bio.length}/200</span>
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary">
            Next: Choose Interests
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="setup-form">
          <div className="field">
            <label>Movie Interests — {totalSelected()} selected</label>
            <p className="field-hint">
              Select at least 3 movie genres or interests. We'll use these to match you with peers who watch the same stuff.
            </p>
            <InterestTagSelector selected={selected} onToggle={toggleTag} />
          </div>

          {error && <p className="error">{error}</p>}

          <div className="form-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => setStep(1)}
              disabled={saving}
            >
              Back
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={saving || totalSelected() < 3}
            >
              {saving ? 'Creating Profile...' : 'Create Profile'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
