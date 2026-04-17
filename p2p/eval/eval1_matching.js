// Eval 1: Match computation latency vs number of peer profiles
// Uses the real getMatches() from matchingBridge.js.
// Peers are synthetic (random tags). No network required.

import { getMatches } from '../../frontend/src/lib/matchingBridge.js'
import { makeProfile, stats, printTable } from './helpers.js'

const SIZES = [10, 50, 100, 250, 500, 1000]
const RUNS = 10

const myProfile = makeProfile(0)

console.log('Eval 1 — match computation latency vs peer count')
console.log('Synthetic peers | Real matchingBridge.js | 10 runs per size\n')

const results = []

for (const size of SIZES) {
  const peers = Array.from({ length: size }, (_, i) => makeProfile(i + 1))
  const times = []

  for (let r = 0; r < RUNS; r++) {
    const t0 = performance.now()
    getMatches(myProfile, peers)
    times.push(performance.now() - t0)
  }

  const s = stats(times)
  results.push({ peers: size, 'avg (ms)': s.avg, 'min (ms)': s.min, 'max (ms)': s.max })
  console.log(`  ${size} peers → avg ${s.avg}ms  min ${s.min}ms  max ${s.max}ms`)
}

console.log('\n--- Results ---')
printTable(results, ['peers', 'avg (ms)', 'min (ms)', 'max (ms)'])
