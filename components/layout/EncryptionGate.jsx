'use client'

import React, { useEffect, useState } from 'react'
import { useEncryption } from '@/lib/EncryptionContext'
import PinModal from './PinModal'

/**
 * Surfaces the PIN prompt when end-to-end encryption is enabled on this device
 * but no key is currently held.
 *
 * Without this the fail-closed policy in lib/encryption-policy.js would be a
 * dead end: a save would be correctly refused, but the user would have no way
 * to unlock and retry. `PinModal` existed in the codebase but was never
 * rendered anywhere, so the key was in practice never derived — which is why
 * every write took the old "encryption failed, send plaintext anyway" branch.
 *
 * It listens for the `hercycle:encryption-locked` event that the offline client
 * dispatches when it refuses a write, so the prompt appears exactly when the
 * user has just tried to save something.
 */
export default function EncryptionGate() {
  const { isEncryptionEnabled, isUnlocked } = useEncryption()
  const [promptRequested, setPromptRequested] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleLocked = () => setPromptRequested(true)
    window.addEventListener('hercycle:encryption-locked', handleLocked)
    return () => window.removeEventListener('hercycle:encryption-locked', handleLocked)
  }, [])

  // Clear the request once a key is held, so the modal does not reappear after
  // a successful unlock.
  useEffect(() => {
    if (isUnlocked) setPromptRequested(false)
  }, [isUnlocked])

  if (!isEncryptionEnabled || isUnlocked || !promptRequested) return null

  return <PinModal onPinSet={() => setPromptRequested(false)} />
}
