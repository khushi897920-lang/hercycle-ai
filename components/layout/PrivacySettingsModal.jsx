'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import * as Dialog from '@radix-ui/react-dialog'
import toast from 'react-hot-toast'
import { Download, AlertTriangle, Trash2, X } from 'lucide-react'

export default function PrivacySettingsModal({ isOpen, setIsOpen }) {
  const { getToken } = useAuth()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  const handleExportData = async () => {
    setIsExporting(true)
    const toastId = toast.loading('Preparing your data...')
    try {
      const token = await getToken()
      const res = await fetch('/api/export-data', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!res.ok) {
        throw new Error('Failed to export data')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'my-hercycle-data.zip'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
      toast.success('Data exported successfully!', { id: toastId })
    } catch (error) {
      console.error(error)
      toast.error('Could not export data. Please try again.', { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return;

    setIsDeleting(true)
    const toastId = toast.loading('Deleting account...')
    try {
      const token = await getToken()
      // Call our backend API to perform the deletion
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!res.ok) {
        throw new Error('Failed to delete account via API')
      }

      toast.success('Account deleted successfully.', { id: toastId })
      setIsOpen(false)
      // Immediately redirect — don't wait for signOut since the account is already gone
      window.location.href = '/en/auth/login'
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete account. Please try again.', { id: toastId })
      setIsDeleting(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-lg z-[101] max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200 rounded-3xl">
          
          <div className="glass p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden" style={{ background: 'rgba(50, 10, 40, 0.45)' }}>
            {/* Subtle glow behind the card */}
            <div className="absolute top-[-50%] right-[-50%] w-[100%] h-[100%] bg-white/5 blur-3xl rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-center relative z-10">
              <Dialog.Title className="text-2xl font-bold text-white">Privacy & Data</Dialog.Title>
              <Dialog.Description className="sr-only">
                Manage your privacy and data settings, including exporting your data or permanently deleting your account.
              </Dialog.Description>
              <Dialog.Close asChild>
                <button className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Data Export Section */}
            <section className="space-y-3 relative z-10">
              <h2 className="text-lg font-semibold text-white">Export Your Data</h2>
              <p className="text-white/70 text-sm">
                Download a copy of all your health data in JSON and CSV formats.
              </p>
              <button 
                onClick={handleExportData}
                disabled={isExporting}
                className="flex items-center justify-center w-full gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition-colors font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exporting...' : 'Export My Data'}
              </button>
            </section>

            <hr className="border-white/10 relative z-10" />

            {/* Account Deletion Section */}
            <section className="space-y-3 relative z-10">
              <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <p className="text-red-300/80 text-xs leading-relaxed">
                    Permanently delete your account and all associated data. This action is irreversible.
                  </p>
                </div>
                <div className="mt-2 w-full">
                  <label className="block text-red-300/90 text-xs mb-1.5 font-semibold">
                    Type <span className="text-white font-bold bg-white/10 px-1 py-0.5 rounded">DELETE</span> to confirm
                  </label>
                  <input 
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="w-full bg-black/20 border border-red-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 placeholder:text-white/20 transition-all"
                    placeholder="DELETE"
                  />
                </div>
                <button 
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmation !== 'DELETE'}
                  className="flex items-center justify-center w-full gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-5 py-2.5 rounded-xl transition-colors font-medium border border-red-500/30 mt-1 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </section>

          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
