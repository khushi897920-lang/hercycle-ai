"use client";

import { useState } from 'react';
import HelpModal from '../modals/HelpModal';

export default function SupportSettings() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="p-4 sm:p-8 flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in duration-300 mt-8">
      <div className="p-4 bg-blue-500/10 rounded-full mb-2 border border-blue-500/20">
        <span className="text-3xl">🛟</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Help & Support</h1>
      <p className="text-white/60 text-sm sm:text-base leading-relaxed max-w-md">
        Need assistance or have feedback? We are here to help. Check our FAQ or report an issue directly to our team.
      </p>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-full transition-colors shadow-lg shadow-blue-500/20"
      >
        Get Help
      </button>
      <HelpModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
