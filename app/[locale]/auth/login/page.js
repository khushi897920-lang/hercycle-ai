'use client'
import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <div style={styles.page}>
      <div style={styles.blob1} />
      <div style={styles.blob2} />
      <div style={styles.center}>
        <div style={styles.logo}>Her<em>Cycle</em> <span style={{color:'#f472b6'}}>AI</span> 🌸</div>
        <SignIn
          routing="hash"
          afterSignInUrl="/"
          appearance={{
            elements: {
              rootBox: { width: '100%', maxWidth: '420px' },
              card: {
                background: 'rgba(255,255,255,0.13)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '24px',
                boxShadow: '0 20px 60px rgba(157,63,122,0.3)',
              },
              headerTitle: { color: 'rgba(255,255,255,0.95)', fontWeight: 700 },
              headerSubtitle: { color: 'rgba(255,255,255,0.6)' },
              socialButtonsBlockButton: {
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.35)',
                color: 'rgba(255,255,255,0.9)',
                borderRadius: '12px',
              },
              dividerLine: { background: 'rgba(255,255,255,0.2)' },
              dividerText: { color: 'rgba(255,255,255,0.5)' },
              formFieldLabel: { color: 'rgba(255,255,255,0.75)', fontWeight: 500 },
              formFieldInput: {
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.95)',
                borderRadius: '12px',
              },
              formButtonPrimary: {
                background: 'linear-gradient(135deg,#c9375f,#7c2d90)',
                borderRadius: '12px',
                fontWeight: 600,
                boxShadow: '0 4px 20px rgba(201,55,95,0.4)',
              },
              footerActionLink: { color: '#f9a8d4', fontWeight: 600 },
              identityPreviewText: { color: 'rgba(255,255,255,0.8)' },
              identityPreviewEditButtonIcon: { color: 'rgba(255,255,255,0.6)' },
            },
            variables: {
              colorBackground: 'transparent',
              colorText: 'rgba(255,255,255,0.95)',
              colorTextSecondary: 'rgba(255,255,255,0.6)',
              colorInputBackground: 'rgba(255,255,255,0.12)',
              colorInputText: 'rgba(255,255,255,0.95)',
            }
          }}
        />
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(155deg,#fce4ec 0%,#f5a8d0 25%,#e065b5 50%,#b83da0 72%,#7c2d90 90%,#4a1580 100%)',
    padding: '20px',
  },
  blob1: {
    position: 'fixed', top: '-200px', left: '-200px',
    width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(255,150,210,0.35) 0%,transparent 70%)',
    filter: 'blur(60px)', pointerEvents: 'none',
  },
  blob2: {
    position: 'fixed', bottom: '-150px', right: '-150px',
    width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(192,100,252,0.28) 0%,transparent 70%)',
    filter: 'blur(60px)', pointerEvents: 'none',
  },
  center: {
    position: 'relative', zIndex: 10,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
    width: '100%', maxWidth: '420px',
  },
  logo: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: '1.6rem', fontWeight: 700,
    color: 'rgba(255,255,255,0.95)',
  },
}
