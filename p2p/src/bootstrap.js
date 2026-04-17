import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { lpStream } from '@libp2p/utils'
import { webSockets } from '@libp2p/websockets'
import { createLibp2p } from 'libp2p'
import { DISCOVERY_PROTOCOL } from './network.js'

const STALE_PEER_MS = 30_000
const listenPort = Number(process.env.BOOTSTRAP_PORT ?? 4012)

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// We want to keep a registry so that we can keep a map of all of the peers that are active
const registry = new Map()
const connectedPeers = new Set()

function encodeJson(value) {
  return encoder.encode(JSON.stringify(value))
}

function decodeChunk(chunk) {
  return JSON.parse(decoder.decode(chunk.subarray()))
}

// We want to be abel to remove / prune all of the peers that have been non active for too long
function pruneRegistry() {
  const cutoff = Date.now() - STALE_PEER_MS
  for (const [peerId, entry] of registry.entries()) {
    if (entry.lastSeen < cutoff) {
      registry.delete(peerId)
      connectedPeers.delete(peerId)
    }
  }
}

// We are using the create lib p2p function make our bootstrpa node
const node = await createLibp2p({
  addresses: {
    listen: [`/ip4/0.0.0.0/tcp/${listenPort}/ws`]
  },
  transports: [webSockets()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  connectionGater: {
    denyDialMultiaddr: async () => false,
  },
  services: {
    identify: identify(),
    relay: circuitRelayServer({
      reservations: {
        maxReservations: 100,
        maxReservationsPerIP: 100,
        applyDefaultLimit: false
      }
    })
  }
})

node.addEventListener('peer:connect', (evt) => {
  const id = (evt.detail?.remotePeer ?? evt.detail).toString()
  // For our record wee are keeping track of all of the peers that we have connected
  connectedPeers.add(id)
})

node.addEventListener('peer:disconnect', (evt) => {
  const id = (evt.detail?.remotePeer ?? evt.detail).toString()
  connectedPeers.delete(id)
})

// We are using handle to take care of when peers join so we can send out a list of the peers taht are available
node.handle(DISCOVERY_PROTOCOL, async (stream) => {
  const channel = lpStream(stream)
  const requestChunk = await channel.read()

  if (requestChunk == null) {
    await stream.close()
    return
  }

  const request = decodeChunk(requestChunk)

  if (request.type === 'register' && request.peerId) {
    registry.set(request.peerId, {
      peerId: request.peerId,
      addresses: request.addresses ?? [],
      lastSeen: Date.now()
    })
  }

  pruneRegistry()

  const peers = Array.from(registry.values()).map(({ peerId, addresses }) => ({
    peerId,
    addresses,
    connected: connectedPeers.has(peerId)
  }))


  // Sending out the list of the peers

  await channel.write(encodeJson({ peers }))
  await stream.close()
})

await node.start()

console.log('BOOTSTRAP NODE STARTED')
console.log('Peer ID:', node.peerId.toString())
console.log('Listening on:')
for (const addr of node.getMultiaddrs()) {
  console.log(addr.toString())
}
