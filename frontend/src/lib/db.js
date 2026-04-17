// IndexedDB storage via idb. Database: 'findyourpeer-db'.

import { openDB } from 'idb'

const DB_NAME = 'findyourpeer-db'
const DB_VERSION = 3

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles')
        if (!db.objectStoreNames.contains('keypairs')) db.createObjectStore('keypairs')
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('connections')) db.createObjectStore('connections')
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true })
          msgStore.createIndex('by_conversation', 'conversationId')
        }
      }
    },
  })
}

// Profile store

export async function saveProfile(profile) {
  const db = await getDB()
  await db.put('profiles', profile, 'myProfile')
}

export async function getProfile() {
  const db = await getDB()
  return (await db.get('profiles', 'myProfile')) ?? null
}

export async function deleteProfile() {
  const db = await getDB()
  await db.delete('profiles', 'myProfile')
}

// Keypair store — CryptoKey objects are stored via structured clone

export async function saveKeypair(keypair) {
  const db = await getDB()
  await db.put('keypairs', keypair, 'myKeypair')
}

export async function getKeypair() {
  const db = await getDB()
  return (await db.get('keypairs', 'myKeypair')) ?? null
}

export async function deleteKeypair() {
  const db = await getDB()
  await db.delete('keypairs', 'myKeypair')
}

// Connections store — persists mutually-accepted peer connections across reloads

export async function saveConnection(peerId) {
  const db = await getDB()
  await db.put('connections', { peerId, connectedAt: Date.now() }, peerId)
}

export async function deleteConnection(peerId) {
  const db = await getDB()
  await db.delete('connections', peerId)
}

export async function getConnections() {
  const db = await getDB()
  return db.getAll('connections')
}

// Messages store — persists chat messages across navigation and reloads
// conversationId = [peerA, peerB].sort().join('|')
// sender: 'me' | 'peer'

export async function saveMessage(conversationId, msg) {
  const db = await getDB()
  const { sender, from, text, time } = msg
  await db.add('messages', { conversationId, sender, from, text, time })
}

export async function getMessages(conversationId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('messages', 'by_conversation', conversationId)
  // Sort by time ascending (IDB doesn't guarantee order)
  return all.sort((a, b) => a.time - b.time)
}
