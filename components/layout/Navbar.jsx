'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/LanguageContext'
import { createClient } from '@/lib/supabase-client'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/' },
  { key: 'track',     label: 'Track',     href: '/track' },
  { key: 'insights',  label: 'Insights',  href: '/insights' },
  { key: 'chat',      label: 'Chat',      href: '/chat' },
]

export default function Navbar() {
  const { language, setLanguage } = useLanguage()
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogToday = () => {
    if (pathname === '/') {
      const el = document.getElementById('daily-log-section')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else {
      router.push('/track')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const isActive = (href) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="glass">
      <div className="logo">
        Her<em>Cycle</em><span className="logo-dot"> AI</span> 🌸
      </div>
      <ul>
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
      <div className="nav-right">
        <div className="lang-toggle">
          <button
            className={`lang-btn ${language === 'EN' ? 'active' : ''}`}
            onClick={() => setLanguage('EN')}
          >EN</button>
          <button
            className={`lang-btn ${language === 'हि' ? 'active' : ''}`}
            onClick={() => setLanguage('हि')}
          >हि</button>
        </div>
        <button className="btn-pill" onClick={handleLogToday}>
          Log Today
        </button>
        <button
          className="btn-pill"
          onClick={handleLogout}
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.3)',
            marginLeft: '6px',
          }}
          title="Log out"
        >
          Sign Out
        </button>
      </div>
    </nav>
  )
}
