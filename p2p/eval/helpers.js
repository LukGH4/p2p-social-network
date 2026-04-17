import { spawn } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export function stats(times) {
  if (times.length === 0) return { avg: 'N/A', min: 'N/A', max: 'N/A' }
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  return {
    avg: +avg.toFixed(2),
    min: +Math.min(...times).toFixed(2),
    max: +Math.max(...times).toFixed(2),
  }
}

export function printTable(rows, cols) {
  console.log(cols.join('\t'))
  console.log(cols.map(() => '-------').join('\t'))
  for (const row of rows) console.log(cols.map(c => row[c] ?? '').join('\t'))
}

// Generates a synthetic but realistic peer profile
export function makeProfile(i) {
  const pick = (arr, n) =>
    Object.fromEntries([...arr].sort(() => Math.random() - 0.5).slice(0, n).map(k => [k, 1]))

  return {
    peerId: `eval-peer-${i}`,
    username: `user${i}`,
    bio: '',
    publicKey: 'evalkey',
    signature: 'evalsig',
    timestamp: Date.now(),
    ttl: 3_600_000,
    tags: {
      genre:    pick(['action','thriller','romance','scifi','horror','comedy','drama','documentary','animation','fantasy'], 3),
      era:      pick(['pre_1980s','1980s','1990s','2000s','2010s','2020s'], 2),
      rating:   pick(['G','PG','PG13','R','NC17'], 1),
      runtime:  pick(['under_90_min','90_to_120_min','120_to_150_min','over_150_min'], 1),
      language: pick(['english','spanish','french','korean','japanese','hindi','italian','german'], 1),
    },
  }
}

// Spawns the bootstrap node as a child process.
// Resolves with { proc, addr } once the bootstrap prints its 127.0.0.1 address.
export function startBootstrap() {
  return new Promise((res, rej) => {
    const proc = spawn('node', [resolve(__dirname, '../src/bootstrap.js')], {
      stdio: ['ignore', 'pipe', 'inherit'],
    })

    let peerId = null
    let wsAddr = null

    proc.stdout.on('data', chunk => {
      const text = chunk.toString()
      const peerMatch = text.match(/Peer ID: (\S+)/)
      const addrMatch = text.match(/\/ip4\/127\.0\.0\.1\/tcp\/\d+\/ws/)
      if (peerMatch) peerId = peerMatch[1]
      if (addrMatch) wsAddr = addrMatch[0]
      if (peerId && wsAddr) res({ proc, addr: `${wsAddr}/p2p/${peerId}` })
    })

    proc.on('error', rej)
    setTimeout(() => rej(new Error('bootstrap startup timed out')), 8000)
  })
}
