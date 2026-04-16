import { P2PNetwork } from '../../../p2p/src/network.js'
import { verifyProfile, isProfileExpired } from './profile.js'
import { verifyBlockchainIdentity } from './blockchain.js'
import {
  buildPeerTrust,
  createPeerVouch,
  getVouchId,
  loadStoredVouches,
  verifyPeerVouch,
} from './trust.js'

const peersCache = new Map()
const trustCache = new Map()
const vouchCache = new Map()
const pendingVouches = new Map()
const listeners = []

let network = null
let myProfile = null
let timers = []

export async function initGossipNetwork(localProfile) {
  if (network) return

  myProfile = localProfile
  await refreshLocalTrust(localProfile)

  network = new P2PNetwork({
    bootstrapAddr: '/ip4/127.0.0.1/tcp/4012/ws',
  })

  await network.start()
  await restoreStoredVouches()

  network.onMessage(async (msg, from) => {
    if (msg.type === 'PROFILE_DELETE' && msg.peerId) {
      handleProfileDeletion(msg.peerId)
      await network.sendToNetwork(msg)
      return
    }

    if (msg.type === 'TRUST_VOUCH' && msg.vouch) {
      await handleIncomingVouch(msg.vouch, from)
      return
    }

    if (msg.type === 'PROFILE_GOSSIP' && msg.profile) {
      await handleIncomingProfile(msg.profile, from)
    }
  })

  timers.push(setInterval(() => {
    if (myProfile) broadcastProfile(myProfile)
  }, 15_000))

  timers.push(setInterval(() => {
    let changed = false
    for (const [peerId, profile] of peersCache.entries()) {
      if (isProfileExpired(profile)) {
        peersCache.delete(peerId)
        trustCache.delete(peerId)
        changed = true
      }
    }
    if (changed) notifyListeners()
  }, 10_000))

  if (myProfile) broadcastProfile(myProfile)
}

export async function broadcastProfile(profile) {
  myProfile = profile
  await refreshLocalTrust(profile)

  if (!network) return

  await network.sendToNetwork({
    type: 'PROFILE_GOSSIP',
    profile: myProfile,
  })
}

export async function broadcastDeletion() {
  if (!network || !myProfile) return

  await network.sendToNetwork({
    type: 'PROFILE_DELETE',
    peerId: myProfile.peerId,
  })

  myProfile = null
}

export function getKnownProfiles() {
  return Array.from(peersCache.values()).map(profile => ({
    ...profile,
    trust: getPeerTrust(profile.peerId),
  }))
}

export function getPeerTrust(peerId) {
  const profile = getProfileByPeerId(peerId)
  if (!profile) {
    return buildPeerTrust(null, null, [])
  }

  const trustedVouches = getTrustedVouches(peerId)
  return buildPeerTrust(profile, trustCache.get(peerId), trustedVouches)
}

export function hasVouchedForPeer(subjectPeerId) {
  if (!myProfile?.peerId) return false
  return vouchCache.get(subjectPeerId)?.has(myProfile.peerId) ?? false
}

export async function vouchForPeer(subjectPeerId, note = '') {
  if (!myProfile) {
    throw new Error('You must have a profile before vouching for peers.')
  }

  const myTrust = trustCache.get(myProfile.peerId)
  if (!myTrust?.verified) {
    throw new Error('Link and verify a wallet before issuing trust vouches.')
  }

  if (subjectPeerId === myProfile.peerId) {
    throw new Error('You cannot vouch for yourself.')
  }

  const existing = vouchCache.get(subjectPeerId)?.get(myProfile.peerId)
  if (existing) return existing

  const vouch = await createPeerVouch({
    voucherProfile: myProfile,
    subjectPeerId,
    note,
  })

  cacheVouch(vouch)
  notifyListeners()

  if (network) {
    await network.sendToNetwork({
      type: 'TRUST_VOUCH',
      vouch,
    })
  }

  return vouch
}

export function onPeerProfile(callback) {
  listeners.push(callback)
  return () => {
    const i = listeners.indexOf(callback)
    if (i !== -1) listeners.splice(i, 1)
  }
}

