import { P2PNetwork } from './network.js'
import { verifyProfile, isProfileExpired } from './profile.js'

const peersCache = new Map()
const profileListeners = []
const directMessageListeners = []
const statusListeners = []
const timers = []
let network = null
let myProfile = null
let status = 'disconnected' // 'disconnected' | 'connecting' | 'connected' | 'error'
let statusMessage = ''

function setStatus(s, msg = '') {
  status = s
  statusMessage = msg
  console.log('[gossip] status:', s, msg)
  statusListeners.forEach(cb => cb(s, msg))
}

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

export async function initGossipNetwork(localProfile) {
  if (network) return

  myProfile = localProfile
  setStatus('connecting', 'Connecting to bootstrap...')

  network = new P2PNetwork({
    bootstrapAddr: '/ip4/127.0.0.1/tcp/4012/ws' // TODO: replace with deployed bootstrap IP
  })

  try {
    await network.start()
  } catch (err) {
    setStatus('error', err.message)
    network = null
    throw err
  }

  setStatus('connected', 'Connected to bootstrap')

  // When a new peer connects, immediately re-broadcast our profile so they see us right away
  network.onPeerConnect((peerId) => {
    console.log('[gossip] peer connected:', peerId, '— broadcasting profile')
    if (myProfile) broadcastProfile(myProfile)
  })

  network.onMessage(async (msg, from) => {
    // Direct chat message
    if (msg.type === 'DIRECT_MESSAGE') {
      console.log('[gossip] DM received → to:', msg.to, '| myPeerId:', myProfile?.peerId, '| match:', msg.to === myProfile?.peerId)
      if (msg.to === myProfile?.peerId) {
        console.log('[gossip] delivering DM from', msg.from)
        directMessageListeners.forEach(cb => cb({ from: msg.from, text: msg.text }))
      }
      return
    }

    // Profile deletion
    if (msg.type === 'PROFILE_DELETE' && msg.peerId) {
      if (peersCache.has(msg.peerId)) {
        peersCache.delete(msg.peerId)
        notifyProfileListeners()
        await network.sendToNetwork(msg)
      }
      return
    }

    // Profile gossip
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

export function onDirectMessage(callback) {
  directMessageListeners.push(callback)
  return () => {
    const i = directMessageListeners.indexOf(callback)
    if (i !== -1) directMessageListeners.splice(i, 1)
  }
}

export function getMyPeerId() {
  return myProfile?.peerId ?? null
}

export async function sendDirectMessage(toPeerId, text) {
  if (!network) { console.warn('[gossip] network not ready'); return }
  console.log('[gossip] sending DM to:', toPeerId, 'from:', myProfile?.peerId)
  await network.sendToNetwork({
    type: 'DIRECT_MESSAGE',
    to: toPeerId,
    from: myProfile?.peerId,
    text,
  })
}

function notifyProfileListeners() {
  const all = getKnownProfiles()
  profileListeners.forEach(cb => cb(all))
}
