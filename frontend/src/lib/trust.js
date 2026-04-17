import { signPayload, verifyPayload } from './crypto'
import { getKeypair, getVouches, saveVouch } from './db'

// We use this function to make an id for the vouch by using the voucher peer id and the subject peer id
export function getVouchId(voucherPeerId, subjectPeerId) {
  return `${voucherPeerId}:${subjectPeerId}`
}

// We make a json stirng out of the vouch object while it is still not yet signed
function serializePayload(unsigned) {
  const sorted = Object.fromEntries(
    Object.entries(unsigned).sort(([a], [b]) => a.localeCompare(b))
  )
  return JSON.stringify(sorted)
}

// Here we finally make the peer vouch and then we get the keypair and we make the signature and sign the vouch
export async function createPeerVouch({ voucherProfile, subjectPeerId, note = '' }) {
  const keypair = await getKeypair()
  if (!keypair?.privateKey) {
    throw new Error('Missing signing keypair for trust vouch.')
  }

  const unsigned = {
    voucherPeerId: voucherProfile.peerId,
    voucherPublicKey: voucherProfile.publicKey,
    subjectPeerId,
    note: note.trim(),
    timestamp: Date.now(),
  }

  const signature = await signPayload(serializePayload(unsigned), keypair.privateKey)
  const vouch = {
    ...unsigned,
    signature,
    id: getVouchId(unsigned.voucherPeerId, unsigned.subjectPeerId),
  }

  await saveVouch(vouch)
  return vouch
}


// We check that the peer is not malformed and that a different peer is correctly signed
export async function verifyPeerVouch(vouch, getProfileByPeerId) {
  if (!vouch?.voucherPeerId || !vouch?.subjectPeerId || !vouch?.voucherPublicKey || !vouch?.signature) {
    return { valid: false, reason: 'Malformed trust vouch.' }
  }

  if (vouch.voucherPeerId === vouch.subjectPeerId) {
    return { valid: false, reason: 'Peers cannot vouch for themselves.' }
  }

  const voucherProfile = getProfileByPeerId(vouch.voucherPeerId)
  if (!voucherProfile) {
    return { valid: false, reason: 'unknown-voucher' }
  }

  if (voucherProfile.publicKey !== vouch.voucherPublicKey) {
    return { valid: false, reason: 'Voucher public key does not match the signed profile.' }
  }

  const { signature, id: _ignored, ...unsigned } = vouch
  const isValidSignature = await verifyPayload(
    serializePayload(unsigned),
    signature,
    vouch.voucherPublicKey
  )

  return {
    valid: isValidSignature,
    reason: isValidSignature ? 'Trust vouch verified.' : 'Invalid trust vouch signature.',
  }
}

export async function loadStoredVouches() {
  return getVouches()
}

// By using the vouches that we have saved we are able to get a trust score fort the peer
export function buildPeerTrust(profile, vouches) {
  const trustedVouches = Array.isArray(vouches) ? vouches : []
  let score = 0
  const reasons = []

  if (trustedVouches.length > 0) {
    score += Math.min(0.3, trustedVouches.length * 0.1)
    reasons.push(`${trustedVouches.length} peer vouch${trustedVouches.length === 1 ? '' : 'es'}`)
  }

  const normalizedScore = Math.min(1, score)

  return {
    score: normalizedScore,
    level: normalizedScore >= 0.75 ? 'high' : normalizedScore >= 0.45 ? 'medium' : 'low',
    label: trustedVouches.length > 0 ? 'Peer vouched' : 'Unverified',
    reasons,
    vouchCount: trustedVouches.length,
  }
}
