import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sendMessage, onMessage } from '../lib/p2pBridge'
import { formatWalletAddress } from '../lib/blockchain'
import { getKnownProfiles, getPeerTrust } from '../lib/gossipBridge'

export default function Chat() {
  const { peerId } = useParams()
  const navigate = useNavigate()
  const bottomRef = useRef(null)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  const peer = getKnownProfiles().find(p => p.peerId === peerId)
  const peerName = peer?.username || peerId?.slice(0, 8)
  const trust = getPeerTrust(peerId)
  const trustAnchor = trust?.ensName || formatWalletAddress(trust?.walletAddress)

  useEffect(() => {
    const unsub = onMessage(msg => {
      if (msg.from !== peerId) return
      setMessages(prev => [...prev, { from: 'peer', text: msg.text, time: Date.now() }])
    })
    return unsub
  }, [peerId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend(e) {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(peerId, input.trim())
    setMessages(prev => [...prev, { from: 'me', text: input.trim(), time: Date.now() }])
    setInput('')
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
        {messages.length === 0 && (
          <p className="chat-empty">Say hi to {peerName}!</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`bubble ${msg.from === 'me' ? 'bubble-me' : 'bubble-peer'}`}>
            {msg.text}
          </div>
        ))}
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
