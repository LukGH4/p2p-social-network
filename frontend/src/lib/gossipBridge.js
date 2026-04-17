import { P2PNetwork } from './network.js'
import { verifyProfile, isProfileExpired } from './profile.js'
import { saveConnection, deleteConnection, getConnections, saveMessage } from './db.js'

/** Default: bootstrap on same machine. Override with VITE_BOOTSTRAP_ADDR (full multiaddr). */
const DEFAULT_BOOTSTRAP_ADDR = '/ip4/127.0.0.1/tcp/4012/ws'

function getBootstrapAddr() {
  const fromEnv = import.meta.env.VITE_BOOTSTRAP_ADDR
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return DEFAULT_BOOTSTRAP_ADDR
}

// ── Peer profile cache ──────────────────────────────────────────────────────
const peersCache = new Map()
const profileListeners = []

// ── Direct messages — real-time delivery to active Chat ─────────────────────
const directMessageListeners = []

// ── Connection state machine ────────────────────────────────────────────────
// peerId → 'sent' | 'received' | 'connected'
const connectionState = new Map()
const connectionListeners = []
const requestListeners = []   // fires when a brand-new request arrives

// ── Network status ──────────────────────────────────────────────────────────
const statusListeners = []
const timers = []
let network = null
let myProfile = null
let status = 'disconnected' // 'disconnected' | 'connecting' | 'connected' | 'error'
let statusMessage = ''

// ── Internal helpers ────────────────────────────────────────────────────────

function setStatus(s, msg = '') {
  status = s
  statusMessage = msg
  console.log('[gossip] status:', s, msg)
  statusListeners.forEach(cb => cb(s, msg))
}

function notifyProfileListeners() {
  const all = getKnownProfiles()
  profileListeners.forEach(cb => cb(all))
}

function notifyConnectionListeners() {
  connectionListeners.forEach(cb => cb())
}

/** Stable conversation ID shared by both peers for the same chat. */
function makeConvId(peerA, peerB) {
  return [peerA, peerB].sort().join('|')
}

// ── Exports: network status ─────────────────────────────────────────────────

export function getNetworkStatus() {
  return { status, statusMessage, peerCount: peersCache.size }
}

export function onNetworkStatusChange(callback) {
  statusListeners.push(callback)
  return () => {
    const i = statusListeners.indexOf(callback)
    if (i !== -1) statusListeners.splice(i, 1)
  }
}

// ── Exports: connection state ───────────────────────────────────────────────

/** Returns 'none' | 'sent' | 'received' | 'connected' */
export function getConnectionState(peerId) {
  return connectionState.get(peerId) ?? 'none'
}

export function onConnectionChange(callback) {
  connectionListeners.push(callback)
  return () => {
    const i = connectionListeners.indexOf(callback)
    if (i !== -1) connectionListeners.splice(i, 1)
  }
}

/**
 * Fires when a new connection request arrives for this peer.
 * callback({ fromPeerId, fromUsername })
 */
export function onConnectionRequest(callback) {
  requestListeners.push(callback)
  return () => {
    const i = requestListeners.indexOf(callback)
    if (i !== -1) requestListeners.splice(i, 1)
  }
}

export async function sendConnectionRequest(toPeerId) {
  if (!network || !myProfile) return
  const current = connectionState.get(toPeerId)
  if (current === 'connected' || current === 'sent') return
  connectionState.set(toPeerId, 'sent')
  notifyConnectionListeners()
  await network.sendToNetwork({
    type: 'CONNECTION_REQUEST',
    to: toPeerId,
    from: myProfile.peerId,
    fromUsername: myProfile.username,
  })
}

export async function acceptConnection(fromPeerId) {
  if (!network || !myProfile) return
  connectionState.set(fromPeerId, 'connected')
  await saveConnection(fromPeerId)
  notifyConnectionListeners()
  await network.sendToNetwork({
    type: 'CONNECTION_ACCEPT',
    to: fromPeerId,
    from: myProfile.peerId,
  })
}

export async function declineConnection(fromPeerId) {
  if (!network || !myProfile) return
  connectionState.delete(fromPeerId)
  await deleteConnection(fromPeerId)
  notifyConnectionListeners()
  await network.sendToNetwork({
    type: 'CONNECTION_DECLINE',
    to: fromPeerId,
    from: myProfile.peerId,
  })
}

// ── Exports: messaging ──────────────────────────────────────────────────────

export function onDirectMessage(callback) {
  directMessageListeners.push(callback)
  return () => {
    const i = directMessageListeners.indexOf(callback)
    if (i !== -1) directMessageListeners.splice(i, 1)
  }
}

export async function sendDirectMessage(toPeerId, text) {
  if (!network) { console.warn('[gossip] network not ready'); return }
  console.log('[gossip] sending DM to:', toPeerId, 'from:', myProfile?.peerId)
  const time = Date.now()
  await network.sendToNetwork({
    type: 'DIRECT_MESSAGE',
    to: toPeerId,
    from: myProfile?.peerId,
    text,
    time,
  })
}

// ── Exports: profiles ───────────────────────────────────────────────────────

export function getKnownProfiles() {
  return Array.from(peersCache.values())
}

export function onPeerProfile(callback) {
  profileListeners.push(callback)
  return () => {
    const i = profileListeners.indexOf(callback)
    if (i !== -1) profileListeners.splice(i, 1)
  }
}

export function getMyPeerId() {
  return myProfile?.peerId ?? null
}

export async function broadcastProfile(profile) {
  myProfile = profile
  if (!network) return
  await network.sendToNetwork({ type: 'PROFILE_GOSSIP', profile: myProfile })
}

