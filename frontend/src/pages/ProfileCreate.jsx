import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { emptyTags, profileToTags } from '../schema/interestSchema'
import { connectBlockchainIdentity, formatWalletAddress } from '../lib/blockchain'
import { broadcastProfile } from '../lib/gossipBridge'
import { createProfile, getOrCreateIdentityMaterial } from '../lib/profile'
import InterestTagSelector from '../components/InterestTagSelector'

export default function ProfileCreate() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [peerId] = useState(() => user?.peerId || crypto.randomUUID())

  const [username, setUsername] = useState(user?.username || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [selected, setSelected] = useState(user?.tags ? profileToTags(user.tags) : emptyTags())
  const [ensName, setEnsName] = useState(user?.blockchainIdentity?.ensName || '')
  const [blockchainIdentity, setBlockchainIdentity] = useState(user?.blockchainIdentity || null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [linkingWallet, setLinkingWallet] = useState(false)

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

  async function handleLinkWallet() {
    setError('')
    setLinkingWallet(true)

    try {
      const { publicKeyBase64 } = await getOrCreateIdentityMaterial()
      const identity = await connectBlockchainIdentity({
        peerId,
        publicKey: publicKeyBase64,
        ensName,
      })

      setBlockchainIdentity(identity)
      if (!ensName && identity.ensName) {
        setEnsName(identity.ensName)
      }
    } catch (err) {
      console.error('Failed to link wallet:', err)
      setError(err instanceof Error ? err.message : 'Failed to link wallet.')
    } finally {
      setLinkingWallet(false)
    }
  }

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
          blockchainIdentity,
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

        <div className="field blockchain-field">
          <label>Blockchain Trust Anchor <span className="optional">(optional, recommended)</span></label>
          <p className="field-hint">
            Link an Ethereum wallet to bind your FindYourPeer public key to a blockchain identity.
            If you enter an ENS name, we verify that it resolves to the same wallet on mainnet.
          </p>
          <input
            type="text"
            value={ensName}
            onChange={e => {
              setEnsName(e.target.value)
              if (blockchainIdentity) {
                setBlockchainIdentity(null)
              }
            }}
            placeholder="alice.eth"
          />

          <div className="wallet-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleLinkWallet}
              disabled={linkingWallet}
            >
              {linkingWallet ? 'Linking…' : blockchainIdentity ? 'Re-link Wallet' : 'Link Wallet'}
            </button>

            {blockchainIdentity && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setBlockchainIdentity(null)}
              >
                Remove Wallet Link
              </button>
            )}
          </div>

          {blockchainIdentity && (
            <p className="wallet-status">
              Anchored to {blockchainIdentity.ensName || formatWalletAddress(blockchainIdentity.walletAddress)}
            </p>
          )}
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
