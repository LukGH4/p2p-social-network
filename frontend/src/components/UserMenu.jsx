import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function UserMenu() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  if (!user) {
    return null
  }

  async function handleLogout() {
    setShowMenu(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="user-menu-container">
      <button 
        className="user-menu-trigger"
        onClick={() => setShowMenu(!showMenu)}
        title={user.username}
      >
        <span className="user-avatar">{user.username.charAt(0).toUpperCase()}</span>
        <span className="user-name">{user.username}</span>
      </button>

      {showMenu && (
      <div className="user-menu-dropdown">
        <div className="menu-header">
          <p className="menu-username">{user.username}</p>
          <p className="menu-peerId">{user.peerId.slice(0, 8)}...</p>
        </div>

        <div className="menu-divider"></div>

        <button className="menu-item" onClick={() => {
          setShowMenu(false)
          navigate('/profile/create')
        }}>
          Edit Profile
        </button>

        <div className="menu-divider"></div>

        <button className="menu-item menu-danger" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
      )}
    </div>
  )
}
