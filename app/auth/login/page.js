'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.blob1} />
      <div style={styles.blob2} />

      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>Her<em>Cycle</em> <span style={{color:'var(--rose-bright)'}}>AI</span> 🌸</div>
          <h1 style={styles.title}>Welcome back</h1>
          <p style={styles.subtitle}>Log in to your health dashboard</p>
        </div>

        {error && (
          <div style={styles.errorBox}>⚠️ {error}</div>
        )}

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
              onFocus={e => e.target.style.borderColor = 'var(--rose-mid)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
              onFocus={e => e.target.style.borderColor = 'var(--rose-mid)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
            />
          </div>
          <button type="submit" disabled={loading} style={styles.btnPrimary}>
            {loading ? 'Logging in…' : 'Log In 💕'}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <span style={styles.dividerLine} />
        </div>

        <button onClick={handleGoogleLogin} disabled={googleLoading} style={styles.btnGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48" style={{marginRight:10,flexShrink:0}}>
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          {googleLoading ? 'Connecting…' : 'Continue with Google'}
        </button>

        <p style={styles.switchText}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" style={styles.link}>Sign up</Link>
        </p>
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
  card: {
    position: 'relative', zIndex: 10,
    background: 'rgba(255,255,255,0.14)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '24px',
    padding: '44px 40px',
    width: '100%', maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(157,63,122,0.3), inset 0 1px 0 rgba(255,255,255,0.4)',
  },
  header: { textAlign: 'center', marginBottom: '28px' },
  logo: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: '1.5rem', fontWeight: 700,
    color: 'rgba(255,255,255,0.95)', marginBottom: '12px',
  },
  title: {
    fontSize: '1.6rem', fontWeight: 700,
    color: 'rgba(255,255,255,0.95)', marginBottom: '6px',
  },
  subtitle: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' },
  errorBox: {
    background: 'rgba(248,113,113,0.2)',
    border: '1px solid rgba(248,113,113,0.5)',
    borderRadius: '10px', padding: '10px 14px',
    color: '#fca5a5', fontSize: '0.875rem',
    marginBottom: '18px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.85rem', fontWeight: 500, color: 'rgba(255,255,255,0.75)' },
  input: {
    padding: '12px 14px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.25)',
    color: 'rgba(255,255,255,0.95)', fontSize: '0.95rem',
    outline: 'none', transition: 'border-color 0.2s',
  },
  btnPrimary: {
    marginTop: '4px', padding: '13px',
    background: 'linear-gradient(135deg,var(--rose-deep),var(--plum))',
    border: 'none', borderRadius: '12px',
    color: '#fff', fontWeight: 600, fontSize: '1rem',
    cursor: 'pointer', transition: 'opacity 0.2s, transform 0.15s',
    boxShadow: '0 4px 20px rgba(201,55,95,0.4)',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: '10px',
    margin: '20px 0',
  },
  dividerLine: {
    flex: 1, height: '1px',
    background: 'rgba(255,255,255,0.2)',
  },
  dividerText: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' },
  btnGoogle: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '12px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.18)',
    border: '1px solid rgba(255,255,255,0.35)',
    color: 'rgba(255,255,255,0.9)', fontWeight: 500, fontSize: '0.95rem',
    cursor: 'pointer', transition: 'background 0.2s',
    width: '100%',
  },
  switchText: {
    textAlign: 'center', marginTop: '24px',
    fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)',
  },
  link: { color: 'var(--rose-soft)', fontWeight: 600, textDecoration: 'none' },
}
