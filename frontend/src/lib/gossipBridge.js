// Stub for Part 3 (gossip/profile layer).
// Ved will replace the contents of these functions with real gossip calls.

let peers = []
const listeners = []

// Called when a new peer profile arrives over the gossip network
export function onPeerProfile(callback) {
  listeners.push(callback)
  return () => {
    const i = listeners.indexOf(callback)
    if (i !== -1) listeners.splice(i, 1)
  }
}

// Returns all peer profiles seen so far
export function getKnownProfiles() {
  return peers
}

// Broadcast your own profile to the network
export function broadcastProfile(profile) {
  // TODO: Ved hooks this into the gossip layer
  console.log('broadcastProfile (stub)', profile)
}

// Used by the gossip layer to push a new peer profile into the frontend
export function receivePeerProfile(profile) {
  const existing = peers.findIndex(p => p.peerId === profile.peerId)
  if (existing !== -1) {
    peers[existing] = profile
  } else {
    peers.push(profile)
  }
  listeners.forEach(cb => cb(profile))
}
