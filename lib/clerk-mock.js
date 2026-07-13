'use client'

import React from 'react'

export function ClerkProvider({ children }) {
  return <>{children}</>
}

export function SignIn() {
  const [email, setEmail] = React.useState('jane.doe@example.com');
  
  const handleSignIn = (e) => {
    e.preventDefault();
    window.location.href = '/';
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '400px',
      padding: '2rem',
      borderRadius: '24px',
      backgroundColor: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1a1a1a', textAlign: 'center' }}>Welcome back</h2>
      <p style={{ fontSize: '0.875rem', color: '#666666', marginBottom: '1.5rem', textAlign: 'center' }}>Sign in to continue your wellness journey</p>
      
      <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem', color: '#666666' }}>Email address</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid #fce8f0',
              backgroundColor: '#fff',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem', color: '#666666' }}>Password</label>
          <input 
            type="password" 
            defaultValue="••••••••"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid #fce8f0',
              backgroundColor: '#fff',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <button 
          type="submit"
          style={{
            background: 'linear-gradient(90deg, #d9477a, #f78fb3)',
            color: '#ffffff',
            borderRadius: '12px',
            border: 'none',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginTop: '0.5rem'
          }}
        >
          Continue
        </button>
      </form>
      
      <p style={{ fontSize: '0.875rem', color: '#666666', marginTop: '1.5rem', textAlign: 'center' }}>
        Don't have an account?{' '}
        <span 
          onClick={() => window.location.href = '/auth/signup'} 
          style={{ color: '#d9477a', cursor: 'pointer', fontWeight: '600' }}
        >
          Sign up
        </span>
      </p>
    </div>
  );
}

export function SignUp() {
  const [email, setEmail] = React.useState('');
  
  const handleSignUp = (e) => {
    e.preventDefault();
    window.location.href = '/';
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '400px',
      padding: '2rem',
      borderRadius: '24px',
      backgroundColor: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1a1a1a', textAlign: 'center' }}>Create an account</h2>
      <p style={{ fontSize: '0.875rem', color: '#666666', marginBottom: '1.5rem', textAlign: 'center' }}>Sign up to start your wellness journey</p>
      
      <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem', color: '#666666' }}>Email address</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid #fce8f0',
              backgroundColor: '#fff',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem', color: '#666666' }}>Password</label>
          <input 
            type="password" 
            placeholder="Create password"
            required
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid #fce8f0',
              backgroundColor: '#fff',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <button 
          type="submit"
          style={{
            background: 'linear-gradient(90deg, #d9477a, #f78fb3)',
            color: '#ffffff',
            borderRadius: '12px',
            border: 'none',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginTop: '0.5rem'
          }}
        >
          Continue
        </button>
      </form>
      
      <p style={{ fontSize: '0.875rem', color: '#666666', marginTop: '1.5rem', textAlign: 'center' }}>
        Already have an account?{' '}
        <span 
          onClick={() => window.location.href = '/auth/login'} 
          style={{ color: '#d9477a', cursor: 'pointer', fontWeight: '600' }}
        >
          Sign in
        </span>
      </p>
    </div>
  );
}


export function UserButton() {
  return <button>Mock User Profile</button>
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: 'mock_user_12345',
    sessionId: 'mock_session_12345',
    getToken: async () => 'mock_token',
    signOut: async () => console.log('Mock sign out')
  }
}

export function useUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: 'mock_user_12345',
      firstName: 'Jane',
      lastName: 'Doe',
      imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      primaryEmailAddress: { emailAddress: 'jane.doe@example.com' },
      publicMetadata: { role: 'primary' }
    }
  }
}

export function useSession() {
  return {
    isLoaded: true,
    session: { id: 'mock_session_12345' }
  }
}

export function useClerk() {
  return {
    signOut: async () => console.log('Mock sign out')
  }
}
