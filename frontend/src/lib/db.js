// IndexedDB storage via idb. Database: 'findyourpeer-db'.

import { openDB } from 'idb'

const DB_NAME = 'findyourpeer-db'
const DB_VERSION = 1

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles')
      if (!db.objectStoreNames.contains('keypairs')) db.createObjectStore('keypairs')
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
