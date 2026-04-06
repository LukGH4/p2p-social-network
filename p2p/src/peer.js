import { P2PNetwork } from './network.js'

const bootstrapAddr = process.argv[2]
const label = process.argv[3] ?? 'peer'

if (!bootstrapAddr) {
  console.error('Usage: node src/peer.js <bootstrapMultiaddr> [label]')
  process.exit(1)
}

const network = new P2PNetwork({ bootstrapAddr })
await network.start()

console.log(`[${label}] started`)
console.log(`[${label}] peerId: ${network.getPeerId()}`)
console.log(`[${label}] listen addrs:`)
for (const addr of network.getListenAddrs()) {
  console.log(`  ${addr}`)
}

network.onMessage((msg, from) => {
  console.log(`[${label}] message from ${from}:`, msg)
})

setInterval(() => {
  console.log(`[${label}] connected peers:`, network.getConnectedPeers())
}, 5_000)

setInterval(async () => {
  await network.sendToNetwork({
    from: label,
    ts: Date.now(),
    payload: `hello from ${label}`
  })
}, 8_000)

process.on('SIGINT', async () => {
  await network.stop()
  process.exit(0)
})
