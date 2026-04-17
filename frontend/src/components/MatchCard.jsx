import { INTEREST_SCHEMA } from '../schema/interestSchema'

// This function looks at the list of all the tags that are shared between two users
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


export default function MatchCard({ match, myTags, connectionState = 'none', onConnect, onAccept, onDecline, onChat }) {
  const { username, bio, score, tags } = match

  // Here we do the simple calculation of taking the score and making it into a percent 
  const pct = Math.round(score * 100)
  const common = sharedTags(myTags, tags)

  // Now we use the connection state and do switch case to show which button to display to the user based on 
  // what the connection status for the peers is
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


  // We are displaying the ui elements here which will give the information like the matching score to the user
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
