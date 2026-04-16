import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMatches } from '../lib/matchingBridge'
import {
  getKnownProfiles,
  getPeerTrust,
  hasVouchedForPeer,
  onPeerProfile,
  vouchForPeer,
} from '../lib/gossipBridge'
import MatchCard from '../components/MatchCard'

function buildRankedMatches(user, peers) {
  return getMatches(
    user,
    peers.map(peer => ({
      ...peer,
      trust: getPeerTrust(peer.peerId),
    }))
  )
}

export default function MatchFeed() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [matches, setMatches] = useState(() => buildRankedMatches(user, getKnownProfiles()))
  const [trustError, setTrustError] = useState('')

  async function handleVouch(peerId) {
    setTrustError('')

    try {
      await vouchForPeer(peerId)
      setMatches(buildRankedMatches(user, getKnownProfiles()))
    } catch (err) {
      console.error('Failed to vouch for peer:', err)
      setTrustError(err instanceof Error ? err.message : 'Failed to vouch for peer.')
    }
  }

  useEffect(() => {
    const unsub = onPeerProfile(() => {
      setMatches(buildRankedMatches(user, getKnownProfiles()))
    })

    return unsub
  }, [user])

  return (
    <div className="feed-page">
      <header className="feed-header">
        <span className="brand">FindYourPeer</span>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => navigate('/profile/create')}>Edit Profile</button>
          <button className="btn-ghost" onClick={() => { logout(); navigate('/') }}>Sign Out</button>
        </div>
      </header>

      <div className="feed-body">
        <p className="welcome">Hey {user?.username}, here are your matches.</p>
        <p className="feed-subtitle">
          Match ranking blends movie similarity with blockchain-backed trust and peer vouches.
        </p>
        {trustError && <p className="error">{trustError}</p>}

        {matches.length === 0 ? (
          <div className="empty-state">
            <p>No peers on the network yet.</p>
            <p>Once other users join, they will show up here ranked by how similar your movie tastes are.</p>
          </div>
        ) : (
          <div className="match-list">
            {matches.map(match => (
              <MatchCard
                key={match.peerId}
                match={match}
                myTags={user?.tags}
                canVouch={Boolean(user?.blockchainIdentity?.walletSignature)}
                hasVouched={hasVouchedForPeer(match.peerId)}
                onConnect={() => navigate(`/chat/${match.peerId}`)}
                onVouch={() => handleVouch(match.peerId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
