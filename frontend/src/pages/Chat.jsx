import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sendMessage, onMessage } from '../lib/p2pBridge'
import { getKnownProfiles, getConnectionState, getMyPeerId } from '../lib/gossipBridge'
import { getMessages, saveMessage } from '../lib/db'

function makeConvId(a, b) {
  return [a, b].sort().join('|')
}

export default function Chat() {
  const { peerId } = useParams()
  const navigate = useNavigate()

  const peer = getKnownProfiles().find(p => p.peerId === peerId)
  const peerName = peer?.username || peerId?.slice(0, 8)

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

  return <ChatWindow peerId={peerId} peerName={peerName} navigate={navigate} />
}

function ChatWindow({ peerId, peerName, navigate }) {
  const bottomRef = useRef(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const myPeerId = getMyPeerId()
    const convId = makeConvId(myPeerId, peerId)
    let cancelled = false

    // Collect messages that arrive during the async DB load so we don't drop them
    const pending = []
    let dbLoaded = false

    const unsub = onMessage(msg => {
      if (msg.from !== peerId) return
      const newMsg = { from: 'peer', text: msg.text, time: msg.time ?? Date.now() }
      if (dbLoaded) {
        setMessages(prev => [...prev, newMsg])
      } else {
        pending.push(newMsg)
      }
    })

    getMessages(convId).then(stored => {
      if (cancelled) return
      dbLoaded = true
      const history = stored.map(m => ({ from: m.sender, text: m.text, time: m.time }))
      // Append any messages that arrived while we were loading — they are already
      // persisted by gossipBridge, but aren't in this DB snapshot yet, so add them
      setMessages([...history, ...pending])
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
    const text = input.trim()
    const time = Date.now()
    const myPeerId = getMyPeerId()
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
        <span className="chat-peer-name">{peerName}</span>
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