async function handleIncomingProfile(profile, from) {
  if (profile.peerId === network.getPeerId()) return
  if (isProfileExpired(profile)) return

  const isValidProfile = await verifyProfile(profile)
  if (!isValidProfile) {
    console.warn(`[Gossip] Invalid signature from ${from}`)
    return
  }

  const identityStatus = await verifyBlockchainIdentity(profile)
  if (profile.blockchainIdentity && !identityStatus.verified) {
    console.warn(`[Gossip] Rejected blockchain identity from ${from}: ${identityStatus.reason}`)
    return
  }

  const cached = peersCache.get(profile.peerId)
  if (cached && cached.timestamp >= profile.timestamp) return

  peersCache.set(profile.peerId, profile)
  trustCache.set(profile.peerId, identityStatus)

  await processPendingVouches(profile.peerId)
  notifyListeners()

  await network.sendToNetwork({ type: 'PROFILE_GOSSIP', profile })
}

async function handleIncomingVouch(vouch, from) {
  const vouchId = getVouchId(vouch.voucherPeerId, vouch.subjectPeerId)
  const subjectCache = vouchCache.get(vouch.subjectPeerId)
  const cached = subjectCache?.get(vouch.voucherPeerId)
  if (cached && cached.timestamp >= vouch.timestamp) return

  const result = await verifyPeerVouch(vouch, getProfileByPeerId)
  if (!result.valid) {
    if (result.reason === 'unknown-voucher') {
      pendingVouches.set(vouchId, vouch)
    } else {
      console.warn(`[Gossip] Rejected trust vouch from ${from}: ${result.reason}`)
    }
    return
  }

  cacheVouch(vouch)
  pendingVouches.delete(vouchId)
  notifyListeners()

  await network.sendToNetwork({
    type: 'TRUST_VOUCH',
    vouch,
  })
}

function handleProfileDeletion(peerId) {
  if (!peersCache.has(peerId)) return

  peersCache.delete(peerId)
  trustCache.delete(peerId)
  notifyListeners()
}

function getProfileByPeerId(peerId) {
  if (myProfile?.peerId === peerId) return myProfile
  return peersCache.get(peerId) ?? null
}

function getTrustedVouches(subjectPeerId) {
  const subjectVouches = vouchCache.get(subjectPeerId)
  if (!subjectVouches) return []

  return Array.from(subjectVouches.values()).filter(vouch => {
    const voucherTrust = trustCache.get(vouch.voucherPeerId)
    return Boolean(voucherTrust?.verified)
  })
}

function cacheVouch(vouch) {
  let subjectVouches = vouchCache.get(vouch.subjectPeerId)
  if (!subjectVouches) {
    subjectVouches = new Map()
    vouchCache.set(vouch.subjectPeerId, subjectVouches)
  }

  subjectVouches.set(vouch.voucherPeerId, {
    ...vouch,
    id: getVouchId(vouch.voucherPeerId, vouch.subjectPeerId),
  })
}

async function processPendingVouches(voucherPeerId) {
  for (const [id, vouch] of pendingVouches.entries()) {
    if (vouch.voucherPeerId !== voucherPeerId) continue

    const result = await verifyPeerVouch(vouch, getProfileByPeerId)
    if (result.valid) {
      cacheVouch(vouch)
      pendingVouches.delete(id)
    }
  }
}

async function refreshLocalTrust(profile) {
  if (!profile?.peerId) return
  trustCache.set(profile.peerId, await verifyBlockchainIdentity(profile))
}

async function restoreStoredVouches() {
  const storedVouches = await loadStoredVouches()
  const validVouches = []

  for (const vouch of storedVouches) {
    const result = await verifyPeerVouch(vouch, getProfileByPeerId)
    if (!result.valid) continue
    cacheVouch(vouch)
    validVouches.push(vouch)
  }

  if (!network) return

  for (const vouch of validVouches) {
    await network.sendToNetwork({
      type: 'TRUST_VOUCH',
      vouch,
    })
  }
}

function notifyListeners() {
  const allProfiles = getKnownProfiles()
  listeners.forEach(cb => cb(allProfiles))
}
