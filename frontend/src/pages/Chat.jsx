import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sendMessage, onMessage } from '../lib/p2pBridge'
import { formatWalletAddress } from '../lib/blockchain'
import {
  getKnownProfiles,
  getConnectionState,
  getMyPeerId,
  onConnectionChange,
  onPeerProfile,
} from '../lib/gossipBridge'
import { getMessages, saveMessage } from '../lib/db'
 
function makeConvId(a, b) {
  return [a, b].sort().join('|')
}
 
export default function Chat() {
  const { peerId } = useParams()
  const navigate = useNavigate()
  const [, setSync] = useState(0)
 
  useEffect(() => {
    const unsubConn = onConnectionChange(() => setSync(n => n + 1))
    const unsubProfiles = onPeerProfile(() => setSync(n => n + 1))
    return () => {
      unsubConn()
      unsubProfiles()
    }
  }, [])
 
  const peer = getKnownProfiles().find(p => p.peerId === peerId)
  const peerName = peer?.username || peerId?.slice(0, 8)
  const trust = peer?.trust
  const trustAnchor = trust?.ensName || formatWalletAddress(trust?.walletAddress)
 
  const connState = getConnectionState(peerId)
  if (connState !== 'connected') {
    return (
      <div className="chat-page">
        <header className="chat-header">
          <button className="btn-ghost" onClick={() => navigate('/feed')}>← Back</button>
          <span className="chat-peer-name">{peerName}</span>
        </header>
        <div className="chat-messages">
          <p className="chat-empty">
            {connState === 'sent'
              ? 'Waiting for them to accept your connection request…'
              : connState === 'received'
              ? 'You have a pending request from this peer. Accept it from the feed.'
              : 'You are not connected to this peer. Go back and send a connection request.'}
          </p>
        </div>
      </div>
    )
  }
 
  return (
    <ChatWindow
      peerId={peerId}
      peerName={peerName}
      trust={trust}
      trustAnchor={trustAnchor}
      navigate={navigate}
    />
  )
}
 
function ChatWindow({ peerId, peerName, trust, trustAnchor, navigate }) {
  const bottomRef = useRef(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
 
  useEffect(() => {
    const myPeerId = getMyPeerId()
    if (!myPeerId) {
      console.warn('[chat] myPeerId not available yet — skipping message load')
      setLoading(false)
      return
    }
 
    const convId = makeConvId(myPeerId, peerId)
    let cancelled = false

    const pendingMessages = []
    const pendingTimestamps = new Set()
    let dbLoaded = false
 
    const unsub = onMessage(msg => {
      if (msg.from !== peerId) return
      const newMsg = { from: 'peer', text: msg.text, time: msg.time ?? Date.now() }
      if (dbLoaded) {
        // DB is already loaded — just append directly to state.
        setMessages(prev => [...prev, newMsg])
      } else {
        // DB hasn't loaded yet. Collect this message so we can merge it after,
        // but record its timestamp so we can deduplicate against the DB snapshot.
        pendingMessages.push(newMsg)
        pendingTimestamps.add(newMsg.time)
      }
    })
 
    getMessages(convId).then(stored => {
      if (cancelled) return
      dbLoaded = true
 
      const history = stored.map(m => ({ from: m.sender, text: m.text, time: m.time }))
 
      // Only include pending messages whose timestamp is NOT already present in
      // the DB snapshot. gossipBridge persists received messages before firing
      // listeners, so most (or all) pending messages will already be in history.
      const dbTimestamps = new Set(history.map(m => m.time))
      const newPending = pendingMessages.filter(m => !dbTimestamps.has(m.time))
 
      setMessages([...history, ...newPending])
      setLoading(false)
    })
 
    return () => {
      cancelled = true
      unsub()
    }
  }, [peerId])
 
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
 
  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim()) return
 
    const myPeerId = getMyPeerId()
    if (!myPeerId) {
      console.warn('[chat] cannot send — myPeerId not available yet')
      return
    }
 
    const text = input.trim()
    const time = Date.now()
    const convId = makeConvId(myPeerId, peerId)
 
    sendMessage(peerId, text)
    setMessages(prev => [...prev, { from: 'me', text, time }])
    setInput('')
 
    // Persist sent message so it survives navigation
    saveMessage(convId, { sender: 'me', from: myPeerId, text, time }).catch(err =>
      console.warn('[chat] failed to save sent message:', err)
    )
  }
 
  return (
    <div className="chat-page">
      <header className="chat-header">
        <button className="btn-ghost" onClick={() => navigate('/feed')}>← Back</button>
        <div className="chat-header-copy">
          <span className="chat-peer-name">{peerName}</span>
          <span className="chat-peer-trust">
            {trust?.label}
            {trustAnchor ? ` • ${trustAnchor}` : ''}
          </span>
        </div>
      </header>
 
      <div className="chat-messages">
        {loading ? (
          <p className="chat-empty">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="chat-empty">Say hi to {peerName}!</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`bubble ${msg.from === 'me' ? 'bubble-me' : 'bubble-peer'}`}>
              {msg.text}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
 
      <form className="chat-input" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" className="btn-primary">Send</button>
      </form>
    </div>
  )
}