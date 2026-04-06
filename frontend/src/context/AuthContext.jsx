import { createContext, useContext, useState, useEffect } from 'react'
import { loadProfile, saveProfile, clearProfile } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const profile = loadProfile()
    if (profile) setUser(profile)
    setLoading(false)
  }, [])

  function login(profile) {
    saveProfile(profile)
    setUser(profile)
  }

  function logout() {
    clearProfile()
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
