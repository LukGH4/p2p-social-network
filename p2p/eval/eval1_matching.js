// Eval 1: Match the computational latency to the number of peer profiles

import { getMatches } from '../../frontend/src/lib/matchingBridge.js'
import { getMarks, clearMarks } from '../../frontend/src/lib/timing.js'
import { makeProfile, stats, printTable } from './helpers.js'

// We set these different sizes for the number of peer profiles that we will have
const SIZES = [10, 50, 100, 250, 500, 1000]

// We set this as the numebr of runs we do for each of the tests
const RUNS = 10

// We're going to use this one profile for comparing it with the differnt number of peers
const myProfile = makeProfile(0)

console.log('Eval 1 — match computation latency vs peer count')
console.log('Synthetic peers | Real matchingBridge.js | 10 runs per size\n')

const results = []


// We use this for loop to basically just check how much time it takes to do the matching for the different sizes
for (const size of SIZES) {
  const peers = Array.from({ length: size }, (_, i) => makeProfile(i + 1))
  const times = []

  for (let r = 0; r < RUNS; r++) {
    clearMarks()
    getMatches(myProfile, peers)
    const marks = getMarks()
    // We check the start and end to find how much time it takes
    const t0 = marks.find(m => m.event === 'matching:start')?.t
    const t1 = marks.find(m => m.event === 'matching:end')?.t
    if (t0 != null && t1 != null) times.push(t1 - t0)
  }

  const s = stats(times)
  results.push({ peers: size, 'avg (ms)': s.avg, 'min (ms)': s.min, 'max (ms)': s.max })
  console.log(`  ${size} peers → avg ${s.avg}ms  min ${s.min}ms  max ${s.max}ms`)
}

console.log('\n--- Results ---')
printTable(results, ['peers', 'avg (ms)', 'min (ms)', 'max (ms)'])
