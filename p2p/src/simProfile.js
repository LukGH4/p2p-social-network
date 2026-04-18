import { webcrypto } from 'crypto'

const subtle = webcrypto.subtle
const ALGO = { name: 'ECDSA', namedCurve: 'P-256' }
const SIGN_ALGO = { name: 'ECDSA', hash: { name: 'SHA-256' } }

const b64 = buf => Buffer.from(buf).toString('base64')

function serializePayload(unsigned) {
  const sorted = Object.fromEntries(
    Object.entries(unsigned).sort(([a], [b]) => a.localeCompare(b))
  )
  return JSON.stringify(sorted)
}

async function generateKeypair() {
  const kp = await subtle.generateKey(ALGO, true, ['sign', 'verify'])
  const spki = await subtle.exportKey('spki', kp.publicKey)
  return { privateKey: kp.privateKey, publicKeyBase64: b64(spki) }
}

async function signProfile(unsigned, privateKey) {
  const data = new TextEncoder().encode(serializePayload(unsigned))
  const sig = await subtle.sign(SIGN_ALGO, privateKey, data)
  return { ...unsigned, signature: b64(sig) }
}

function makePeerId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'
  let s = '12D3KooW'
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

const GENRES = ['action', 'thriller', 'romance', 'scifi', 'comedy', 'drama']
const ERAS = ['1990s', '2000s', '2010s', '2020s']
const RATINGS = ['G', 'PG', 'PG13', 'R']
const RUNTIMES = ['under_90_min', '90_to_120_min', '120_to_150_min']
const LANGUAGES = ['english', 'spanish', 'french']

const BIOS = ['cs class', 'film club', 'weekend watcher']

function tagsAt(i) {
  const g1 = GENRES[i % GENRES.length]
  const g2 = GENRES[(i + 3) % GENRES.length]
  return {
    genre: { [g1]: 1, [g2]: 1 },
    era: { [ERAS[i % ERAS.length]]: 1 },
    rating: { [RATINGS[i % RATINGS.length]]: 1 },
    runtime: { [RUNTIMES[i % RUNTIMES.length]]: 1 },
    language: { [LANGUAGES[i % LANGUAGES.length]]: 1 }
  }
}

export async function generateSimProfile(i) {
  const { privateKey, publicKeyBase64 } = await generateKeypair()
  const username = `user${String(i).padStart(3, '0')}`
  const unsigned = {
    peerId: makePeerId(),
    username,
    bio: BIOS[i % BIOS.length],
    tags: tagsAt(i),
    publicKey: publicKeyBase64,
    timestamp: Date.now(),
    ttl: 3_600_000
  }
  return signProfile(unsigned, privateKey)
}
