/* eslint-disable react-refresh/only-export-components */
 
import { createContext, useContext, useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { getProfile, saveProfile, deleteProfile, deleteKeypair } from '../lib/db'
import { initGossipNetwork, broadcastProfile, broadcastDeletion, teardownGossipNetwork } from '../lib/gossipBridge'
 
// For now we create the auth context by passing in null to create context but this auth context
// will be used to save and then send out the user with the state for the auth
const AuthContext = createContext(null)
 
export function AuthProvider({ children }) {
  const { user: privyUser, ready: privyReady, logout: privyLogout, authenticated } = usePrivy()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [privyAuthenticated, setPrivyAuthenticated] = useState(false)
 

  // The reason we do this is that we need to first check that the user is properly authenticated 
  useEffect(() => {
    if (privyReady) {
      setPrivyAuthenticated(authenticated)
    }
  }, [privyReady, authenticated])
 

  useEffect(() => {
    ;(async () => {
      if (!privyReady) {
        return 
      }
 
      const profile = await getProfile()
      if (profile && authenticated) {
        setUser(profile)
        try {
          await initGossipNetwork(profile)
        } catch (err) {
          console.error('[auth] network init failed on load:', err.message)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })()
  }, [privyReady, authenticated])
 

  // This is the main login function which we use to save the profile and then do the network connection with the 
  // profile being broadcasted properly
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
 
  // This is hte main logout function which will first broadcast that the peer is being deleted and we delete all the date
  // we have a lot of error catching here to check for any log out failures
  async function logout() {
    await broadcastDeletion().catch(err => console.error('[auth] broadcastDeletion error:', err.message))
    await teardownGossipNetwork().catch(err => console.error('[auth] teardown error:', err.message))
    await deleteProfile().catch(err => console.error('[auth] storage cleanup error:', err.message))
    await deleteKeypair().catch(err => console.error('[auth] storage cleanup error:', err.message))
    setUser(null)
    await privyLogout().catch(err => console.error('[auth] Privy logout error:', err.message))
  }
 
  // We use this to give the auth context which is the user the auth state nd the functions to the components
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