// Eval 4: Peer join/discovery time vs number of joining peers
// Reads peer:startup, peer:bootstrap-connected, peer:relay-ready, and peer:ready
// marks from timing.js to break down where time goes during peer.start().
//
// Each peer instance has a unique this.id so marks from parallel starts
// can be matched per-peer.
//
// Setup: single machine, peers started in parallel per trial.

import { P2PNetwork } from '../src/network.js'
import { getMarks, clearMarks } from '../src/timing.js'
import { startBootstrap, delay, stats, printTable } from './helpers.js'

const PEER_COUNTS = [2, 5, 10, 15]
const TRIALS = 5

function extractPeerTimes(marks) {
  const byId = new Map()

  for (const m of marks) {
    if (!m.id) continue
    if (!byId.has(m.id)) byId.set(m.id, {})
    byId.get(m.id)[m.event] = m.t
  }

  const times = []
  for (const phases of byId.values()) {
    const startup = phases['peer:startup']
    const ready   = phases['peer:ready']
    if (startup == null || ready == null) continue
    times.push({
      total:     ready - startup,
      toBootstrap: phases['peer:bootstrap-connected'] != null ? phases['peer:bootstrap-connected'] - startup : null,
      toRelay:   phases['peer:relay-ready']          != null ? phases['peer:relay-ready']          - startup : null,
    })
  }
  return times
}

async function runTrial(bootstrapAddr, peerCount) {
  const peers = Array.from({ length: peerCount }, () => new P2PNetwork({ bootstrapAddr }))

  clearMarks()
  await Promise.all(peers.map(p => p.start()))
  const marks = getMarks()

  const times = extractPeerTimes(marks)
  const peersWithDiscovery = peers.filter(p => p.getConnectedPeers().length > 0).length

  await Promise.all(peers.map(p => p.stop()))

  return { times, peersWithDiscovery, total: peerCount }
}

async function main() {
  console.log('Eval 4 — peer join/discovery time vs number of joining peers')
  console.log('Single machine | peers started in parallel | 5 trials per count')
  console.log('Columns: total start() time, time to bootstrap, time to relay addr\n')

  const { proc, addr } = await startBootstrap()
  await delay(1500)

  const results = []

  for (const peerCount of PEER_COUNTS) {
    const allTotal = []
    const allToBootstrap = []
    const allToRelay = []
    let totalWithDiscovery = 0
    let totalPeers = 0

    for (let t = 0; t < TRIALS; t++) {
      const { times, peersWithDiscovery, total } = await runTrial(addr, peerCount)
      for (const entry of times) {
        allTotal.push(entry.total)
        if (entry.toBootstrap != null) allToBootstrap.push(entry.toBootstrap)
        if (entry.toRelay != null) allToRelay.push(entry.toRelay)
      }
      totalWithDiscovery += peersWithDiscovery
      totalPeers += total
      await delay(1000)
    }

    const sTotal = stats(allTotal)
    const sBoot  = stats(allToBootstrap)
    const sRelay = stats(allToRelay)
    const discoveryRate = ((totalWithDiscovery / totalPeers) * 100).toFixed(1)

    results.push({
      peers:          peerCount,
      'total avg':    sTotal.avg,
      'total max':    sTotal.max,
      'bootstrap avg': sBoot.avg,
      'relay avg':    sRelay.avg,
      'had peers':    `${discoveryRate}%`,
    })

    console.log(`  ${peerCount} peers → total avg ${sTotal.avg}ms  bootstrap avg ${sBoot.avg}ms  relay avg ${sRelay.avg}ms  had peers: ${discoveryRate}%`)
  }

  proc.kill()

  console.log('\n--- Results ---')
  printTable(results, ['peers', 'total avg', 'total max', 'bootstrap avg', 'relay avg', 'had peers'])
}

main().catch(err => { console.error(err); process.exit(1) })
