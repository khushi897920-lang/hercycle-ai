'use client'

import React, { useState } from 'react'
import { useEncryption } from '@/lib/EncryptionContext'
import { useUser } from '@clerk/nextjs'
import useModalA11y from '@/lib/a11y/useModalA11y'

export default function PinModal({ onPinSet }) {
  const { isUnlocked, deriveKey } = useEncryption()
  const { isLoaded, user } = useUser()
  const [pinInput, setPinInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // This modal previously trapped focus by hand with the selector
  // `input, button, [href], [tabIndex]:not([tabIndex="-1"])`, which silently
  // failed in the state the user always starts in: the Unlock button is
  // disabled until six digits are entered, so it was `lastElement`, and the
  // browser never focuses a disabled button — meaning `activeElement ===
  // lastElement` was never true and Tab escaped the dialog altogether. The
  // shared trap filters disabled and hidden controls out of the cycle.
  //
  // This is a gate, not a dismissible dialog: there is nothing behind it to
  // return to until the data is decrypted, so Escape and backdrop clicks are
  // deliberately inert.
  const { containerRef } = useModalA11y({
    isOpen: !isUnlocked,
    closeOnEscape: false,
    closeOnBackdrop: false,
    restoreFocus: false,
  })

  // If the key is already derived in context, don't show the modal
  if (isUnlocked) return null;

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (pinInput.length !== 6 || !/^\d+$/.test(pinInput)) {
      setError('PIN must be exactly 6 digits.')
      return
    }
    
    if (!isLoaded) {
      setError('Loading user profile...')
      return
    }

    setLoading(true)
    setError('')
    
    try {
        // Use user.id as salt, fallback if not available (shouldn't happen in auth'd area)
        const salt = user?.id || 'default-user-salt'
        await deriveKey(pinInput, salt)
        
        if (onPinSet) onPinSet()
    } catch (err) {
        setError('Failed to unlock. Incorrect PIN or error.')
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-modal-title"
        aria-describedby="pin-modal-description"
        tabIndex={-1}
        className="bg-[#241330] border border-[#e8527e]/30 rounded-2xl p-6 md:p-8 shadow-2xl max-w-sm w-full mx-4 focus:outline-none"
      >
        <h2 id="pin-modal-title" className="text-xl md:text-2xl font-bold text-white mb-2 text-center">
          Unlock Health Data 🔒
        </h2>
        <p id="pin-modal-description" className="text-sm text-gray-300 text-center mb-6">
          Your menstrual data is End-to-End Encrypted. Enter your 6-digit Security PIN to decrypt your data on this device.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value)
              setError('')
            }}
            placeholder="••••••"
            aria-label="Enter your 6-digit security PIN"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby="pin-modal-error"
            className="w-full bg-[#3a1c4a] border border-[#e8527e]/40 rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-[#e8527e]"
            data-autofocus=""
          />

          {/* The live region has to be in the tree from the start: a container
              that only appears at the same moment as its text is frequently
              not announced at all. */}
          <p id="pin-modal-error" role="alert" className="text-red-400 text-sm text-center min-h-[1.25rem]">
            {error}
          </p>
          
          <button
            type="submit"
            disabled={loading || pinInput.length !== 6}
            className="w-full bg-gradient-to-r from-[#e8527e] to-[#ff6b6b] text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(232,82,126,0.5)] transition-all"
          >
            {loading ? 'Decrypting...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
