import { createContext, useContext, useState, useEffect } from 'react'
import { getProfile, saveProfile, deleteProfile } from '../lib/db'
import { initGossipNetwork, broadcastProfile, broadcastDeletion } from '../lib/gossipBridge'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const profile = await getProfile()
      if (profile) {
        setUser(profile)
        try {
          await initGossipNetwork(profile)
        } catch (err) {
          // Network error — user can still use the app, just no discovery
          console.error('[auth] network init failed on load:', err.message)
        }
      }
      setLoading(false)
    })()
  }, [])

  async function login(profile) {
    await saveProfile(profile)
    setUser(profile)
    try {
      await initGossipNetwork(profile)
      broadcastProfile(profile)
    } catch (err) {
      console.error('[auth] network init failed on login:', err.message)
    }
  }

  async function logout() {
    await broadcastDeletion()
    await deleteProfile()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
