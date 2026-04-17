import { INTEREST_SCHEMA } from '../schema/interestSchema'

function sharedTags(myTags, peerTags) {
  const shared = []
  for (const [cat, { tags }] of Object.entries(INTEREST_SCHEMA)) {
    for (const [key, label] of Object.entries(tags)) {
      if (myTags?.[cat]?.[key] && peerTags?.[cat]?.[key]) {
        shared.push(label)
      }
    }
  }
  return shared
}

/**
 * Props:
 *   match           — peer profile + score
 *   myTags          — local user's tags (for shared tag computation)
 *   connectionState — 'none' | 'sent' | 'received' | 'connected'
 *   onConnect       — () => void  (state === 'none')
 *   onAccept        — () => void  (state === 'received')
 *   onDecline       — () => void  (state === 'received')
 *   onChat          — () => void  (state === 'connected')
 */
export default function MatchCard({ match, myTags, connectionState = 'none', onConnect, onAccept, onDecline, onChat }) {
  const { username, bio, score, tags } = match

  const pct = Math.round(score * 100)
  const common = sharedTags(myTags, tags)

  function renderActions() {
    switch (connectionState) {
      case 'connected':
        return (
          <button className="btn-primary btn-sm" onClick={onChat}>
            Chat
          </button>
        )
      case 'sent':
        return (
          <button className="btn-secondary btn-sm" disabled>
            Request Sent
          </button>
        )
      case 'received':
        return (
          <div className="connection-actions">
            <span className="connection-label">wants to connect</span>
            <button className="btn-primary btn-sm" onClick={onAccept}>Accept</button>
            <button className="btn-ghost btn-sm" onClick={onDecline}>Decline</button>
          </div>
        )
      default:
        return (
          <button className="btn-primary btn-sm" onClick={onConnect}>
            Connect
          </button>
        )
    }
  }

  return (
    <div className={`match-card${connectionState === 'connected' ? ' match-card--connected' : ''}`}>
      <div className="card-top">
        <div className="avatar">{username?.[0]?.toUpperCase()}</div>
        <div className="card-info">
          <span className="card-username">{username}</span>
          {bio && <span className="card-bio">{bio}</span>}
        </div>
        <div className="card-metrics">
          <span className="card-score">{pct}% Match</span>
        </div>
      </div>

      {common.length > 0 && (
        <p className="shared-tags">
          Shared: {common.slice(0, 5).join(', ')}{common.length > 5 ? ` +${common.length - 5} more` : ''}
        </p>
      )}

      {renderActions()}

    </div>
  )
}
