'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useUser, UserButton } from '@clerk/nextjs'
import { useOffline } from '@/lib/OfflineContext'
import { User as ProfileIcon, Bell as BellIcon, Shield as ShieldIcon, HelpCircle as HelpIcon, Languages, Users as UsersIcon } from 'lucide-react'
import PrivacySettingsContent from './PrivacySettingsModal'
import HealthProfileSettings from './HealthProfileSettings'
import NotificationSettings from './NotificationSettings'
import SupportSettings from './SupportSettings'
import LanguageSettings from '../settings/LanguageSettings'
import PartnerSharing from '../settings/PartnerSharing'

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const t = useTranslations('Navbar')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useUser()
  const { isOffline, pendingSyncCount, isSyncing } = useOffline()

  const role = user?.publicMetadata?.role
  const isPartner = role === 'partner'

  const NAV_ITEMS = isPartner ? [] : [
    { key: 'dashboard', label: t('dashboard'), href: `/${locale}` },
    { key: 'track',     label: t('track'),     href: `/${locale}/track` },
    { key: 'insights',  label: t('insights'),  href: `/${locale}/insights` },
    { key: 'community', label: t('community'), href: `/${locale}/community` },
    { key: 'self-care', label: t('selfCare'),  href: `/${locale}/self-care` },
  ]

  const handleLogToday = () => {
    if (pathname === `/${locale}/track`) {
      const el = document.getElementById('daily-log-section')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else if (pathname === `/${locale}` || pathname === '/') {
      const el = document.getElementById('daily-log-section')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else {
      router.push(`/${locale}/track#daily-log-section`)
    }
  }

  const isActive = (href) => {
    if (href === `/${locale}`) return pathname === `/${locale}` || pathname === '/'
    if (href === `/${locale}/partner`) return pathname === `/${locale}/partner`
    return pathname.startsWith(href)
  }

  return (
    <nav className="glass flex flex-col md:flex-row items-center justify-between px-4 py-3 sm:px-6 sm:py-4 gap-3 md:gap-5 relative">
      {/* Top Row (Mobile) / Left Side (Desktop) */}
      <div className="flex justify-between items-center w-full md:w-auto">
        <div className="logo text-lg sm:text-2xl flex items-center gap-2">
          <span>
            <span className="logo-her">Her</span>
            <span className="logo-cycle">Cycle</span>
            <span className="logo-dot"> AI</span>
            🌸
          </span>
          {isOffline && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 whitespace-nowrap animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              {t('offline')}
            </span>
          )}
          {!isOffline && pendingSyncCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping"></span>
              {t('syncPending')} ({pendingSyncCount})
            </span>
          )}
          {!isOffline && isSyncing && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
              <svg className="animate-spin h-2.5 w-2.5 text-blue-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('syncing')}
            </span>
          )}
        </div>
        
        {/* Hamburger Icon */}
        {NAV_ITEMS.length > 0 && (
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
        )}
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
      <div className="nav-right flex items-center justify-center md:justify-end gap-2 sm:gap-3 w-full md:w-auto overflow-visible pb-0">
        {!isPartner && (
          <button className="btn-pill nav-action nav-log-btn shrink-0 px-3 py-1.5 sm:px-5 text-[12px] sm:text-sm whitespace-nowrap" onClick={handleLogToday}>
            {t('logToday')}
          </button>
        )}

        <UserButton
          userProfileProps={{
            appearance: {
              variables: {
                colorBackground: 'transparent',
                colorText: 'white',
                colorTextSecondary: 'rgba(255, 255, 255, 0.7)',
                colorPrimary: '#e8527e',
              },
              elements: {
                modalContent: {
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 8px 32px 0 rgba(228, 115, 168, 0.3)',
                  color: 'white'
                },
                navbar: {
                  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                },
                navbarButton: "hover:bg-white/10 data-[active=true]:bg-white/20",
                scrollBox: "bg-transparent",
                dividerLine: "bg-white/10",
                badge: "bg-white/10 border-white/20 text-white",
                button: "hover:bg-white/10 border-white/20 text-white",
                button__danger: "text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-5 py-2.5 rounded-xl transition-all shadow-lg font-medium",
                profileSectionPrimaryButton__danger: "text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-5 py-2.5 rounded-xl transition-all shadow-lg font-medium",
                profileSectionTitleText: "text-white/70",
                formFieldInput: "bg-white/5 border-white/10 text-white",
                formFieldLabel: "text-white/70",
                watermark: { display: 'none' },
                footer: { display: 'none' },
              }
            }
          }}
          appearance={{
            variables: {
              colorBackground: 'rgba(255, 255, 255, 0.15)',
              colorText: 'white',
              colorTextSecondary: 'rgba(255, 255, 255, 0.8)',
            },
            elements: {
              avatarBox: "w-10 h-10 sm:w-12 sm:h-12 shadow-md border-2 border-white/20 transition-transform hover:scale-105",
              userButtonPopoverCard: {
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px 0 rgba(228, 115, 168, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '16px',
              },
              userPreviewMainIdentifier: "font-bold",
              userButtonPopoverActionButton: "hover:bg-white/10 transition-colors rounded-xl",
              userButtonPopoverActionButtonText: "font-medium",
              userButtonPopoverFooter: "hidden",
              userPreview: "hover:bg-white/5 transition-colors rounded-xl",
              watermark: { display: 'none' },
              footer: { display: 'none' },
            }
          }}
        >
          <UserButton.UserProfilePage label="Language" url="language" labelIcon={<Languages className="w-4 h-4" />}>
            <LanguageSettings />
          </UserButton.UserProfilePage>
          <UserButton.UserProfilePage label="Partner Sharing" url="partner-sharing" labelIcon={<UsersIcon className="w-4 h-4" />}>
            <PartnerSharing />
          </UserButton.UserProfilePage>
          <UserButton.UserProfilePage label="Data & Privacy" url="data-privacy" labelIcon={<ShieldIcon className="w-4 h-4" />}>
            <PrivacySettingsContent />
          </UserButton.UserProfilePage>
          <UserButton.UserProfilePage label="Health Profile" url="health-profile" labelIcon={<ProfileIcon className="w-4 h-4" />}>
            <HealthProfileSettings />
          </UserButton.UserProfilePage>
          <UserButton.UserProfilePage label="Notifications" url="notifications" labelIcon={<BellIcon className="w-4 h-4" />}>
            <NotificationSettings />
          </UserButton.UserProfilePage>
          <UserButton.UserProfilePage label="Help & Support" url="support" labelIcon={<HelpIcon className="w-4 h-4" />}>
            <SupportSettings />
          </UserButton.UserProfilePage>
        </UserButton>
      </div>
    </nav>
  )
}
