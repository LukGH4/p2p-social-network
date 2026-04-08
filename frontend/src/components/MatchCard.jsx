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

export default function MatchCard({ match, myTags, onConnect }) {
  const { username, bio, score, tags } = match
  const pct = Math.round(score * 100)
  const common = sharedTags(myTags, tags)

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
