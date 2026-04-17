// Web Crypto API

// We are setting up the configs for the key generation with the encryption type
const ALGO = { name: 'ECDSA', namedCurve: 'P-256' }

// We are setting up the configs for teh signing
const SIGN_ALGO = { name: 'ECDSA', hash: { name: 'SHA-256' } }


// We are making a key pair which makes a private and a public keys
export async function generateKeyPair() {
  const keypair = await window.crypto.subtle.generateKey(ALGO, false, ['sign', 'verify'])
  const publicKeyBase64 = await exportPublicKey(keypair.publicKey)
  return { publicKey: keypair.publicKey, privateKey: keypair.privateKey, publicKeyBase64 }
}

// We want to be able to send out the public key
export async function exportPublicKey(publicKey) {
  const spki = await window.crypto.subtle.exportKey('spki', publicKey)
  return bufToBase64(spki)
}

// We want to get the public kep and convert it so we can use it
export async function importPublicKey(publicKeyBase64) {
  const spki = base64ToBuf(publicKeyBase64)
  return window.crypto.subtle.importKey('spki', spki, ALGO, true, ['verify'])
}

// We want to signt eh messagee by using the private key
export async function signPayload(payload, privateKey) {
  const data = new TextEncoder().encode(payload)
  const sig = await window.crypto.subtle.sign(SIGN_ALGO, privateKey, data)
  return bufToBase64(sig)
}

// We verify the message by checking by using the pbulic key
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

// We use these functions to convery from binary to the base 64 strings
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
