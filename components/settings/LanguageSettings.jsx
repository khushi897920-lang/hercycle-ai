'use client'

import { useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Languages, Check } from 'lucide-react'

export default function LanguageSettings() {
  const locale = useLocale()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const switchLanguage = (newLocale) => {
    if (newLocale === locale) return
    
    startTransition(() => {
      const segments = pathname.split('/')
      if (segments.length > 1) {
        segments[1] = newLocale
      }
      const newPath = segments.join('/') || '/'
      window.location.href = newPath
    })
  }

  const languages = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  ]

  return (
    <div className="flex flex-col gap-6 p-1">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Language Preferences</h2>
        <p className="text-sm text-white/70 mb-6">
          Choose the language you want to use in the application.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => switchLanguage(lang.code)}
            disabled={isPending}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
              locale === lang.code
                ? 'border-[#e8527e] bg-[#e8527e]/10'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                locale === lang.code ? 'bg-[#e8527e]/20 text-[#e8527e]' : 'bg-white/10 text-white/70'
              }`}>
                <Languages className="w-5 h-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className={`font-semibold ${locale === lang.code ? 'text-[#e8527e]' : 'text-white'}`}>
                  {lang.native}
                </span>
                <span className="text-xs text-white/50">{lang.label}</span>
              </div>
            </div>
            
            {locale === lang.code && (
              <Check className="w-5 h-5 text-[#e8527e]" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
