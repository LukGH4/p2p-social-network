import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMatches } from '../lib/matchingBridge'
import { getKnownProfiles, onPeerProfile } from '../lib/gossipBridge'
import MatchCard from '../components/MatchCard'

export default function MatchFeed() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])

  function refresh(peers) {
    setMatches(getMatches(user, peers))
  }

  useEffect(() => {
    refresh(getKnownProfiles())

    const unsub = onPeerProfile(() => {
      refresh(getKnownProfiles())
    })

    return unsub
  }, [])

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
                onConnect={() => navigate(`/chat/${match.peerId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
