import { Playfair_Display, Inter } from 'next/font/google'
import { LanguageProvider } from '@/lib/LanguageContext'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const playfair = Playfair_Display({ 
  subsets: ['latin'],
  variable: '--font-playfair'
})

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter'  
})

export const metadata = {
  title: 'HerCycle AI — Smart Menstrual Health Tracker',
  description: 'AI-powered period tracking with PCOD risk prediction in Hindi & English. Know your body, love yourself.',
  keywords: ['period tracker', 'PCOD', 'menstrual health', 'AI health', 'women health India'],
  openGraph: {
    title: 'HerCycle AI',
    description: 'AI-powered menstrual health companion',
    url: 'https://hercycle-ai.vercel.app',
    siteName: 'HerCycle AI',
    images: [
      {
        url: 'https://hercycle-ai.vercel.app/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'HerCycle AI'
      }
    ],
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HerCycle AI',
    description: 'AI-powered menstrual health companion',
    images: ['https://hercycle-ai.vercel.app/og-image.jpg']
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg'
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className={`${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
        <LanguageProvider>
          {children}
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
              error:   { iconTheme: { primary: '#f87171', secondary: '#fff' } },
            }}
          />
        </LanguageProvider>
      </body>
    </html>
  )
}