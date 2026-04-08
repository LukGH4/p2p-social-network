// Part 2: Identity & Profile Management
// Clean interface for the gossip layer (Part 3):
//   createProfile, signProfile, verifyProfile, isProfileExpired, getStoredProfile

import { generateKeyPair, exportPublicKey, signPayload, verifyPayload } from './crypto'
import { saveProfile, getProfile, saveKeypair, getKeypair } from './db'
import { INTEREST_SCHEMA } from '../schema/interestSchema'

export const DEFAULT_TTL_MS = 3_600_000

// Convert { genre: ['action', 'scifi'], era: ['2010s'], ... } to a flat { action: 1, scifi: 1, '2010s': 1, ... }
function buildInterestVector(selectedTags) {
  const vector = {}
  for (const category of Object.keys(INTEREST_SCHEMA)) {
    for (const tag of Object.keys(INTEREST_SCHEMA[category].tags)) {
      vector[tag] = (selectedTags[category] || []).includes(tag) ? 1 : 0
    }
  }
  return vector
}

// Serialize the signable payload — sorted keys for deterministic output
function serializePayload(unsigned) {
  const sorted = Object.fromEntries(
    Object.entries(unsigned).sort(([a], [b]) => a.localeCompare(b))
  )
  return JSON.stringify(sorted)
}

// Stamps timestamp and ttl onto a profile object before signing
export function createTTLProfile(base, ttlMs = DEFAULT_TTL_MS) {
  return { ...base, timestamp: Date.now(), ttl: ttlMs }
}

// Load or generate the user's keypair from IndexedDB
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

export async function signProfile(unsigned, privateKey) {
  const payload = serializePayload(unsigned)
  const signature = await signPayload(payload, privateKey)
  return { ...unsigned, signature }
}

// Part 3 calls this on every incoming profile before caching
export async function verifyProfile(signedProfile) {
  const { signature, ...unsigned } = signedProfile
  const payload = serializePayload(unsigned)
  return verifyPayload(payload, signature, signedProfile.publicKey)
}

// Part 3 calls this when deciding whether to cache or drop a received profile
export function isProfileExpired(profile) {
  return Date.now() > profile.timestamp + profile.ttl
}

export async function getStoredProfile() {
  return getProfile()
}

// Full flow: load/generate keypair → build profile → stamp TTL → sign → persist
export async function createProfile(formData, peerId) {
  const { publicKey: _pk, privateKey, publicKeyBase64 } = await loadOrCreateKeypair()

  const base = {
    peerId,
    username: formData.username.trim(),
    bio: formData.bio.trim(),
    interestVector: buildInterestVector(formData.selectedTags),
    publicKey: publicKeyBase64,
  }

  const unsigned = createTTLProfile(base)
  const signed = await signProfile(unsigned, privateKey)
  await saveProfile(signed)
  return signed
}
