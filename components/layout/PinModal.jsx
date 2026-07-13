'use client'

import React, { useState } from 'react'
import { useEncryption } from '@/lib/EncryptionContext'

export default function PinModal({ onPinSet }) {
  const { isKeyReady, setPin } = useEncryption()
  const [pinInput, setPinInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If the key is already derived in context, don't show the modal
  if (isKeyReady) return null;

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (pinInput.length !== 6 || !/^\d+$/.test(pinInput)) {
      setError('PIN must be exactly 6 digits.')
      return
    }

    setLoading(true)
    setError('')
    const success = await setPin(pinInput)
    setLoading(false)

    if (success) {
      if (onPinSet) onPinSet()
    } else {
      setError('Failed to set PIN. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#241330] border border-[#e8527e]/30 rounded-2xl p-6 md:p-8 shadow-2xl max-w-sm w-full mx-4">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-2 text-center">
          Unlock Health Data 🔒
        </h2>
        <p className="text-sm text-gray-300 text-center mb-6">
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
            className="w-full bg-[#3a1c4a] border border-[#e8527e]/40 rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-[#e8527e]"
            autoFocus
          />
          
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          
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
