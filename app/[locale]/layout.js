
import { ClerkProvider } from '@clerk/nextjs'
import { LanguageProvider } from '@/lib/LanguageContext'
import { OfflineProvider } from '@/lib/OfflineContext'
import { Toaster } from 'react-hot-toast'
import Script from 'next/script'
import '../globals.css'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: false,
}

export const metadata = {
  title: 'HerCycle AI — Smart Menstrual Health Tracker',
  description: 'AI-powered period tracking with PCOD risk prediction in Hindi & English. Know your body, love yourself.',
  keywords: ['period tracker', 'PCOD', 'menstrual health', 'AI health', 'women health India'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HerCycle AI',
  },
  openGraph: {
    title: 'HerCycle AI',
    description: 'Track cycles, predict with AI, screen PCOS risk — beautifully, in your language.',
    url: 'https://hercycle-ai.vercel.app',
    siteName: 'HerCycle AI',
    images: [
      {
        url: 'https://hercycle-ai.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'HerCycle AI — Know your body, love yourself'
      }
    ],
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HerCycle AI',
    description: 'Track cycles, predict with AI, screen PCOS risk — beautifully, in your language.',
    images: ['https://hercycle-ai.vercel.app/og-image.png']
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icon-192.png'
  }
}

import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import ChatFAB from '@/components/layout/ChatFAB';

import { EncryptionProvider } from '@/lib/EncryptionContext'

export default async function RootLayout({ children, params }) {
  let { locale } = await params;
  if (locale !== 'en' && locale !== 'hi') {
    locale = 'en';
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <ClerkProvider clockSkewInMs={30000}>
      <html lang={locale}>
        <head>
          <link rel="apple-touch-icon" href="/icon-192.png" />
          <link rel="apple-touch-icon" sizes="152x152" href="/icon-192.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/icon-192.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        </head>
        <body className="w-full" suppressHydrationWarning>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <EncryptionProvider>
              <OfflineProvider>
                <LanguageProvider>
                  <div className="app-decor" aria-hidden="true">
                    <div className="blob"></div>
                    <div className="blob"></div>
                    <div className="blob"></div>

                    <div className="particle" style={{ left: '8%', animationDuration: '13s', animationDelay: '0s' }}>&#10024;</div>
                    <div className="particle" style={{ left: '22%', animationDuration: '17s', animationDelay: '3.5s' }}>&#127800;</div>
                    <div className="particle" style={{ left: '38%', animationDuration: '14s', animationDelay: '7s' }}>&#128171;</div>
                    <div className="particle" style={{ left: '52%', animationDuration: '19s', animationDelay: '1s' }}>&#127799;</div>
                    <div className="particle" style={{ left: '67%', animationDuration: '11s', animationDelay: '5s' }}>&#10024;</div>
                    <div className="particle" style={{ left: '80%', animationDuration: '16s', animationDelay: '2s' }}>&#128149;</div>
                    <div className="particle" style={{ left: '91%', animationDuration: '12s', animationDelay: '8s' }}>&#127800;</div>
                  </div>
                  {children}
                  <ChatFAB />
                  <Toaster
                   position="top-center"


                    toastOptions={{
                      style: {
                        background: 'rgba(30,12,40,0.95)',
                        color: '#fff',
                        border: '1px solid rgba(232,82,126,0.4)',
                        borderRadius: '12px',
                        backdropFilter: 'blur(12px)',
                        fontFamily: 'Inter, sans-serif',
                      },
                      success: { iconTheme: { primary: '#e8527e', secondary: '#fff' } },
                      error: { iconTheme: { primary: '#f87171', secondary: '#fff' } },
                    }}
                  />
                </LanguageProvider>
              </OfflineProvider>
            </EncryptionProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
