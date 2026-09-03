'use client'

import React from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import TeamManagement from '@/components/admin/TeamManagement'

export default function TeamManagementPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a' }}>
      <Navbar />
      <main style={{ flex: 1, padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <TeamManagement />
      </main>
      <Footer />
    </div>
  )
}
