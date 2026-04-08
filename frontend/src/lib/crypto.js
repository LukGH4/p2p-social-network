// Web Crypto API — ECDSA P-256 keypair generation, signing, and verification.

const ALGO = { name: 'ECDSA', namedCurve: 'P-256' }
const SIGN_ALGO = { name: 'ECDSA', hash: { name: 'SHA-256' } }

// Generate a keypair. Private key is non-extractable; public key is exported as base64.
export async function generateKeyPair() {
  const keypair = await window.crypto.subtle.generateKey(ALGO, false, ['sign', 'verify'])
  const publicKeyBase64 = await exportPublicKey(keypair.publicKey)
  return { publicKey: keypair.publicKey, privateKey: keypair.privateKey, publicKeyBase64 }
}

export async function exportPublicKey(publicKey) {
  const spki = await window.crypto.subtle.exportKey('spki', publicKey)
  return bufToBase64(spki)
}

export async function importPublicKey(publicKeyBase64) {
  const spki = base64ToBuf(publicKeyBase64)
  return window.crypto.subtle.importKey('spki', spki, ALGO, true, ['verify'])
}

// Sign a UTF-8 payload string, returns base64 signature.
export async function signPayload(payload, privateKey) {
  const data = new TextEncoder().encode(payload)
  const sig = await window.crypto.subtle.sign(SIGN_ALGO, privateKey, data)
  return bufToBase64(sig)
}

// Verify a base64 signature against a payload string and base64 public key.
export async function verifyPayload(payload, signatureBase64, publicKeyBase64) {
  try {
    const publicKey = await importPublicKey(publicKeyBase64)
    const data = new TextEncoder().encode(payload)
    const sig = base64ToBuf(signatureBase64)
    return window.crypto.subtle.verify(SIGN_ALGO, publicKey, sig, data)
  } catch {
    return false
  }
}

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBuf(b64) {
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}
