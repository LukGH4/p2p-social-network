import { signPayload, verifyPayload } from './crypto'
import { getKeypair, getVouches, saveVouch } from './db'

export function getVouchId(voucherPeerId, subjectPeerId) {
  return `${voucherPeerId}:${subjectPeerId}`
}

function serializePayload(unsigned) {
  const sorted = Object.fromEntries(
    Object.entries(unsigned).sort(([a], [b]) => a.localeCompare(b))
  )
  return JSON.stringify(sorted)
}

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

export function buildPeerTrust(profile, identityStatus, vouches) {
  const trustedVouches = Array.isArray(vouches) ? vouches : []
  let score = 0
  const reasons = []

  if (identityStatus?.verified) {
    score += identityStatus.ensName ? 0.7 : 0.55
    reasons.push(identityStatus.ensName ? 'ENS-backed wallet' : 'Wallet-backed identity')
  } else if (profile?.blockchainIdentity) {
    reasons.push('Wallet claim could not be verified')
  }

  if (trustedVouches.length > 0) {
    score += Math.min(0.3, trustedVouches.length * 0.1)
    reasons.push(`${trustedVouches.length} peer vouch${trustedVouches.length === 1 ? '' : 'es'}`)
  }

  const normalizedScore = Math.min(1, score)

  return {
    score: normalizedScore,
    level: normalizedScore >= 0.75 ? 'high' : normalizedScore >= 0.45 ? 'medium' : 'low',
    label: getTrustLabel(identityStatus, trustedVouches.length),
    reasons,
    vouchCount: trustedVouches.length,
    walletAddress: identityStatus?.walletAddress ?? profile?.blockchainIdentity?.walletAddress ?? null,
    ensName: identityStatus?.ensName ?? profile?.blockchainIdentity?.ensName ?? null,
    identityVerified: Boolean(identityStatus?.verified),
  }
}

function getTrustLabel(identityStatus, vouchCount) {
  if (identityStatus?.ensName) return 'ENS verified'
  if (identityStatus?.verified) return 'Wallet verified'
  if (vouchCount > 0) return 'Peer vouched'
  return 'Unverified'
}
