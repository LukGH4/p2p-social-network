import { createContext, useContext, useState, useEffect } from 'react'
import { getProfile, saveProfile, deleteProfile } from '../lib/db'
import { initGossipNetwork, broadcastProfile, broadcastDeletion } from '../lib/gossipBridge'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProfile().then(profile => {
      if (profile) {
        setUser(profile)
        initGossipNetwork(profile)
      }
      setLoading(false)
    })
  }, [])

  async function login(profile) {
    await saveProfile(profile)
    setUser(profile)
    await initGossipNetwork(profile)
    broadcastProfile(profile)
  }

  async function logout() {
    await broadcastDeletion();
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
