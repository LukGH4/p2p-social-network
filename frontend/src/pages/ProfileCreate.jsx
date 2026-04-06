import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { emptyTags, tagsToProfile, profileToTags } from '../schema/interestSchema'
import { broadcastProfile } from '../lib/gossipBridge'
import InterestTagSelector from '../components/InterestTagSelector'

export default function ProfileCreate() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState(user?.username || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [selected, setSelected] = useState(user?.tags ? profileToTags(user.tags) : emptyTags())
  const [error, setError] = useState('')

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

  function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim()) { setError('Please enter a username.'); return }
    if (totalSelected() < 3) { setError('Select at least 3 tags so we can match you.'); return }

    const profile = {
      peerId: user?.peerId || crypto.randomUUID(),
      username: username.trim(),
      bio: bio.trim(),
      tags: tagsToProfile(selected),
    }

    login(profile)
    broadcastProfile(profile)
    navigate('/feed', { replace: true })
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
          <button type="submit" className="btn-primary">
            {user ? 'Save' : 'Find My Peers'}
          </button>
        </div>
      </form>
    </div>
  )
}
