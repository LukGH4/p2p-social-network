import { generateKeyPair, exportPublicKey, signPayload, verifyPayload } from './crypto'
import { saveProfile, getProfile, saveKeypair, getKeypair } from './db'
import { tagsToProfile } from '../schema/interestSchema'

export const DEFAULT_TTL_MS = 3_600_000


function serializePayload(unsigned) {
  const sorted = Object.fromEntries(
    Object.entries(unsigned).sort(([a], [b]) => a.localeCompare(b))
  )
  return JSON.stringify(sorted)
}


// We are using this to put a timestamp and set a specific time to live value for the profile
export function createTTLProfile(base, ttlMs = DEFAULT_TTL_MS) {
  return { ...base, timestamp: Date.now(), ttl: ttlMs }
}


// We do this to get the existing keypair or making a new generated key pair which we will use for the identity
async function loadOrCreateKeypair() {
  const existing = await getKeypair()
  if (existing) {
    const publicKeyBase64 = await exportPublicKey(existing.publicKey)
    return { ...existing, publicKeyBase64 }
  }
  const keypair = await generateKeyPair()
  await saveKeypair({ publicKey: keypair.publicKey, privateKey: keypair.privateKey })
  return keypair
}

export async function getOrCreateIdentityMaterial() {
  const { publicKeyBase64 } = await loadOrCreateKeypair()
  return { publicKeyBase64 }
}

// Using the private key as per the convention we are signing the profile using the private key
export async function signProfile(unsigned, privateKey) {
  const payload = serializePayload(unsigned)
  const signature = await signPayload(payload, privateKey)
  return { ...unsigned, signature }
}


// We use the public key to check properly if the profile signature is valid and correct
export async function verifyProfile(signedProfile) {
  const { signature, ...unsigned } = signedProfile
  const payload = serializePayload(unsigned)
  return verifyPayload(payload, signature, signedProfile.publicKey)
}


export function isProfileExpired(profile) {
  return Date.now() > profile.timestamp + profile.ttl
}

export async function getStoredProfile() {
  return getProfile()
}


// We make the profile by first creating the profile and then signing the profile and then saving the profile
export async function createProfile(formData, peerId) {
  const { publicKey: _pk, privateKey, publicKeyBase64 } = await loadOrCreateKeypair()

  const base = {
    peerId,
    username: formData.username.trim(),
    bio: formData.bio.trim(),
    tags: tagsToProfile(formData.selectedTags),
    publicKey: publicKeyBase64,
  }

  const unsigned = createTTLProfile(base)
  const signed = await signProfile(unsigned, privateKey)
  await saveProfile(signed)
  return signed
}
