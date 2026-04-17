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

// We are making this class for the p2p network so we can handle each node on the network using the same variables
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

  // We use this to start up our node on the network so that we can connect it to our bootstrap node and find the peers
  async start() {
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

    // Here we want to get the messages that are coming in and then hand them over to the listeners that are awaiting
    this.node.handle(
      RAW_PROTOCOL,
      async (stream, connection) => {
        const from = connection.remotePeer.toString()
        const channel = lpStream(stream)
        try {
          const chunk = await channel.read()
          if (chunk == null) return
          const payload = decodeChunk(chunk)
          for (const cb of this.messageHandlers) cb(payload, from)
        } catch (err) {
          // stream errors are non-fatal
        } finally {
          try { await stream.close() } catch (_) {}
        }
      },
      { runOnLimitedConnection: true }
    )

    this.node.addEventListener('peer:connect', evt => {
      const peerId = (evt.detail?.remotePeer ?? evt.detail)?.toString()
      if (peerId && peerId !== this.bootstrapPeerId) {
        // We are keeping track of all of the peers which we are adding and the ones that we are removing
        this.connectedPeers.add(peerId)
        for (const cb of this.peerConnectHandlers) cb(peerId)
        const addrs = this.getListenAddrs()
        if (addrs.some(a => a.includes('/p2p-circuit'))) {
          this.registerWithBootstrap().catch(() => {})
        }
      }
    })

    this.node.addEventListener('peer:disconnect', evt => {
      const peerId = (evt.detail?.remotePeer ?? evt.detail)?.toString()
      if (peerId) this.connectedPeers.delete(peerId)
    })

    await this.node.start()

    if (!this.bootstrapAddr) return

    let connection
    try {
      connection = await this.node.dial(multiaddr(this.bootstrapAddr))
    } catch {
      await delay(1000)
      connection = await this.node.dial(multiaddr(this.bootstrapAddr))
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
    return this.node.peerId.toString()
  }

  getListenAddrs() {
    return this.node.getMultiaddrs().map(a => a.toString())
  }

  getConnectedPeers() {
    return Array.from(this.connectedPeers)
  }

  onPeerConnect(callback) {
    this.peerConnectHandlers.push(callback)
    return () => {
      this.peerConnectHandlers = this.peerConnectHandlers.filter(h => h !== callback)
    }
  }

  onMessage(callback) {
    this.messageHandlers.push(callback)
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== callback)
    }
  }

  // We are going to send the entire message to each of the peers which are connected this way we wont have any duplications
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
        console.error(`failed to send to ${peerId.slice(-6)}:`, err.message)
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

  // We use this wait and then try again until the relay address is free for us to use
  async waitForRelayAddress() {
    const deadline = Date.now() + RELAY_ADDR_TIMEOUT_MS
    while (Date.now() < deadline) {
      const relayAddrs = this.getListenAddrs().filter(a => a.includes('/p2p-circuit'))
      if (relayAddrs.length > 0) return relayAddrs
      await delay(250)
    }
    console.warn('Timed out waiting for a relay address after retries (Safe to ignore for local testing)')
    return []
  }

  // We know that in the p2p system we need the bootstrap to act on keeping a record of the node so we use this
  // to keep the register of the peer so that it can get found
  async registerWithBootstrap() {
    if (!this.bootstrapAddr) return

    const myAddrs = this.getListenAddrs().filter(a => a.includes('/p2p-circuit'))
    if (myAddrs.length === 0) return

    const request = {
      type: 'register',
      peerId: this.getPeerId(),
      addresses: myAddrs
    }

    let stream
    try {
      stream = await this.node.dialProtocol(multiaddr(this.bootstrapAddr), DISCOVERY_PROTOCOL)
    } catch {
      return
    }

    const channel = lpStream(stream)
    try {
      await channel.write(encodeJson(request))
      await channel.read()
      await stream.close()
    } catch {
      try { await stream.close() } catch (_) {}
    }
  }

  // We are refreshing the peers so basically we are getting the list of the peers and updating it and then
  // connecting to all of the peers that are new
  async refreshPeers() {
    if (!this.bootstrapAddr) return

    const myAddrs = this.getListenAddrs().filter(a => a.includes('/p2p-circuit'))
    const request = {
      type: 'register',
      peerId: this.getPeerId(),
      addresses: myAddrs
    }

    let stream
    try {
      stream = await this.node.dialProtocol(multiaddr(this.bootstrapAddr), DISCOVERY_PROTOCOL)
    } catch {
      return
    }

    const channel = lpStream(stream)
    try {
      await channel.write(encodeJson(request))

      const responseChunk = await channel.read()
      await stream.close()

      if (responseChunk == null) return

      const response = decodeChunk(responseChunk)

      const actuallyConnected = new Set(
        this.node.getConnections().map(c => c.remotePeer.toString())
      )

      for (const pid of this.connectedPeers) {
        if (!actuallyConnected.has(pid)) this.connectedPeers.delete(pid)
      }

      for (const peer of response.peers ?? []) {
        if (peer.peerId === this.getPeerId() || peer.peerId === this.bootstrapPeerId) continue

        this.knownPeers.set(peer.peerId, peer)

        if (actuallyConnected.has(peer.peerId)) {
          this.connectedPeers.add(peer.peerId)
          continue
        }

        for (const addr of peer.addresses) {
          try {
            await this.node.dial(multiaddr(addr))
            break
          } catch {
          }
        }
      }
    } catch {
      try { await stream.close() } catch (_) {}
    }
  }
}

export { BROADCAST_PROTOCOL, DISCOVERY_PROTOCOL, RAW_PROTOCOL }
