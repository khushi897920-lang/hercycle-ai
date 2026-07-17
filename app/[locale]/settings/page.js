'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import Navbar from '@/components/layout/Navbar'
import toast from 'react-hot-toast'
import { Download, AlertTriangle, Trash2, Shield } from 'lucide-react'
import PartnerSharing from '@/components/settings/PartnerSharing'
import PrivacyModal from '@/components/modals/PrivacyModal'

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [isDeleting, setIsDeleting] = useState(false)


  const handleDeleteAccount = async () => {
    if (!confirm('WARNING: This will permanently delete your account, including all cycle logs, predictions, and profile data. This action CANNOT be undone. Are you sure you want to proceed?')) {
      return
    }

    setIsDeleting(true)
    const toastId = toast.loading('Deleting account...')
    try {
      // Clerk's user.delete() deletes the user and triggers the user.deleted webhook
      await user.delete()
      await signOut()
      toast.success('Account deleted successfully.', { id: toastId })
      router.push('/')
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete account. Please try again.', { id: toastId })
      setIsDeleting(false)
    }
  }

  return (
    <div className="page flex flex-col min-h-screen">
      <Navbar />

      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-2xl mx-auto px-4 pb-20">
        <div className="w-full">
          <h1 className="text-3xl font-bold text-white mb-8 text-center sm:text-left">Privacy & Data</h1>

          <div className="glass p-6 sm:p-8 rounded-3xl space-y-8 shadow-2xl relative overflow-hidden">
            {/* Subtle glow behind the card */}
            <div className="absolute top-[-50%] right-[-50%] w-[100%] h-[100%] bg-white/5 blur-3xl rounded-full pointer-events-none"></div>

            <PartnerSharing />
            <hr className="border-white/10 relative z-10" />

            {/* Privacy & Data Settings Trigger */}
            <section className="space-y-4 relative z-10">
              <h2 className="text-xl font-semibold text-white">Privacy & Data Control</h2>
              <p className="text-white/70 text-sm">
                Manage your data privacy settings, AI analysis permissions, and export your health data.
              </p>
              <PrivacyModal 
                onDeleteAccount={handleDeleteAccount}
                trigger={
                  <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition-colors font-medium">
                    <Shield className="w-4 h-4" />
                    Manage Privacy & Data
                  </button>
                }
              />
            </section>

            <hr className="border-white/10 relative z-10" />

            {/* Account Deletion Section */}
            <section className="space-y-4 relative z-10">
              <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-3">
                  <h3 className="font-semibold text-red-300">Delete Account</h3>
                  <p className="text-red-300/70 text-sm leading-relaxed">
                    Permanently delete your account and all associated data from our servers. 
                    This will immediately trigger a hard wipe of your cycles, logs, and profile.
                    This action is irreversible.
                  </p>
                  <button 
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-5 py-2.5 rounded-xl transition-colors font-medium border border-red-500/30 mt-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Deleting Account...' : 'Delete My Account'}
                  </button>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
