import { P2PNetwork } from '../src/network.js'
import { delay } from './helpers.js'
import { generateSimProfile } from '../src/simProfile.js'

const bootstrapAddr = process.argv[2]
if (!bootstrapAddr) {
  console.error('Usage: node eval/demo_gossip_100.js <bootstrapMultiaddr>')
  process.exit(1)
}

const count = Number(process.env.TOTAL ?? 100)
const gapMs = Number(process.env.SEND_GAP_MS ?? 25)
const againMs = Number(process.env.REBROADCAST_MS ?? 30_000)

const profiles = []
for (let i = 0; i < count; i++) profiles.push(await generateSimProfile(i))
console.log(`${count} profiles, e.g. ${profiles[0].username}`)

const net = new P2PNetwork({ bootstrapAddr })
await net.start()
console.log('this node', net.getPeerId())
console.log('open the app and connect to the same bootstrap')

let busy = false
async function sendAll(tag) {
  if (busy) return
  const others = net.getConnectedPeers()
  if (!others.length) return
  busy = true
  console.log(`[${tag}] -> ${count} profiles to ${others.length} peer(s)`)
  try {
    for (const profile of profiles) {
      await net.sendToNetwork({ type: 'PROFILE_GOSSIP', profile })
      if (gapMs) await delay(gapMs)
    }
    console.log(`[${tag}] ok`)
  } finally {
    busy = false
  }
}

let before = new Set()
setInterval(async () => {
  const now = new Set(net.getConnectedPeers())
  const newOnes = [...now].filter(p => !before.has(p))
  before = now
  if (newOnes.length) {
    console.log('connected:', newOnes.map(p => p.slice(-6)).join(', '))
    await sendAll('join')
  }
}, 1000)

setInterval(() => {
  sendAll('repeat').catch(() => {})
}, againMs)

net.onMessage((msg, from) => {
  if (msg.type === 'PROFILE_GOSSIP' && msg.profile?.username) {
    console.log(`in ${from.slice(-6)} ${msg.profile.username}`)
  }
})

process.on('SIGINT', async () => {
  await net.stop()
  process.exit(0)
})
