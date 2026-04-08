import { createContext, useContext, useState, useEffect } from 'react'
import { getProfile, saveProfile, deleteProfile } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProfile().then(profile => {
      if (profile) setUser(profile)
      setLoading(false)
    })
  }, [])

  async function login(profile) {
    await saveProfile(profile)
    setUser(profile)
  }

  async function logout() {
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
