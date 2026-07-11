'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import PartnerSharing from '@/components/settings/PartnerSharing'

export default function PartnerSharingModal({ isOpen, setIsOpen }) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-lg z-[101] max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200 rounded-3xl">
          
          <div className="glass p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden" style={{ background: 'rgba(50, 10, 40, 0.45)' }}>
            {/* Subtle glow behind the card */}
            <div className="absolute top-[-50%] right-[-50%] w-[100%] h-[100%] bg-white/5 blur-3xl rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-center relative z-10 mb-2">
              <Dialog.Title className="text-2xl font-bold text-white">Partner Access</Dialog.Title>
              <Dialog.Description className="sr-only">
                Manage your partner pairing and privacy settings.
              </Dialog.Description>
              <Dialog.Close asChild>
                <button className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="relative z-10 mt-0">
              <PartnerSharing />
            </div>

          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
