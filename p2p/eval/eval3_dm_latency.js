// Eval 3: Direct message latency compared to the number of concurrent messages 

import { P2PNetwork } from '../src/network.js'
import { getMarks, clearMarks } from '../src/timing.js'
import { startBootstrap, delay, stats, printTable } from './helpers.js'

// We set these different number of loads so that we can run the tests
const LOADS = [1, 5, 10, 20, 50]
const TRIALS = 5
const RECEIVE_TIMEOUT_MS = 10_000


// We have this function to send the messages and then find the amount of time it took to deliver
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

  clearMarks()
  for (let i = 0; i < messageCount; i++) {
    const sentAt = Date.now()
    await sender.sendToNetwork({
      type: 'DIRECT_MESSAGE',
      to: receiverId,
      from: sender.getPeerId(),
      text: `msg-${i}`,
      sentAt,
    })
  }

  const deadline = Date.now() + RECEIVE_TIMEOUT_MS

  // We check for either that all the messages got received or until we end with a timeout
  while (received < messageCount && Date.now() < deadline) {
    await delay(50)
  }

  unsub()

  const marks = getMarks()
  const sent = marks.filter(m => m.event === 'message:send').length
  const receivedMarks = marks.filter(m => m.event === 'message:receive').length
  if (sent !== receivedMarks) {
    console.log(`    [timing] sent ${sent} message:send marks, got ${receivedMarks} message:receive marks`)
  }

  return { latencies, delivered: received, total: messageCount }
}

// The main function is used to run all of the tests and then get the data for the latency
async function main() {
  console.log('Eval 3 — direct message latency vs concurrent messages')
  console.log('Single machine | two in-process peers | 5 trials per load level\n')

  const { proc, addr } = await startBootstrap()
  await delay(1500)

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

    // We do some calculations to get all the important stats that we need for the latencies
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
