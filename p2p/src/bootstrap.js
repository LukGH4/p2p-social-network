import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { lpStream } from '@libp2p/utils'
import { webSockets } from '@libp2p/websockets'
import { createLibp2p } from 'libp2p'
import { BROADCAST_PROTOCOL, DISCOVERY_PROTOCOL, RAW_PROTOCOL } from './network.js'

const STALE_PEER_MS = 30_000

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const registry = new Map()

function encodeJson(value) {
  return encoder.encode(JSON.stringify(value))
}

function decodeChunk(chunk) {
  return JSON.parse(decoder.decode(chunk.subarray()))
}

function pruneRegistry() {
  const cutoff = Date.now() - STALE_PEER_MS

  for (const [peerId, entry] of registry.entries()) {
    if (entry.lastSeen < cutoff) {
      registry.delete(peerId)
    }
  }
}

const node = await createLibp2p({
  addresses: {
    listen: ['/ip4/0.0.0.0/tcp/4012/ws']
  },
  transports: [
    webSockets()
  ],
  connectionEncrypters: [
    noise()
  ],
  streamMuxers: [
    yamux()
  ],
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

node.handle(DISCOVERY_PROTOCOL, async (stream) => {
  const channel = lpStream(stream)
  const requestChunk = await channel.read()

  if (requestChunk == null) {
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
    addresses
  }))

  await channel.write(encodeJson({ peers }))
  await stream.close()
})

// handler(stream, connection) — two separate args per libp2p v3 API
node.handle(BROADCAST_PROTOCOL, async (stream, connection) => {
  const channel = lpStream(stream)
  const chunk = await channel.read()
  if (!chunk) {
    await stream.close()
    return
  }
  const payload = decodeChunk(chunk)
  const senderPeerId = connection.remotePeer
  for (const peerId of node.getPeers()) {
    if (peerId.equals(senderPeerId)) continue
    try {
      const outStream = await node.dialProtocol(peerId, RAW_PROTOCOL)
      const outChannel = lpStream(outStream)
      await outChannel.write(encodeJson(payload))
      await outStream.close()
    } catch (err) {
      console.error(`[broadcast] forward to ${peerId} failed:`, err.message)
    }
  }
  await stream.close()
})

await node.start()

console.log('BOOTSTRAP NODE STARTED')
console.log('Peer ID:', node.peerId.toString())
console.log('Listening on:')
for (const addr of node.getMultiaddrs()) {
  console.log(addr.toString())
}
