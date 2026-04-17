/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { getProfile, saveProfile, deleteProfile } from '../lib/db'
import { initGossipNetwork, broadcastProfile, broadcastDeletion } from '../lib/gossipBridge'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { user: privyUser, ready: privyReady, logout: privyLogout, authenticated } = usePrivy()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [privyAuthenticated, setPrivyAuthenticated] = useState(false)

  // Track Privy authentication status
  useEffect(() => {
    if (privyReady) {
      setPrivyAuthenticated(authenticated)
    }
  }, [privyReady, authenticated])

  // Load profile on app startup and when Privy is ready
  useEffect(() => {
    ;(async () => {
      if (!privyReady) {
        return // Wait for Privy to be ready
      }
      
      const profile = await getProfile()
      if (profile && authenticated) {
        setUser(profile)
        try {
          await initGossipNetwork(profile)
        } catch (err) {
          // Network error — user can still use the app, just no discovery
          console.error('[auth] network init failed on load:', err.message)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })()
  }, [privyReady, authenticated])

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
    try {
      await broadcastDeletion()
      await deleteProfile()
    } catch (err) {
      console.error('[auth] logout error:', err.message)
    }
    setUser(null)
    // Call Privy logout to clear the session
    try {
      await privyLogout()
    } catch (err) {
      console.error('[auth] Privy logout error:', err.message)
    }
  }

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        loading, 
        login, 
        logout, 
        privyUser, 
        privyReady,
        privyAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
