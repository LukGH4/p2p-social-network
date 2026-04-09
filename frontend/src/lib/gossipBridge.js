import { P2PNetwork } from '../../../p2p/src/network.js'// Adjust this path to your Part 1 network.js
// Add signProfile to your existing profile.js import
import { verifyProfile, isProfileExpired } from './profile.js'

const peersCache = new Map() // Map<peerId, SignedProfile>
const listeners = []
let network = null
let myProfile = null
let timers = []

// Start the network and begin gossiping
export async function initGossipNetwork(localProfile) {
  if (network) return // Prevent double initialization
  
  myProfile = localProfile

  // 1. Initialize Part 1 Network
  network = new P2PNetwork({ 
    bootstrapAddr: '/ip4/127.0.0.1/tcp/4012/ws' // TODO: Replace with your cloud bootstrap IP
  })
  
  await network.start()

  // 2. Listen for incoming profile gossips
  network.onMessage(async (msg, from) => {
    if (msg.type !== 'PROFILE_GOSSIP' || !msg.profile) return
    if (msg.type === 'PROFILE_DELETE' && msg.peerId) {
      if (peersCache.has(msg.peerId)) {
        peersCache.delete(msg.peerId);
        notifyListeners();
        // Forward the deletion to other peers
        await network.sendToNetwork(msg); 
      }
      return;
    }
    
    const profile = msg.profile
    
    // Ignore our own profile bouncing back
    if (profile.peerId === network.getPeerId()) return

    // Validate TTL and Cryptographic Signature (Part 2 tools)
    if (isProfileExpired(profile)) return
    const isValid = await verifyProfile(profile)
    if (!isValid) {
      console.warn(`[Gossip] Invalid signature from ${from}`)
      return
    }

    // Deduplication: Only process if it's new or updated
    const cached = peersCache.get(profile.peerId)
    if (cached && cached.timestamp >= profile.timestamp) return 

    // Save to cache and notify the React UI
    peersCache.set(profile.peerId, profile)
    notifyListeners()

    // Re-broadcast (Gossip) to our connected peers
    await network.sendToNetwork({ type: 'PROFILE_GOSSIP', profile })
  })

  // 3. Periodic Gossip Broadcast (every 15 seconds)
  timers.push(setInterval(() => {
    if (myProfile) broadcastProfile(myProfile)
  }, 15_000))

  // 4. Periodic Cache Pruning for expired profiles (every 10 seconds)
  timers.push(setInterval(() => {
    let changed = false
    for (const [peerId, profile] of peersCache.entries()) {
      if (isProfileExpired(profile)) {
        peersCache.delete(peerId)
        changed = true
      }
    }
    if (changed) notifyListeners()
  }, 10_000))

  // Initial broadcast
  if (myProfile) broadcastProfile(myProfile)
}

// Broadcast your own profile to the network
// Broadcast your own profile to the network
export async function broadcastProfile(profile) {
  myProfile = profile;
  if (!network) return;

  // We DO NOT update the timestamp or re-sign it here.
  // The original signature is valid for 1 hour, which is plenty of time!

  await network.sendToNetwork({
    type: 'PROFILE_GOSSIP',
    profile: myProfile
  });
}

export async function broadcastDeletion() {
  if (!network || !myProfile) return;
  
  await network.sendToNetwork({
    type: 'PROFILE_DELETE',
    peerId: myProfile.peerId
  });
  
  myProfile = null;
}

// Returns all valid peer profiles seen so far
export function getKnownProfiles() {
  return Array.from(peersCache.values())
}

// Called by React to listen for UI updates
export function onPeerProfile(callback) {
  listeners.push(callback)
  return () => {
    const i = listeners.indexOf(callback)
    if (i !== -1) listeners.splice(i, 1)
  }
}

// Internal helper
function notifyListeners() {
  const allProfiles = getKnownProfiles()
  listeners.forEach(cb => cb(allProfiles))
}