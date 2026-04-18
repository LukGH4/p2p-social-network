import { P2PNetwork } from '../src/network.js'
import { delay } from './helpers.js'

const bootstrapAddr = process.argv[2]
const statsUrl = process.argv[3] ?? 'http://127.0.0.1:4013/stats'

if (!bootstrapAddr) {
  console.error('Usage: node eval/demo_100_peers.js <bootstrapMultiaddr> [statsUrl]')
  process.exit(1)
}

const n = Number(process.env.TOTAL_PEERS ?? 100)
const batchSize = Number(process.env.BATCH_SIZE ?? 5)
const batchGapMs = Number(process.env.BATCH_GAP_MS ?? 2500)
const killAtMs = Number(process.env.KILL_AT_MS ?? 120_000)
const killN = Number(process.env.KILL_COUNT ?? 30)
const runMs = Number(process.env.RUN_FOR_MS ?? 240_000)
const pollMs = 2000

const instances = []
const stopped = new Set()
const t0 = Date.now()
const sec = () => ((Date.now() - t0) / 1000).toFixed(1) + 's'

async function getStats() {
  try {
    const res = await fetch(statsUrl, { signal: AbortSignal.timeout(2000) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

function countRunning() {
  return instances.reduce((c, p, i) => c + (p && !stopped.has(i) ? 1 : 0), 0)
}

function avgKnownSize() {
  const running = instances.filter((p, i) => p && !stopped.has(i))
  if (!running.length) return 0
  return Math.round(
    running.reduce((s, p) => s + (p.knownPeers?.size ?? 0), 0) / running.length
  )
}

async function startAll() {
  console.log(`\n[${sec()}] starting ${n} peers (${batchSize} per batch, ${batchGapMs}ms gap)`)
  for (let from = 0; from < n; from += batchSize) {
    const to = Math.min(from + batchSize, n)
    const batch = []
    for (let i = from; i < to; i++) {
      const net = new P2PNetwork({ bootstrapAddr, noMesh: true, silent: true, dialRetries: 6 })
      instances[i] = net
      batch.push(
        net.start().catch(err => {
          console.error(`  peer ${i}: ${err.message}`)
          instances[i] = null
        })
      )
    }
    await Promise.all(batch)
    const up = instances.slice(0, to).filter(Boolean).length
    console.log(`  [${sec()}] ${up} / ${to} up`)
    await delay(batchGapMs)
  }
  console.log(`[${sec()}] done\n`)
}

async function stopRandom(count) {
  const idx = instances.map((p, i) => (p && !stopped.has(i) ? i : -1)).filter(i => i >= 0)
  idx.sort(() => Math.random() - 0.5)
  const pick = idx.slice(0, count)

  console.log(`\n[${sec()}] stopping ${count} peers`)
  console.log(`[${sec()}] ids: ${pick.slice(0, 12).join(',')}${pick.length > 12 ? '...' : ''}`)
  console.log(`[${sec()}] registry should drop after ~30s stale window\n`)

  await Promise.all(
    pick.map(async i => {
      stopped.add(i)
      try {
        await instances[i].stop()
      } catch {}
      instances[i] = null
    })
  )
}

let prevReg = null
async function line() {
  const s = await getStats()
  const alive = countRunning()
  let extra = ''
  if (s && prevReg != null && s.registrySize < prevReg) {
    extra = `  (${prevReg} -> ${s.registrySize} registry)`
  }
  if (s) prevReg = s.registrySize
  console.log(
    `[${sec().padStart(7)}] alive=${String(alive).padStart(3)} reg=${String(s?.registrySize ?? '?').padStart(3)} ` +
      `conn=${String(s?.connectedCount ?? '?').padStart(3)} known~${String(avgKnownSize()).padStart(3)}${extra}`
  )
}

async function main() {
  console.log('100-peer run')
  console.log('bootstrap', bootstrapAddr)
  console.log('stats', statsUrl)
  console.log(`stop batch at ${killAtMs / 1000}s, n=${killN}`)

  const timer = setInterval(line, pollMs)
  await startAll()

  const waitKill = Math.max(0, killAtMs - (Date.now() - t0))
  if (waitKill > 0) {
    console.log(`[${sec()}] wait ${Math.round(waitKill / 1000)}s`)
    await delay(waitKill)
  }

  await stopRandom(killN)

  const rest = Math.max(0, runMs - (Date.now() - t0))
  console.log(`[${sec()}] run ${Math.round(rest / 1000)}s more`)
  await delay(rest)

  clearInterval(timer)
  console.log(`\n[${sec()}] exit`)
  await Promise.all(instances.filter(Boolean).map(p => p.stop().catch(() => {})))
  process.exit(0)
}

process.on('SIGINT', async () => {
  await Promise.all(instances.filter(Boolean).map(p => p.stop().catch(() => {})))
  process.exit(0)
})

main().catch(err => {
  console.error(err)
  process.exit(1)
})
