'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/LanguageContext'
import { useClerk } from '@clerk/nextjs'
import { useOffline } from '@/lib/OfflineContext'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/' },
  { key: 'track',     label: 'Track',     href: '/track' },
  { key: 'insights',  label: 'Insights',  href: '/insights' },
  { key: 'chat',      label: 'Chat',      href: '/chat' },
]

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { language, setLanguage } = useLanguage()
  const router   = useRouter()
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { isOffline, pendingSyncCount, isSyncing } = useOffline()

  const handleLogToday = () => {
    if (pathname === '/') {
      const el = document.getElementById('daily-log-section')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else {
      router.push('/track')
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const isActive = (href) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="glass flex flex-col md:flex-row items-center justify-between px-4 py-3 sm:px-6 sm:py-4 gap-3 md:gap-5 relative">
      {/* Top Row (Mobile) / Left Side (Desktop) */}
      <div className="flex justify-between items-center w-full md:w-auto">
        <div className="logo text-lg sm:text-2xl flex items-center gap-2">
          <span>Her<em>Cycle</em><span className="logo-dot"> AI</span> 🌸</span>
          {isOffline && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 whitespace-nowrap animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              Offline
            </span>
          )}
          {!isOffline && pendingSyncCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping"></span>
              Sync Pending ({pendingSyncCount})
            </span>
          )}
          {!isOffline && isSyncing && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
              <svg className="animate-spin h-2.5 w-2.5 text-blue-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Syncing
            </span>
          )}
        </div>
        
        {/* Hamburger Icon */}
        <button 
          className="nav-menu-btn md:hidden text-white/80 hover:text-white p-1"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen 
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Desktop Links */}
      <ul className="hidden md:flex flex-1 justify-center gap-2">
        {NAV_ITEMS.map(({ key, label, href }) => (
          <li key={key}>
            <Link
              href={href}
              className={isActive(href) ? 'active' : ''}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden w-full flex flex-col gap-2 py-3 border-t border-white/20 mt-1 mb-2">
          {NAV_ITEMS.map(({ key, label, href }) => (
            <Link
              key={key}
              href={href}
              className={`nav-mobile-link block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive(href) ? 'active bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="nav-right flex flex-nowrap items-center justify-center md:justify-end gap-2 sm:gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
        <div className="lang-toggle shrink-0">
          <button
            className={`lang-btn ${language === 'EN' ? 'active' : ''}`}
            onClick={() => setLanguage('EN')}
          >EN</button>
          <button
            className={`lang-btn ${language === 'हि' ? 'active' : ''}`}
            onClick={() => setLanguage('हि')}
          >हि</button>
        </div>
        <button className="btn-pill nav-action nav-log-btn shrink-0 px-3 py-1.5 sm:px-5 text-[12px] sm:text-sm whitespace-nowrap" onClick={handleLogToday}>
          Log Today
        </button>
        <button
          className="btn-pill nav-action nav-signout-btn shrink-0 px-3 py-1.5 sm:px-5 text-[12px] sm:text-sm whitespace-nowrap"
          onClick={handleLogout}
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.3)',
          }}
          title="Log out"
        >
          Sign Out
        </button>
      </div>
    </nav>
  )
}
