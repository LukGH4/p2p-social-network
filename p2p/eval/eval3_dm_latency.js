// Eval 3: Direct message latency vs number of concurrent messages
// Measures end-to-end latency from sendToNetwork() to onMessage() at the receiver.
// Latency = receive timestamp − sentAt field in the message payload.
//
// Setup: single machine, two in-process libp2p peers.
// Note: sendToNetwork broadcasts to all connected peers.
//       receiver filters by msg.to so only intended messages are counted.

import { P2PNetwork } from '../src/network.js'
import { startBootstrap, delay, stats, printTable } from './helpers.js'

const LOADS = [1, 5, 10, 20, 50]
const TRIALS = 5
const RECEIVE_TIMEOUT_MS = 10_000

async function runTrial(sender, receiver, messageCount) {
  const receiverId = receiver.getPeerId()
  const latencies = []
  let received = 0

  const unsub = receiver.onMessage(msg => {
    if (msg.type === 'DIRECT_MESSAGE' && msg.to === receiverId && msg.sentAt) {
      latencies.push(Date.now() - msg.sentAt)
      received++
    }
  })

  for (let i = 0; i < messageCount; i++) {
    await sender.sendToNetwork({
      type: 'DIRECT_MESSAGE',
      to: receiverId,
      from: sender.getPeerId(),
      text: `msg-${i}`,
      sentAt: Date.now(),
    })
  }

  const deadline = Date.now() + RECEIVE_TIMEOUT_MS
  while (received < messageCount && Date.now() < deadline) {
    await delay(50)
  }

  unsub()
  return { latencies, delivered: received, total: messageCount }
}

async function main() {
  console.log('Eval 3 — direct message latency vs concurrent messages')
  console.log('Single machine | two in-process peers | 5 trials per load level\n')

  const { proc, addr } = await startBootstrap()
  await delay(1500)

  // Start the two peers once and reuse across all load levels
  const sender = new P2PNetwork({ bootstrapAddr: addr })
  const receiver = new P2PNetwork({ bootstrapAddr: addr })
  await Promise.all([sender.start(), receiver.start()])
  await delay(4000)

  const results = []

  for (const count of LOADS) {
    const allLatencies = []
    let totalDelivered = 0
    let totalExpected = 0

    for (let t = 0; t < TRIALS; t++) {
      const { latencies, delivered, total } = await runTrial(sender, receiver, count)
      allLatencies.push(...latencies)
      totalDelivered += delivered
      totalExpected += total
      await delay(300)
    }

    const s = stats(allLatencies)
    const rate = ((totalDelivered / totalExpected) * 100).toFixed(1)
    results.push({ msgs: count, 'avg (ms)': s.avg, 'max (ms)': s.max, 'success': `${rate}%` })
    console.log(`  ${count} msgs → avg ${s.avg}ms  max ${s.max}ms  success ${rate}%`)
  }

  await sender.stop()
  await receiver.stop()
  proc.kill()

  console.log('\n--- Results ---')
  printTable(results, ['msgs', 'avg (ms)', 'max (ms)', 'success'])
}

main().catch(err => { console.error(err); process.exit(1) })
