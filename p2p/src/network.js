import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { lpStream } from '@libp2p/utils'
import { webSockets } from '@libp2p/websockets'
import { multiaddr } from '@multiformats/multiaddr'
import { createLibp2p } from 'libp2p'

const RAW_PROTOCOL = '/findyourpeer/raw/1.0.0'
const DISCOVERY_PROTOCOL = '/findyourpeer/discovery/1.0.0'
const BROADCAST_PROTOCOL = '/findyourpeer/broadcast/1.0.0'
const DISCOVERY_INTERVAL_MS = 5_000
const RELAY_ADDR_TIMEOUT_MS = 10_000

const relay = circuitRelayTransport({ discoverRelays: 1 })

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function encodeJson(value) {
  return encoder.encode(JSON.stringify(value))
}

function decodeChunk(chunk) {
  return JSON.parse(decoder.decode(chunk.subarray()))
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class P2PNetwork {
  constructor({ bootstrapAddr } = {}) {
    this.bootstrapAddr = bootstrapAddr
    this.bootstrapPeerId = null
    this.node = null
    this.knownPeers = new Map()
    this.connectedPeers = new Set()
    this.messageHandlers = []
    this.discoveryTimer = null
  }

  async start() {
    // We are calling the function to make the lib p2p node
    this.node = await createLibp2p({
      addresses: {
        listen: ['/p2p-circuit']
      },
      transports: [
        webSockets({ filter: (multiaddrs) => multiaddrs }),
        relay
      ],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      services: {
        identify: identify()
      },
      connectionGater: {
        denyDialMultiaddr: async () => false,
      }
    })

    // When we receive messages we hanle by moving to the handlers
    this.node.handle(
      RAW_PROTOCOL,
      async (stream, connection) => {
        const channel = lpStream(stream)
        const chunk = await channel.read()
        if (chunk == null) return
        const payload = decodeChunk(chunk)
        const from = connection.remotePeer.toString()
        for (const cb of this.messageHandlers) {
          cb(payload, from)
        }
      },
      { runOnLimitedConnection: true }
    )

    this.node.addEventListener('peer:connect', evt => {
      const peerId = (evt.detail?.remotePeer ?? evt.detail)?.toString()
      if (peerId && peerId !== this.bootstrapPeerId) {
        // We are still keeping track of all of the connected peers by using tje peer ID
        this.connectedPeers.add(peerId)
        const addrs = this.getListenAddrs()
        if (addrs.some(a => a.includes('/p2p-circuit'))) {
          this.refreshPeers().catch(() => {})
        }
      }
    })

    this.node.addEventListener('peer:disconnect', evt => {
      const peerId = (evt.detail?.remotePeer ?? evt.detail)?.toString()
      if (peerId) this.connectedPeers.delete(peerId)
    })

    await this.node.start()

    if (!this.bootstrapAddr) return

    const connection = await this.node.dial(multiaddr(this.bootstrapAddr))
    this.bootstrapPeerId = connection.remotePeer.toString()
    this.connectedPeers.delete(this.bootstrapPeerId)

    await this.waitForRelayAddress()

    for (let i = 0; i < 5; i++) {
      await delay(1500)
      await this.refreshPeers()
    }

    // We use this timer to keep updating the peers at a regular freq
    this.discoveryTimer = setInterval(() => {
      this.refreshPeers().catch(err => {
        console.error('peer discovery refresh failed:', err.message)
      })
    }, DISCOVERY_INTERVAL_MS)
  }

  getPeerId() {
    return this.node.peerId.toString()
  }

  getListenAddrs() {
    return this.node.getMultiaddrs().map(a => a.toString())
  }

  getConnectedPeers() {
    return Array.from(this.connectedPeers)
  }

  onMessage(callback) {
    this.messageHandlers.push(callback)
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== callback)
    }
  }

  async sendToNetwork(payload) {
    const connections = this.node.getConnections()
    const sent = new Set()

    for (const conn of connections) {
      const peerId = conn.remotePeer.toString()
      if (peerId === this.bootstrapPeerId || sent.has(peerId)) continue
      sent.add(peerId)

      try {
        const stream = await this.node.dialProtocol(
          conn.remotePeer,
          RAW_PROTOCOL,
          { runOnLimitedConnection: true }
        )
        const channel = lpStream(stream)
        await channel.write(encodeJson(payload))
        await stream.close()
      } catch (err) {
        console.error(`failed to send to ${peerId}:`, err.message)
      }
    }
  }

  async stop() {
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer)
      this.discoveryTimer = null
    }
    if (this.node) await this.node.stop()
  }

  async waitForRelayAddress() {
    const deadline = Date.now() + RELAY_ADDR_TIMEOUT_MS
    while (Date.now() < deadline) {
      const relayAddrs = this.getListenAddrs().filter(a => a.includes('/p2p-circuit'))
      if (relayAddrs.length > 0) return relayAddrs
      await delay(250)
    }
    console.warn('Timed out waiting for relay address (safe to ignore for local testing)')
    return []
  }

  async refreshPeers() {
    if (!this.bootstrapAddr) return

    const request = {
      type: 'register',
      peerId: this.getPeerId(),
      addresses: this.getListenAddrs().filter(a => a.includes('/p2p-circuit'))
    }

    let stream
    try {

      // Here we are sending the message to all of the peers we are connected to
      stream = await this.node.dialProtocol(
        multiaddr(this.bootstrapAddr),
        DISCOVERY_PROTOCOL
      )
    } catch (err) {
      return
    }

    const channel = lpStream(stream)

    try {
      await channel.write(encodeJson(request))

      const responseChunk = await channel.read()
      await stream.close()

      if (responseChunk == null) return

      const response = decodeChunk(responseChunk)

      for (const peer of response.peers ?? []) {
        if (peer.peerId === this.getPeerId() || peer.peerId === this.bootstrapPeerId) continue

        // This is used to connect and then keep a saved record of the peers
        this.knownPeers.set(peer.peerId, peer)

        if (this.connectedPeers.has(peer.peerId)) continue

        if (peer.addresses.length > 0) {
          try {
            await this.node.dial(multiaddr(peer.addresses[0]))
          } catch (err) {
            if (!err.message.includes('NO_RESERVATION')) {
              console.error(`failed to connect to ${peer.peerId}:`, err.message)
            }
          }
        }
      }
    } catch (err) {
      try { await stream.close() } catch (_) {}
    }
  }
}

export { BROADCAST_PROTOCOL, DISCOVERY_PROTOCOL, RAW_PROTOCOL }
