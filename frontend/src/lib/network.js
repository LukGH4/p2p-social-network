import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'

const relay = circuitRelayTransport({
  discoverRelays: 1
})
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

function getPeerIdFromEvent(event) {
  const peer = event.detail?.remotePeer ?? event.detail
  return typeof peer?.toString === 'function' ? peer.toString() : null
}

export class P2PNetwork {
  constructor({ bootstrapAddr } = {}) {
    this.bootstrapAddr = bootstrapAddr
    this.bootstrapPeerId = null
    this.node = null
    this.knownPeers = new Map()
    this.connectedPeers = new Set()
    this.messageHandlers = []
    this.peerConnectHandlers = []
    this.discoveryTimer = null
  }

  async start() {
    this.node = await createLibp2p({
      addresses: {
        listen: ['/p2p-circuit']
      },
      transports: [
        webSockets({filter: (multiaddrs) => multiaddrs}),
        relay
      ],
      connectionEncrypters: [
        noise()
      ],
      streamMuxers: [
        yamux()
      ],
      services: {
        identify: identify()
      },
      connectionGater: {
        denyDialMultiaddr: async () => false,
      }
    })

    this.node.handle(
      RAW_PROTOCOL,
      async (stream, connection) => {
        const from = connection.remotePeer.toString()
        const channel = lpStream(stream)
        try {
          const chunk = await channel.read()
          if (chunk == null) return
          const payload = decodeChunk(chunk)
          for (const callback of this.messageHandlers) {
            callback(payload, from)
          }
        } catch (err) {
          // stream errors are non-fatal
        } finally {
          try { await stream.close() } catch (_) {}
        }
      },
      {
        runOnLimitedConnection: true
      }
    )

    this.node.addEventListener('peer:connect', evt => {
      const peerId = getPeerIdFromEvent(evt)
      if (peerId && peerId !== this.bootstrapPeerId) {
        this.connectedPeers.add(peerId)
        for (const cb of this.peerConnectHandlers) cb(peerId)

        const addrs = this.getListenAddrs()
        if (addrs.some(a => a.includes('/p2p-circuit'))) {
          this.registerWithBootstrap().catch(() => {})
        }
      }
    })

    this.node.addEventListener('peer:disconnect', evt => {
      const peerId = getPeerIdFromEvent(evt)
      if (peerId) {
        this.connectedPeers.delete(peerId)
      }
    })

    await this.node.start()

    if (!this.bootstrapAddr) {
      return
    }

    let connection
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        connection = await this.node.dial(multiaddr(this.bootstrapAddr))
        break
      } catch (err) {
        if (attempt < 2) {
          await delay(500 * (attempt + 1))
        } else {
          console.error('[p2p] bootstrap connection failed:', err.message)
          throw new Error('Bootstrap unreachable: ' + err.message)
        }
      }
    }

    this.bootstrapPeerId = connection.remotePeer.toString()
    this.connectedPeers.delete(this.bootstrapPeerId)

    await this.waitForRelayAddress()

    for (let i = 0; i < 5; i++) {
      await delay(1500)
      await this.refreshPeers()
    }

    this.discoveryTimer = setInterval(() => {
      this.refreshPeers().catch(err => {
        console.error('peer discovery refresh failed:', err.message)
      })
    }, DISCOVERY_INTERVAL_MS)
  }

  getPeerId() {
    return this.node?.peerId?.toString() ?? null
  }

  getListenAddrs() {
    return this.node?.getMultiaddrs().map(addr => addr.toString()) ?? []
  }

  getConnectedPeers() {
    return Array.from(this.connectedPeers)
  }

  onPeerConnect(callback) {
    this.peerConnectHandlers.push(callback)
    return () => {
      const i = this.peerConnectHandlers.indexOf(callback)
      if (i !== -1) this.peerConnectHandlers.splice(i, 1)
    }
  }

  onMessage(callback) {
    this.messageHandlers.push(callback)

    return () => {
      const index = this.messageHandlers.indexOf(callback)
      if (index !== -1) {
        this.messageHandlers.splice(index, 1)
      }
    }
  }

  async sendToNetwork(payload) {
    const connections = this.node.getConnections?.() ?? []
    const sent = new Set()

    for (const conn of connections) {
      const peerId = conn.remotePeer.toString()
      if (peerId === this.bootstrapPeerId) continue
      if (sent.has(peerId)) continue
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
        console.error(`failed to send to ${peerId.slice(-6)}:`, err.message)
      }
    }
  }

  async stop() {
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer)
      this.discoveryTimer = null
    }

    if (this.node) {
      await this.node.stop()
    }
  }

  async waitForRelayAddress() {
    const maxRetries = 3
    const baseDelay = 1000
    let retries = 0

    while (retries < maxRetries) {
      const deadline = Date.now() + RELAY_ADDR_TIMEOUT_MS

      while (Date.now() < deadline) {
        const relayAddrs = this.getListenAddrs().filter(addr => addr.includes('/p2p-circuit'))
        if (relayAddrs.length > 0) {
          return relayAddrs
        }

        await delay(250)
      }

      retries++
      if (retries < maxRetries) {
        const backoffDelay = baseDelay * Math.pow(2, retries - 1)
        console.warn(`Relay address attempt ${retries} failed, retrying in ${backoffDelay}ms...`)
        await delay(backoffDelay)
      }
    }

    console.warn('Timed out waiting for a relay address after retries (Safe to ignore for local testing)')
    return []
  }

  async registerWithBootstrap() {
    if (!this.bootstrapAddr) return

    const myAddrs = this.getListenAddrs().filter(addr => addr.includes('/p2p-circuit'))
    if (myAddrs.length === 0) return

    const request = {
      type: 'register',
      peerId: this.getPeerId(),
      addresses: myAddrs
    }

    let stream
    try {
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
      await channel.read()
      await stream.close()
    } catch (err) {
      try { await stream.close() } catch (_) {}
    }
  }

  async refreshPeers() {
    if (!this.bootstrapAddr) return

    const myAddrs = this.getListenAddrs().filter(addr => addr.includes('/p2p-circuit'))

    const request = {
      type: 'register',
      peerId: this.getPeerId(),
      addresses: myAddrs
    }

    let stream
    try {
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

      if (responseChunk == null) {
        return
      }

      const response = decodeChunk(responseChunk)

      const actuallyConnected = new Set(
        (this.node.getConnections?.() ?? []).map(c => c.remotePeer.toString())
      )

      // Sync connectedPeers with actual connections
      for (const pid of Array.from(this.connectedPeers)) {
        if (!actuallyConnected.has(pid)) {
          this.connectedPeers.delete(pid)
        }
      }

      for (const peer of response.peers ?? []) {
        if (peer.peerId === this.getPeerId() || peer.peerId === this.bootstrapPeerId) {
          continue
        }

        this.knownPeers.set(peer.peerId, peer)

        if (actuallyConnected.has(peer.peerId)) {
          this.connectedPeers.add(peer.peerId)
          continue
        }

        if (peer.addresses.length > 0) {
          for (const addr of peer.addresses) {
            try {
              await this.node.dial(multiaddr(addr))
              break
            } catch (err) {
              // Silently ignore NO_RESERVATION; other errors are non-fatal
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