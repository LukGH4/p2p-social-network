import { INTEREST_SCHEMA } from '../schema/interestSchema'

// Returns display labels for tags present in both flat interestVectors.
function sharedTags(myVector, peerVector) {
  if (!myVector || !peerVector) return []
  const shared = []
  for (const { tags } of Object.values(INTEREST_SCHEMA)) {
    for (const [key, label] of Object.entries(tags)) {
      if (myVector[key] === 1 && peerVector[key] === 1) {
        shared.push(label)
      }
    }
  }
  return shared
}

export default function MatchCard({ match, myVector, onConnect }) {
  const { username, bio, score, interestVector } = match
  const pct = Math.round(score * 100)
  const common = sharedTags(myVector, interestVector)

  return (
    <div className="match-card">
      <div className="card-top">
        <div className="avatar">{username?.[0]?.toUpperCase()}</div>
        <div className="card-info">
          <span className="card-username">{username}</span>
          {bio && <span className="card-bio">{bio}</span>}
        </div>
        <span className="card-score">{pct}%</span>
      </div>

      {common.length > 0 && (
        <p className="shared-tags">
          Shared: {common.slice(0, 5).join(', ')}{common.length > 5 ? ` +${common.length - 5} more` : ''}
        </p>
      )}

      <button className="btn-primary btn-sm" onClick={onConnect}>
        Connect
      </button>
    </div>
  )
}
