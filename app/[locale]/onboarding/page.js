'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useUser } from '@clerk/nextjs'
import { Users, HeartPulse, ArrowRight, Loader2 } from 'lucide-react'
import { setPrimaryRole, acceptPairingCode } from '@/lib/actions/partner'
import toast from 'react-hot-toast'

export default function OnboardingPage() {
  const [selectedRole, setSelectedRole] = useState(null)
  const [pairingCode, setPairingCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const locale = useLocale()
  const { user } = useUser()

  const handleSelectPrimary = async () => {
    setIsLoading(true)
    try {
      await setPrimaryRole()
      await user?.reload() // Force Clerk to fetch the new role
      window.location.href = `/${locale}` // Hard navigate to clear cache
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  const handleJoinPartner = async () => {
    if (!pairingCode || pairingCode.length !== 12) {
      toast.error('Please enter a valid 12-character code')
      return
    }

    setIsLoading(true)
    try {
      await acceptPairingCode(pairingCode)
      await user?.reload() // Force Clerk to fetch the new role
      toast.success('Successfully paired!')
      window.location.href = `/${locale}/partner` // Hard navigate to clear cache
    } catch (error) {
      toast.error(error.message || 'Invalid or expired code')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(155deg,#fce4ec 0%,#f5a8d0 25%,#e065b5 50%,#b83da0 72%,#7c2d90 90%,#4a1580 100%)' }}>
      {/* Background blobs */}
      <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,150,210,0.35)_0%,transparent_70%)] blur-[60px] pointer-events-none" />
      <div className="absolute bottom-[-150px] right-[-150px] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(192,100,252,0.28)_0%,transparent_70%)] blur-[60px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-3 sm:px-0 mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="font-serif text-2xl sm:text-4xl font-bold text-white mb-2">Welcome to HerCycle AI</h1>
          <p className="text-white/80 text-sm sm:text-base">How would you like to use the app?</p>
        </div>

        <div className="glass p-4 sm:p-8 rounded-3xl shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20">
          {!selectedRole ? (
            <div className="space-y-3 sm:space-y-4">
              <button
                onClick={handleSelectPrimary}
                disabled={isLoading}
                className="w-full flex items-center p-3.5 sm:p-5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all group disabled:opacity-50"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-pink-500/20 flex items-center justify-center mr-3 sm:mr-4 shrink-0 group-hover:bg-pink-500/30 transition-colors">
                  <HeartPulse className="w-5 h-5 sm:w-6 sm:h-6 text-pink-300" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-base sm:text-lg truncate">Track My Cycle</h3>
                  <p className="text-white/60 text-xs sm:text-sm truncate">I want to track my own menstrual health</p>
                </div>
                {isLoading ? <Loader2 className="w-5 h-5 text-white/50 animate-spin shrink-0" /> : <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white transition-colors shrink-0" />}
              </button>

              <button
                onClick={() => setSelectedRole('partner')}
                disabled={isLoading}
                className="w-full flex items-center p-3.5 sm:p-5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all group disabled:opacity-50"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-500/20 flex items-center justify-center mr-3 sm:mr-4 shrink-0 group-hover:bg-purple-500/30 transition-colors">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-300" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-base sm:text-lg truncate">Join as a Partner</h3>
                  <p className="text-white/60 text-xs sm:text-sm truncate">I want to view shared cycle insights</p>
                </div>
                <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white transition-colors shrink-0" />
              </button>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Users className="w-7 h-7 sm:w-8 sm:h-8 text-purple-300" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Enter Pairing Code</h2>
                <p className="text-xs sm:text-sm text-white/70 mt-1">Ask your partner to generate a 12-character code in their Settings.</p>
              </div>

              <div>
                <input
                  type="text"
                  value={pairingCode}
                  onChange={(e) => {
                    const value = e.target.value
                      .toUpperCase()
                      .replace(/[^0-9A-F]/g, '');

                    setPairingCode(value);
                  }}
                  placeholder="e.g. A1B2C3D4E5F6"
                  className="w-full bg-black/20 border border-white/20 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-white text-center text-lg sm:text-2xl tracking-wider sm:tracking-widest uppercase focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 placeholder:text-white/20 placeholder:tracking-normal placeholder:text-sm sm:placeholder:text-base"
                  maxLength={12}
                />
              </div>

              <div className="flex gap-2 sm:gap-3 pt-2">
                <button
                  onClick={() => setSelectedRole(null)}
                  disabled={isLoading}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors text-xs sm:text-sm font-semibold disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleJoinPartner}
                  disabled={isLoading || pairingCode.length !== 12}
                  className="flex-[2] flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white transition-all text-xs sm:text-sm font-semibold disabled:opacity-50"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Connect Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
