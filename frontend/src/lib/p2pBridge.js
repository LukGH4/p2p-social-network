// Stub for Part 2 (P2P layer).
// Luke will replace the contents of these functions with real P2P calls.

const listeners = []

export function getConnectedPeers() {
  // TODO: Luke returns real connected peer IDs
  return []
}

export function sendMessage(peerId, text) {
  // TODO: Luke sends message over P2P connection
  console.log('sendMessage (stub)', peerId, text)
}

export function onMessage(callback) {
  listeners.push(callback)
  return () => {
    const i = listeners.indexOf(callback)
    if (i !== -1) listeners.splice(i, 1)
  }
}

// Used by the P2P layer to deliver an incoming message to the UI
export function receiveMessage(msg) {
  listeners.forEach(cb => cb(msg))
}
