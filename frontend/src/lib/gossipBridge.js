import { P2PNetwork } from './network.js'
import { verifyProfile, isProfileExpired, createTTLProfile, signProfile } from './profile.js'
import { getKeypair, saveConnection, deleteConnection, getConnections, saveMessage } from './db.js'
 

const DEFAULT_BOOTSTRAP_ADDR = '/ip4/127.0.0.1/tcp/4012/ws'
 
function getBootstrapAddr() {
  const fromEnv = import.meta.env.VITE_BOOTSTRAP_ADDR
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return DEFAULT_BOOTSTRAP_ADDR
}
 

// We're going to be using this cache to store and keep trak of all of the peers and profiles that we know about
const peersCache = new Map()
const profileListeners = []
 

const directMessageListeners = []
 

// We use this map to keep track of the state of the connection with each of the peers
const connectionState = new Map()
const connectionListeners = []
const requestListeners = []
 

const statusListeners = []
let timers = []
let network = null
let myProfile = null
let status = 'disconnected'
let statusMessage = ''
 

 
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
 

function makeConvId(peerA, peerB) {
  return [peerA, peerB].sort().join('|')
}
 

function peerIdsEqual(a, b) {
  if (a == null || b == null) return false
  return String(a) === String(b)
}
 

function scheduleRedundantControlSend(payload) {
  const delays = [450, 1300]
  for (const ms of delays) {
    setTimeout(() => {
      if (!network) return
      network.sendToNetwork(payload).catch(() => {})
    }, ms)
  }
}

async function resendPendingConnectionRequest(toPeerId) {
  if (!network || !myProfile) return
  if (connectionState.get(toPeerId) !== 'sent') return
  const payload = {
    type: 'CONNECTION_REQUEST',
    to: toPeerId,
    from: myProfile.peerId,
    fromUsername: myProfile.username,
  }
  await network.sendToNetwork(payload)
  scheduleRedundantControlSend(payload)
}
 
function flushPendingOutgoingRequests() {
  for (const [peerId, state] of connectionState.entries()) {
    if (state !== 'sent') continue
    resendPendingConnectionRequest(peerId).catch(() => {})
  }
}
 
async function queryPeerConnectionState(peerId) {
  if (!network || !myProfile) return
  const payload = {
    type: 'CONNECTION_STATE_QUERY',
    to: peerId,
    from: myProfile.peerId,
  }
  await network.sendToNetwork(payload)
}
 