export async function broadcastDeletion() {
  if (!network || !myProfile) return
  await network.sendToNetwork({ type: 'PROFILE_DELETE', peerId: myProfile.peerId })
  myProfile = null
}

// ── Init ────────────────────────────────────────────────────────────────────

export async function initGossipNetwork(localProfile) {
  if (network) return

  myProfile = localProfile
  setStatus('connecting', 'Connecting to bootstrap...')

  network = new P2PNetwork({
    bootstrapAddr: getBootstrapAddr(),
  })

  try {
    await network.start()
  } catch (err) {
    setStatus('error', err.message)
    network = null
    throw err
  }

  setStatus('connected', 'Connected to bootstrap')

  // Restore persisted (accepted) connections from IndexedDB
  try {
    const saved = await getConnections()
    for (const conn of saved) {
      connectionState.set(conn.peerId, 'connected')
    }
    if (saved.length > 0) notifyConnectionListeners()
  } catch (err) {
    console.warn('[gossip] failed to restore connections:', err.message)
  }

  // When a new peer connects, immediately re-broadcast our profile so they see us right away
  network.onPeerConnect((peerId) => {
    console.log('[gossip] peer connected:', peerId, '— broadcasting profile')
    if (myProfile) broadcastProfile(myProfile)
  })

  network.onMessage(async (msg, from) => {
    // ── Connection request ─────────────────────────────────────────────────
    if (msg.type === 'CONNECTION_REQUEST') {
      if (msg.to === myProfile?.peerId) {
        const existing = connectionState.get(msg.from)
        if (existing === 'sent') {
          // Both sides sent simultaneously — auto-connect
          connectionState.set(msg.from, 'connected')
          await saveConnection(msg.from)
          await network.sendToNetwork({ type: 'CONNECTION_ACCEPT', to: msg.from, from: myProfile.peerId })
        } else if (existing !== 'connected') {
          connectionState.set(msg.from, 'received')
          // Notify toast/notification listeners
          requestListeners.forEach(cb => cb({
            fromPeerId: msg.from,
            fromUsername: msg.fromUsername || msg.from.slice(0, 8),
          }))
        }
        notifyConnectionListeners()
      }
      return
    }

    // ── Connection accept ──────────────────────────────────────────────────
    if (msg.type === 'CONNECTION_ACCEPT') {
      if (msg.to === myProfile?.peerId) {
        connectionState.set(msg.from, 'connected')
        await saveConnection(msg.from)
        notifyConnectionListeners()
      }
      return
    }

    // ── Connection decline ─────────────────────────────────────────────────
    if (msg.type === 'CONNECTION_DECLINE') {
      if (msg.to === myProfile?.peerId) {
        connectionState.delete(msg.from)
        await deleteConnection(msg.from)
        notifyConnectionListeners()
      }
      return
    }

    // ── Direct chat message ────────────────────────────────────────────────
    if (msg.type === 'DIRECT_MESSAGE') {
      console.log('[gossip] DM received → to:', msg.to, '| myPeerId:', myProfile?.peerId, '| match:', msg.to === myProfile?.peerId)
      if (msg.to === myProfile?.peerId) {
        const time = msg.time ?? Date.now()
        const msgObj = { sender: 'peer', from: msg.from, text: msg.text, time }
        // Persist to IndexedDB (survives navigation + reload)
        const convId = makeConvId(msg.from, myProfile.peerId)
        saveMessage(convId, msgObj).catch(err => console.warn('[gossip] failed to save DM:', err))
        // Real-time delivery to any active Chat listener
        console.log('[gossip] delivering DM from', msg.from, '— listeners:', directMessageListeners.length)
        directMessageListeners.forEach(cb => cb(msgObj))
      }
      return
    }

    // ── Profile deletion ───────────────────────────────────────────────────
    if (msg.type === 'PROFILE_DELETE' && msg.peerId) {
      if (peersCache.has(msg.peerId)) {
        peersCache.delete(msg.peerId)
        notifyProfileListeners()
        await network.sendToNetwork(msg)
      }
      return
    }

    // ── Profile gossip ─────────────────────────────────────────────────────
    if (msg.type !== 'PROFILE_GOSSIP' || !msg.profile) return

    const profile = msg.profile

    if (profile.peerId === myProfile?.peerId) return
    if (isProfileExpired(profile)) return

    const isValid = await verifyProfile(profile)
    if (!isValid) {
      console.warn('[gossip] invalid signature from', from)
      return
    }

    const cached = peersCache.get(profile.peerId)
    if (cached && cached.timestamp >= profile.timestamp) return

    console.log('[gossip] received profile from', profile.username)
    peersCache.set(profile.peerId, profile)
    setStatus('connected', `Connected — ${peersCache.size} peer(s) found`)
    notifyProfileListeners()

    await network.sendToNetwork({ type: 'PROFILE_GOSSIP', profile })
  })

  // Re-broadcast every 5s so late-joiners see us quickly

  timers.push(setInterval(() => {
    if (myProfile) broadcastProfile(myProfile)
  }, 5_000))

  // Prune expired profiles every 10s
  timers.push(setInterval(() => {
    let changed = false
    for (const [peerId, profile] of peersCache.entries()) {
      if (isProfileExpired(profile)) {
        peersCache.delete(peerId)
        trustCache.delete(peerId)
        changed = true
      }
    }
    if (changed) {
      setStatus('connected', `Connected — ${peersCache.size} peer(s) found`)
      notifyProfileListeners()
    }
  }, 10_000))

  if (myProfile) broadcastProfile(myProfile)
}