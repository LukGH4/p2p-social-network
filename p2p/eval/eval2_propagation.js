// Eval 2: Profile propagation latency vs number of peers
// Measures time from profile:send mark to profile:receive mark on each receiver.
//
// Setup: single machine, multiple in-process libp2p nodes through a local bootstrap.
// Note: measures network-layer propagation only (no signature verification).

import { P2PNetwork } from '../src/network.js'
import { getMarks, clearMarks } from '../src/timing.js'
import { startBootstrap, delay, makeProfile, stats, printTable } from './helpers.js'

const PEER_COUNTS = [2, 4, 6, 8]
const TRIALS = 5
const RECEIVE_TIMEOUT_MS = 10_000

async function runTrial(peers) {
  const profile = makeProfile(Date.now())
  const sender = peers[0]
  const receivers = peers.slice(1)

  const received = new Map()
  const unsubs = receivers.map(p =>
    p.onMessage(msg => {
      if (msg.type === 'PROFILE_GOSSIP' && msg.profile?.peerId === profile.peerId && !received.has(p)) {
        received.set(p, Date.now())
      }
    })
  )

  clearMarks()
  await sender.sendToNetwork({ type: 'PROFILE_GOSSIP', profile })
  const sendMark = getMarks().find(m => m.event === 'profile:send')
  const t0 = sendMark?.t ?? Date.now()

  const deadline = Date.now() + RECEIVE_TIMEOUT_MS
  while (received.size < receivers.length && Date.now() < deadline) {
    await delay(50)
  }

  unsubs.forEach(u => u())

  return {
    latencies: Array.from(received.values()).map(t => t - t0),
    delivered: received.size,
    total: receivers.length,
  }
}

async function main() {
  console.log('Eval 2 — profile propagation latency vs peer count')
  console.log('Single machine | in-process libp2p nodes | 5 trials per size\n')

  const { proc, addr } = await startBootstrap()
  await delay(1500)

  const results = []

  for (const peerCount of PEER_COUNTS) {
    const peers = Array.from({ length: peerCount }, () => new P2PNetwork({ bootstrapAddr: addr }))
    await Promise.all(peers.map(p => p.start()))
    await delay(4000)

    const allLatencies = []
    let totalDelivered = 0
    let totalExpected = 0

    for (let t = 0; t < TRIALS; t++) {
      const { latencies, delivered, total } = await runTrial(peers)
      allLatencies.push(...latencies)
      totalDelivered += delivered
      totalExpected += total
      await delay(500)
    }

    await Promise.all(peers.map(p => p.stop()))

    const s = stats(allLatencies)
    const rate = ((totalDelivered / totalExpected) * 100).toFixed(1)
    results.push({ peers: peerCount, 'avg (ms)': s.avg, 'max (ms)': s.max, 'delivered': `${totalDelivered}/${totalExpected}` })
    console.log(`  ${peerCount} peers → avg ${s.avg}ms  max ${s.max}ms  delivery ${rate}%`)
  }

  proc.kill()

  console.log('\n--- Results ---')
  printTable(results, ['peers', 'avg (ms)', 'max (ms)', 'delivered'])
}

main().catch(err => { console.error(err); process.exit(1) })
