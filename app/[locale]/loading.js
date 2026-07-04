export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(155deg,#1a0533 0%,#2d0a4e 50%,#1a0533 100%)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '2.5rem',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>🌸</div>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '1rem', fontSize: '0.9rem' }}>
          Loading…
        </p>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
