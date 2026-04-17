// Eval 4: Peer join/discovery time vs number of joining peers
// Measures how long peer.start() takes, which covers:
//   - bootstrap connection
//   - circuit relay address acquisition
//   - 5 rounds of peer discovery (refreshPeers)
//
// "network-ready" = start() has resolved (peer has a relay addr and has attempted discovery)
// "first peer discovered" = at least one other peer in connectedPeers after start()
//
// Setup: single machine, peers started in parallel per trial.

import { P2PNetwork } from '../src/network.js'
import { startBootstrap, delay, stats, printTable } from './helpers.js'

const PEER_COUNTS = [2, 5, 10, 15]
const TRIALS = 5

async function runTrial(bootstrapAddr, peerCount) {
  const peers = Array.from({ length: peerCount }, () => new P2PNetwork({ bootstrapAddr }))

  const t0 = Date.now()
  await Promise.all(peers.map(p => p.start()))
  const joinTime = Date.now() - t0

  const peersWithDiscovery = peers.filter(p => p.getConnectedPeers().length > 0).length

  await Promise.all(peers.map(p => p.stop()))

  return { joinTime, peersWithDiscovery, total: peerCount }
}

async function main() {
  console.log('Eval 4 — peer join/discovery time vs number of joining peers')
  console.log('Single machine | peers started in parallel | 5 trials per count')
  console.log('"join time" = total wall time for all peer.start() calls to complete\n')

  const { proc, addr } = await startBootstrap()
  await delay(1500)

  const results = []

  for (const peerCount of PEER_COUNTS) {
    const joinTimes = []
    let totalWithDiscovery = 0
    let totalPeers = 0

    for (let t = 0; t < TRIALS; t++) {
      const { joinTime, peersWithDiscovery, total } = await runTrial(addr, peerCount)
      joinTimes.push(joinTime)
      totalWithDiscovery += peersWithDiscovery
      totalPeers += total
      await delay(1000) // let the port settle between trials
    }

    const s = stats(joinTimes)
    const discoveryRate = ((totalWithDiscovery / totalPeers) * 100).toFixed(1)
    results.push({ peers: peerCount, 'avg (ms)': s.avg, 'max (ms)': s.max, 'discovered others': `${discoveryRate}%` })
    console.log(`  ${peerCount} peers → avg ${s.avg}ms  max ${s.max}ms  had peers: ${discoveryRate}%`)
  }

  proc.kill()

  console.log('\n--- Results ---')
  printTable(results, ['peers', 'avg (ms)', 'max (ms)', 'discovered others'])
}

main().catch(err => { console.error(err); process.exit(1) })
