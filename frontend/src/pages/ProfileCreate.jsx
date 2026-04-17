import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { emptyTags, profileToTags } from '../schema/interestSchema'
import { broadcastProfile } from '../lib/gossipBridge'
import { createProfile } from '../lib/profile'
import InterestTagSelector from '../components/InterestTagSelector'

export default function ProfileCreate() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [peerId] = useState(() => user?.peerId || crypto.randomUUID())

  // These few lines take care of the case where the user wants to edit their profile where the profile is already existing
  const [username, setUsername] = useState(user?.username || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [selected, setSelected] = useState(user?.tags ? profileToTags(user.tags) : emptyTags())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // This toggle tag function is again just to toggle the interest tags based on what the user chooses for their interests
  function toggleTag(category, tag) {
    setSelected(prev => {
      const current = prev[category]
      const next = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag]
      return { ...prev, [category]: next }
    })
  }

  // This function simply just counts how many interests are selected by the user
  function totalSelected() {
    return Object.values(selected).reduce((sum, arr) => sum + arr.length, 0)
  }

  // We use this function to handle the submission which will make sure that the entered username and the chosen
  // tags and then we create the profile and navigate to the feed
  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim()) { setError('Please enter a username.'); return }
    if (totalSelected() < 3) { setError('Select at least 3 tags so we can match you.'); return }

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
      await login(signed)
      broadcastProfile(signed)
      navigate('/feed', { replace: true })
    } catch (err) {
      console.error('Failed to create profile:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="form-page">
      <h2>{user ? 'Edit Profile' : 'Create Profile'}</h2>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="your username"
            maxLength={30}
          />
        </div>

        <div className="field">
          <label>Bio <span className="optional">(optional)</span></label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="A little about yourself..."
            maxLength={200}
            rows={3}
          />
        </div>

        <div className="field">
          <label>Movie Interests — {totalSelected()} selected</label>
          <InterestTagSelector selected={selected} onToggle={toggleTag} />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          {user && (
            <button type="button" className="btn-secondary" onClick={() => navigate('/feed')}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : user ? 'Save' : 'Find My Peers'}
          </button>
        </div>
      </form>
    </div>
  )
}
