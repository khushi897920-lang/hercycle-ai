'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { deriveKey } from './encryption'
import { useUser } from '@clerk/nextjs'

const EncryptionContext = createContext({
  encryptionKey: null,
  isKeyReady: false,
  setPin: async (pin) => false,
  lock: () => {}
})

export function EncryptionProvider({ children }) {
  const { user, isLoaded } = useUser()
  const [encryptionKey, setEncryptionKey] = useState(null)
  
  // Try to load the exported key from sessionStorage on mount (survives tab reloads but not closing tab)
  useEffect(() => {
    if (isLoaded && user) {
      const storedKey = sessionStorage.getItem(`e2ee_key_${user.id}`)
      if (storedKey) {
        // Re-import the key from the raw exported bytes (stored as base64)
        const importKey = async () => {
          try {
            const rawBytes = new Uint8Array(atob(storedKey).split('').map(c => c.charCodeAt(0)))
            const key = await crypto.subtle.importKey(
              'raw',
              rawBytes,
              { name: 'AES-GCM', length: 256 },
              true,
              ['encrypt', 'decrypt']
            )
            setEncryptionKey(key)
          } catch (e) {
            console.error("Failed to restore key from session", e)
            sessionStorage.removeItem(`e2ee_key_${user.id}`)
          }
        }
        importKey()
      }
    }
  }, [isLoaded, user])

  const setPin = async (pin) => {
    if (!user) return false;
    try {
      const key = await deriveKey(pin, user.id);
      setEncryptionKey(key);
      
      // Export and save to sessionStorage
      const rawKey = await crypto.subtle.exportKey('raw', key);
      const b64Key = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
      sessionStorage.setItem(`e2ee_key_${user.id}`, b64Key);
      
      // Also set a localStorage flag so we know the user has set a PIN before
      localStorage.setItem(`has_pin_${user.id}`, 'true');
      return true;
    } catch (e) {
      console.error("Failed to derive key", e);
      return false;
    }
  }

  const lock = () => {
    if (user) {
      sessionStorage.removeItem(`e2ee_key_${user.id}`)
    }
    setEncryptionKey(null)
  }

  return (
    <EncryptionContext.Provider value={{
      encryptionKey,
      isKeyReady: !!encryptionKey,
      setPin,
      lock
    }}>
      {children}
    </EncryptionContext.Provider>
  )
}

export function useEncryption() {
  return useContext(EncryptionContext)
}
