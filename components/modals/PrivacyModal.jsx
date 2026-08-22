'use client'

import React from 'react'
import PrivacySettingsModal from './PrivacySettingsModal'

export default function PrivacyModal({ trigger, initialProfile, isOpen, onOpenChange }) {
  return (
    <PrivacySettingsModal
      trigger={trigger}
      initialProfile={initialProfile}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  )
}
