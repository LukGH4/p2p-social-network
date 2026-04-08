import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { emptyTags, profileToTags, INTEREST_SCHEMA } from '../schema/interestSchema'
import { broadcastProfile } from '../lib/gossipBridge'
import { createProfile } from '../lib/profile'
import InterestTagSelector from '../components/InterestTagSelector'

export default function ProfileCreate() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState(user?.username || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [selected, setSelected] = useState(
    user?.interestVector
      ? profileToTags(flatVectorToNestedTags(user.interestVector))
      : emptyTags()
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleTag(category, tag) {
    setSelected(prev => {
      const current = prev[category]
      const next = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag]
      return { ...prev, [category]: next }
    })
  }

  function totalSelected() {
    return Object.values(selected).reduce((sum, arr) => sum + arr.length, 0)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim()) { setError('Please enter a username.'); return }
    if (totalSelected() < 3) { setError('Select at least 3 tags so we can match you.'); return }

    setSaving(true)
    try {
      const peerId = user?.peerId || crypto.randomUUID()
      const signed = await createProfile({ username, bio, selectedTags: selected }, peerId)
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

// Convert flat interestVector back to nested tag structure for pre-populating the tag selector on edit
function flatVectorToNestedTags(interestVector) {
  const nested = {}
  for (const [category, { tags }] of Object.entries(INTEREST_SCHEMA)) {
    nested[category] = {}
    for (const tag of Object.keys(tags)) {
      if (interestVector[tag] === 1) nested[category][tag] = 1
    }
  }
  return nested
}
