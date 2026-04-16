import { sendDirectMessage, onDirectMessage } from './gossipBridge'

export function sendMessage(peerId, text) {
  sendDirectMessage(peerId, text)
}

export function onMessage(callback) {
  return onDirectMessage(callback)
}
