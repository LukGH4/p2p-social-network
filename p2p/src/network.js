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
    this.discoveryTimer = null
  }

  async start() {
    this.node = await createLibp2p({
      addresses: {
        listen: ['/p2p-circuit']
      },
      transports: [
        webSockets(),
        circuitRelayTransport()
      ],
      connectionEncrypters: [
        noise()
      ],
      streamMuxers: [
        yamux()
      ],
      services: {
        identify: identify()
      }
    })

    this.node.handle(
      RAW_PROTOCOL,
      async (stream, connection) => {
        const channel = lpStream(stream)
        const chunk = await channel.read()

        if (chunk == null) {
          return
        }

        const payload = decodeChunk(chunk)
        const from = connection.remotePeer.toString()

        for (const callback of this.messageHandlers) {
          callback(payload, from)
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

    const connection = await this.node.dial(multiaddr(this.bootstrapAddr))
    this.bootstrapPeerId = connection.remotePeer.toString()
    this.connectedPeers.delete(this.bootstrapPeerId)

    await this.waitForRelayAddress()
    await this.refreshPeers()

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
    const peers = Array.from(this.knownPeers.values())

    for (const peer of peers) {
      if (!peer.addresses.length) {
        continue
      }

      try {
        const stream = await this.node.dialProtocol(
          multiaddr(peer.addresses[0]),
          RAW_PROTOCOL,
          {
            runOnLimitedConnection: true
          }
        )
        const channel = lpStream(stream)

        await channel.write(encodeJson(payload))
        await stream.close()
      } catch (err) {
        console.error(`failed to send to ${peer.peerId}:`, err.message)
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
    const deadline = Date.now() + RELAY_ADDR_TIMEOUT_MS

    while (Date.now() < deadline) {
      const relayAddrs = this.getListenAddrs().filter(addr => addr.includes('/p2p-circuit'))
      if (relayAddrs.length > 0) {
        return relayAddrs
      }

      await delay(250)
    }

    throw new Error('timed out waiting for a relay address')
  }

  async refreshPeers() {
    const request = {
      type: 'register',
      peerId: this.getPeerId(),
      addresses: this.getListenAddrs().filter(addr => addr.includes('/p2p-circuit'))
    }

    const stream = await this.node.dialProtocol(
      multiaddr(this.bootstrapAddr),
      DISCOVERY_PROTOCOL
    )
    const channel = lpStream(stream)

    await channel.write(encodeJson(request))

    const responseChunk = await channel.read()
    await stream.close()

    if (responseChunk == null) {
      return
    }

    const response = decodeChunk(responseChunk)

    for (const peer of response.peers ?? []) {
      if (peer.peerId === this.getPeerId() || peer.peerId === this.bootstrapPeerId) {
        continue
      }

      this.knownPeers.set(peer.peerId, peer)

      if (!this.connectedPeers.has(peer.peerId) && peer.addresses.length > 0) {
        try {
          await this.node.dial(multiaddr(peer.addresses[0]))
        } catch (err) {
          console.error(`failed to connect to ${peer.peerId}:`, err.message)
        }
      }
    }
  }
}

export { DISCOVERY_PROTOCOL, RAW_PROTOCOL }
