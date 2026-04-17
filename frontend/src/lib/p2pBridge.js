import { sendDirectMessage, onDirectMessage } from './gossipBridge'

// Simple function that we made to just send out the message to a peer that we choose
export function sendMessage(peerId, text) {
  sendDirectMessage(peerId, text)
}

// Another simple function that we use to listen out for the messages coming from the peers
export function onMessage(callback) {
  return onDirectMessage(callback)
}