function syncConnectionStatesWithPeers() {
  for (const [peerId, state] of connectionState.entries()) {
    if (state === 'sent' || state === 'received' || state === 'connected') {
      queryPeerConnectionState(peerId).catch(() => {})
    }
  }
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


export function onConnectionRequest(callback) {
  requestListeners.push(callback)
  return () => {
    const i = requestListeners.indexOf(callback)
    if (i !== -1) requestListeners.splice(i, 1)
  }
}
 
// We use this to send the connection request and we need to update the local state and send out the request through the network
export async function sendConnectionRequest(toPeerId) {
  if (!network || !myProfile) return
  const current = connectionState.get(toPeerId)
  if (current === 'connected' || current === 'sent') return
  connectionState.set(toPeerId, 'sent')
  notifyConnectionListeners()
  const payload = {
    type: 'CONNECTION_REQUEST',
    to: toPeerId,
    from: myProfile.peerId,
    fromUsername: myProfile.username,
  }
  await network.sendToNetwork(payload)
  scheduleRedundantControlSend(payload)
}
 
// We use this to accept the connection request and we need to save it on the local 
export async function acceptConnection(fromPeerId) {
  if (!network || !myProfile) return
  connectionState.set(fromPeerId, 'connected')
  await saveConnection(fromPeerId)
  notifyConnectionListeners()
  const payload = {
    type: 'CONNECTION_ACCEPT',
    to: fromPeerId,
    from: myProfile.peerId,
  }
  await network.sendToNetwork(payload)
  scheduleRedundantControlSend(payload)
}
 
// We use this to decline the connection request and we need to save it on the local 
export async function declineConnection(fromPeerId) {
  if (!network || !myProfile) return
  connectionState.delete(fromPeerId)
  await deleteConnection(fromPeerId)
  notifyConnectionListeners()
  const payload = {
    type: 'CONNECTION_DECLINE',
    to: fromPeerId,
    from: myProfile.peerId,
  }
  await network.sendToNetwork(payload)
  scheduleRedundantControlSend(payload)
}

 
export function onDirectMessage(callback) {
  directMessageListeners.push(callback)
  return () => {
    const i = directMessageListeners.indexOf(callback)
    if (i !== -1) directMessageListeners.splice(i, 1)
  }
}
 
// This function is to use the network to send out a message to the destintion peer
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
 
async function refreshProfileSignature(profile) {
  try {
    const kp = await getKeypair()
    if (!kp) return profile
    const { signature, timestamp, ttl, ...base } = profile
    const fresh = createTTLProfile(base)
    return await signProfile(fresh, kp.privateKey)
  } catch (err) {
    console.warn('[gossip] failed to refresh profile signature:', err.message)
    return profile
  }
}
 
// We need to be able to broadcast the profile so that all of the peers can find this profile
export async function broadcastProfile(profile) {
  const refreshed = await refreshProfileSignature(profile)
  myProfile = refreshed
  if (!network) return
  await network.sendToNetwork({ type: 'PROFILE_GOSSIP', profile: myProfile })
}
 
export async function broadcastDeletion() {
  if (!network || !myProfile) return
  await network.sendToNetwork({ type: 'PROFILE_DELETE', peerId: myProfile.peerId })
  myProfile = null
}

 

export async function teardownGossipNetwork() {

  for (const timer of timers) {
    clearInterval(timer)
  }
  timers = []
 

  if (network) {
    try {
      await network.stop()
    } catch (err) {
      console.warn('[gossip] error stopping network during teardown:', err.message)
    }
    network = null
  }
 

  myProfile = null
  peersCache.clear()
  connectionState.clear()
 
  setStatus('disconnected', '')
  console.log('[gossip] network torn down')
}
 

 
// This will start the gossip network and will also work on setting up the listeners that we need and 
// also will get back all of the connectgions tht we ahve saved
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
 

  try {
    const saved = await getConnections()
    for (const conn of saved) {
      connectionState.set(conn.peerId, 'connected')
    }
    if (saved.length > 0) notifyConnectionListeners()
  } catch (err) {
    console.warn('[gossip] failed to restore connections:', err.message)
  }
 

  setTimeout(() => {
    syncConnectionStatesWithPeers()
  }, 2000)
 

  network.onPeerConnect((peerId) => {
    console.log('[gossip] peer connected:', peerId, '— broadcasting profile')
    if (myProfile) broadcastProfile(myProfile)
  })
 
  // This will work on dealing with all of the connect reqs, the messages, the profiles
  network.onMessage(async (msg, from) => {

    if (msg.type === 'CONNECTION_REQUEST') {
      if (peerIdsEqual(msg.to, myProfile?.peerId)) {
        const existing = connectionState.get(msg.from)
        if (existing === 'sent') {
          connectionState.set(msg.from, 'connected')
          await saveConnection(msg.from)
          const autoAccept = { type: 'CONNECTION_ACCEPT', to: msg.from, from: myProfile.peerId }
          await network.sendToNetwork(autoAccept)
          scheduleRedundantControlSend(autoAccept)
        } else if (existing === 'connected') {
        } else if (existing === 'received') {
        } else {
          connectionState.set(msg.from, 'received')
          requestListeners.forEach(cb => cb({
            fromPeerId: msg.from,
            fromUsername: msg.fromUsername || String(msg.from).slice(0, 8),
          }))
        }
        notifyConnectionListeners()
      }
      return
    }
 
    if (msg.type === 'CONNECTION_ACCEPT') {
      if (peerIdsEqual(msg.to, myProfile?.peerId)) {
        connectionState.set(msg.from, 'connected')
        await saveConnection(msg.from)
        notifyConnectionListeners()
      }
      return
    }
 
    if (msg.type === 'CONNECTION_DECLINE') {
      if (peerIdsEqual(msg.to, myProfile?.peerId)) {
        connectionState.delete(msg.from)
        await deleteConnection(msg.from)
        notifyConnectionListeners()
      }
      return
    }
 
    if (msg.type === 'CONNECTION_STATE_QUERY') {
      if (peerIdsEqual(msg.to, myProfile?.peerId)) {
        const myState = connectionState.get(msg.from) ?? 'none'
        const response = {
          type: 'CONNECTION_STATE_RESPONSE',
          to: msg.from,
          from: myProfile.peerId,
          state: myState,
        }
        await network.sendToNetwork(response)
      }
      return
    }
 
    if (msg.type === 'CONNECTION_STATE_RESPONSE') {
      if (peerIdsEqual(msg.to, myProfile?.peerId)) {
        const theirState = msg.state
        const myState = connectionState.get(msg.from)
 
        if (theirState === 'connected' && myState === 'sent') {
          connectionState.set(msg.from, 'connected')
          await saveConnection(msg.from)
          notifyConnectionListeners()
        } else if (theirState === 'sent' && myState === 'received') {
          connectionState.set(msg.from, 'connected')
          await saveConnection(msg.from)
          const autoAccept = { type: 'CONNECTION_ACCEPT', to: msg.from, from: myProfile.peerId }
          await network.sendToNetwork(autoAccept)
          scheduleRedundantControlSend(autoAccept)
          notifyConnectionListeners()
        }
      }
      return
    }
 
    if (msg.type === 'DIRECT_MESSAGE') {
      console.log('[gossip] DM received → to:', msg.to, '| myPeerId:', myProfile?.peerId, '| match:', peerIdsEqual(msg.to, myProfile?.peerId))
      if (peerIdsEqual(msg.to, myProfile?.peerId)) {
        const time = msg.time ?? Date.now()
        const msgObj = { sender: 'peer', from: msg.from, text: msg.text, time }
        const convId = makeConvId(msg.from, myProfile.peerId)
        saveMessage(convId, msgObj).catch(err => console.warn('[gossip] failed to save DM:', err))
        console.log('[gossip] delivering DM from', msg.from, '— listeners:', directMessageListeners.length)
        directMessageListeners.forEach(cb => cb(msgObj))
      }
      return
    }
 
    if (msg.type === 'PROFILE_DELETE' && msg.peerId) {
      if (peersCache.has(msg.peerId)) {
        peersCache.delete(msg.peerId)
        notifyProfileListeners()
        await network.sendToNetwork(msg)
      }
      return
    }
 
    if (msg.type !== 'PROFILE_GOSSIP' || !msg.profile) return
 
    const profile = msg.profile
 
    if (peerIdsEqual(profile.peerId, myProfile?.peerId)) return
    if (isProfileExpired(profile)) return
 
    const isValid = await verifyProfile(profile)
    if (!isValid) {
      console.warn('[gossip] invalid signature from', from)
      return
    }
 
    const cached = peersCache.get(profile.peerId)
    if (cached && cached.timestamp >= profile.timestamp) {
      if (connectionState.get(profile.peerId) === 'sent') {
        resendPendingConnectionRequest(profile.peerId).catch(() => {})
      }
      return
    }
 
    console.log('[gossip] received profile from', profile.username)
    peersCache.set(profile.peerId, profile)
    setStatus('connected', `Connected — ${peersCache.size} peer(s) found`)
    notifyProfileListeners()
 
    if (connectionState.get(profile.peerId) === 'sent') {
      resendPendingConnectionRequest(profile.peerId).catch(() => {})
    }
 
    await network.sendToNetwork({ type: 'PROFILE_GOSSIP', profile })
  })
 
  // Every so often we need to re broadcast the profile and sync all the connection states and also get
  // rid of all of the peer profiles that are expired

  timers.push(setInterval(() => {
    if (myProfile) {
      broadcastProfile(myProfile)
      flushPendingOutgoingRequests()
      syncConnectionStatesWithPeers()
    }
  }, 5000))
 
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
  }, 10000))
 
  if (myProfile) broadcastProfile(myProfile)
}