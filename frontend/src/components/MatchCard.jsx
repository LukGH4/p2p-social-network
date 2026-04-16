import { INTEREST_SCHEMA } from '../schema/interestSchema'
import { formatWalletAddress } from '../lib/blockchain'

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

export default function MatchCard({ match, myTags, onConnect, onVouch, canVouch, hasVouched }) {
  const { username, bio, score, tags, trust } = match
  const pct = Math.round(score * 100)
  const common = sharedTags(myTags, tags)
  const trustPct = Math.round((trust?.score ?? 0) * 100)
  const anchor = trust?.ensName || formatWalletAddress(trust?.walletAddress)

  return (
    <div className="match-card">
      <div className="card-top">
        <div className="avatar">{username?.[0]?.toUpperCase()}</div>
        <div className="card-info">
          <span className="card-username">{username}</span>
          {bio && <span className="card-bio">{bio}</span>}
        </div>
        <div className="card-metrics">
          <span className="card-score">{pct}% Match</span>
          <span className={`trust-pill trust-${trust?.level ?? 'low'}`}>
            {trustPct}% Trust
          </span>
        </div>
      </div>

      {common.length > 0 && (
        <p className="shared-tags">
          Shared: {common.slice(0, 5).join(', ')}{common.length > 5 ? ` +${common.length - 5} more` : ''}
        </p>
      )}

      <p className="trust-details">
        {trust?.label}
        {anchor ? ` • ${anchor}` : ''}
        {trust?.vouchCount ? ` • ${trust.vouchCount} peer vouch${trust.vouchCount === 1 ? '' : 'es'}` : ''}
      </p>

      {trust?.reasons?.length > 0 && (
        <p className="trust-reasons">{trust.reasons.join(' • ')}</p>
      )}

      <div className="card-actions">
        <button className="btn-primary btn-sm" onClick={onConnect}>
          Connect
        </button>
        <button
          className="btn-secondary btn-sm"
          onClick={onVouch}
          disabled={!onVouch || !canVouch || hasVouched}
        >
          {hasVouched ? 'Vouched' : 'Vouch'}
        </button>
      </div>
    </div>
  )
}
