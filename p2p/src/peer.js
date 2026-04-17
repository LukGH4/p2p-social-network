import { P2PNetwork } from './network.js'

const bootstrapAddr = process.argv[2]
const label = process.argv[3] ?? 'peer'

if (!bootstrapAddr) {
  console.error('Usage: node src/peer.js <bootstrapMultiaddr> [label]')
  process.exit(1)
}

const network = new P2PNetwork({ bootstrapAddr })

// We are starting the peer here and we connect to network here
await network.start()

console.log(`[${label}] started`)
console.log(`[${label}] peerId: ${network.getPeerId()}`)
console.log(`[${label}] listen addrs:`)
for (const addr of network.getListenAddrs()) {
  console.log(`  ${addr}`)
}

// We want to keep listening for any neew messages that we get from the peers
network.onMessage((msg, from) => {
  console.log(`[${label}] message from ${from}:`, msg)
})

setInterval(() => {
  console.log(`[${label}] connected peers:`, network.getConnectedPeers())
}, 5_000)


// Every once in a while at an interval we want to send our messages to the peers
setInterval(async () => {
  await network.sendToNetwork({
    from: label,
    ts: Date.now(),
    payload: `hello from ${label}`
  })
}, 8_000)


// This code is to stop the network here when we clpse the app
process.on('SIGINT', async () => {
  await network.stop()
  process.exit(0)
})
