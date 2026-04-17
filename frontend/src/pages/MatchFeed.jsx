import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMatches } from '../lib/matchingBridge'
import {
  getKnownProfiles,
  onPeerProfile,
  getNetworkStatus,
  onNetworkStatusChange,
  getConnectionState,
  onConnectionChange,
  sendConnectionRequest,
  acceptConnection,
  declineConnection,
} from '../lib/gossipBridge'
import MatchCard from '../components/MatchCard'
import UserMenu from '../components/UserMenu'

function buildRankedMatches(user, peers) {
  return getMatches(user, peers)
}

export default function MatchFeed() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])
  const [netStatus, setNetStatus] = useState(getNetworkStatus())
  // tick forces re-render when connection state changes (state lives in gossipBridge module)
  const [, setConnTick] = useState(0)

  function refresh(peers) {
    const list = buildRankedMatches(user, peers)
    // Pending inbound requests first so Accept / Decline are obvious during demo
    list.sort((a, b) => {
      const ra = getConnectionState(a.peerId) === 'received'
      const rb = getConnectionState(b.peerId) === 'received'
      if (ra !== rb) return ra ? -1 : 1
      return (b.overallScore ?? 0) - (a.overallScore ?? 0)
    })
    setMatches(list)
  }

  useEffect(() => {
    if (!user) return

    refresh(getKnownProfiles())

    const unsubProfiles = onPeerProfile(() => {
      refresh(getKnownProfiles())
    })

    const unsubStatus = onNetworkStatusChange(() => {
      setNetStatus(getNetworkStatus())
    })

    const unsubConn = onConnectionChange(() => {
      setConnTick(t => t + 1)
      refresh(getKnownProfiles())
    })

    return () => {
      unsubProfiles()
      unsubStatus()
      unsubConn()
    }
  }, [user])

  function statusBar() {
    const { status, statusMessage } = netStatus
    if (status === 'connecting') return <p className="net-status net-status--connecting">Connecting to network...</p>
    if (status === 'error')      return <p className="net-status net-status--error">Network error — is the bootstrap running? ({statusMessage})</p>
    if (status === 'connected')  return <p className="net-status net-status--ok">{statusMessage || 'Connected'}</p>
    return null
  }

  const pendingRequests = matches.filter(m => getConnectionState(m.peerId) === 'received')

  return (
    <div className="feed-page">
      <header className="feed-header">
        <span className="brand">FindYourPeer</span>
        <UserMenu />
      </header>

      {statusBar()}

      {pendingRequests.length > 0 && (
        <div className="pending-banner">
          {pendingRequests.length === 1
            ? `${pendingRequests[0].username} wants to connect with you!`
            : `${pendingRequests.length} people want to connect with you!`}
        </div>
      )}

      <div className="feed-body">
        <p className="welcome">Hey {user?.username}, here are your matches.</p>
        <p className="feed-subtitle">
          Match ranking blends movie similarity with peer vouches.
        </p>

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
                connectionState={getConnectionState(match.peerId)}
                onConnect={() => sendConnectionRequest(match.peerId)}
                onAccept={() => acceptConnection(match.peerId)}
                onDecline={() => declineConnection(match.peerId)}
                onChat={() => navigate(`/chat/${match.peerId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
