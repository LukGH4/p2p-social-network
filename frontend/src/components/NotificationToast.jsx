import { useState, useEffect } from 'react'
import { onConnectionRequest, acceptConnection, declineConnection } from '../lib/gossipBridge'

const TOAST_DURATION_MS = 6_000

export default function NotificationToast() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const unsub = onConnectionRequest(({ fromPeerId, fromUsername }) => {
      const id = Date.now()
      setToasts(prev => [...prev, { id, fromPeerId, fromUsername }])
      // Auto-dismiss after timeout
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, TOAST_DURATION_MS)
    })
    return unsub
  }, [])

  function dismiss(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  function handleAccept(toast) {
    acceptConnection(toast.fromPeerId)
    dismiss(toast.id)
  }

  function handleDecline(toast) {
    declineConnection(toast.fromPeerId)
    dismiss(toast.id)
  }

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className="toast">
          <div className="toast-body">
            <span className="toast-avatar">{toast.fromUsername?.[0]?.toUpperCase()}</span>
            <span className="toast-message">
              <strong>{toast.fromUsername}</strong> wants to connect
            </span>
            <button className="toast-close" onClick={() => dismiss(toast.id)}>✕</button>
          </div>
          <div className="toast-actions">
            <button className="btn-primary btn-sm" onClick={() => handleAccept(toast)}>Accept</button>
            <button className="btn-ghost btn-sm" onClick={() => handleDecline(toast)}>Decline</button>
          </div>
        </div>
      ))}
    </div>
  )
}
