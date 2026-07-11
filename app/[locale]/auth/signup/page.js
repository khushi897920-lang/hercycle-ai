'use client'

import { SignUp } from '@clerk/nextjs'
import Image from 'next/image'
import { CalendarHeart, BarChart3, ShieldPlus } from 'lucide-react'
import styles from '../login/page.module.css'

export default function SignupPage() {
  return (
    <main className={styles.page}>
      {/* Very thin curved flowing lines background */}
      <svg className={styles.wavePattern} viewBox="0 0 1440 320" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,200 C400,350, 600,50, 900,200 C1200,350, 1300,100, 1440,200" stroke="rgba(217, 71, 122, 0.05)" strokeWidth="0.5" fill="none" />
        <path d="M0,150 C300,300, 700,0, 1000,150 C1200,250, 1350,150, 1440,150" stroke="rgba(217, 71, 122, 0.03)" strokeWidth="0.5" fill="none" />
      </svg>

      {/* Moon phase icons */}
      <div className={styles.moonPhases} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"></circle></svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12.79A9 9 0 1 0 12.79 3 7 7 0 0 1 3 12.79z"></path></svg>
      </div>

      {/* Background corner blobs */}
      <div className={styles.cornerBlobTopLeft} aria-hidden="true"></div>
      <div className={styles.cornerBlobBottomRight} aria-hidden="true"></div>

      {/* Floating floral decorations */}
      <div className={styles.particles} aria-hidden="true">
        <span className={styles.particle} style={{ top: '6%', left: '12%', animationDelay: '0s' }}>✿</span>
        <span className={styles.particle} style={{ top: '15%', left: '35%', animationDelay: '1.5s' }}>❀</span>
        <span className={styles.particle} style={{ top: '78%', left: '6%', animationDelay: '3s' }}>✿</span>
        <span className={styles.particle} style={{ top: '88%', left: '38%', animationDelay: '4.5s' }}>❀</span>
        <span className={styles.flowerOutline} style={{ top: '22%', left: '18%', animationDelay: '0.2s' }}>❁</span>
        <span className={styles.flowerOutline} style={{ top: '65%', left: '38%', animationDelay: '1.5s' }}>❁</span>
        <span className={styles.dotParticle} style={{ top: '25%', right: '15%', animationDelay: '1.1s', backgroundColor: '#FAD6E3' }}></span>
        <span className={styles.dotParticle} style={{ top: '45%', left: '20%', animationDelay: '2.8s', backgroundColor: '#F8E7B3' }}></span>
        <span className={styles.dotParticle} style={{ top: '70%', right: '20%', animationDelay: '0.4s', backgroundColor: '#FFDAB9' }}></span>
        <span className={styles.petalParticle} style={{ top: '30%', left: '10%', animationDelay: '0.5s' }}></span>
        <span className={styles.petalParticle} style={{ top: '60%', left: '40%', animationDelay: '2.5s' }}></span>
      </div>

      <section className={styles.hero} aria-labelledby="signup-title">
        <div className={styles.heroMain}>
          <div className={styles.heroCopy}>
            <div className={`logo text-lg sm:text-2xl ${styles.brand}`}>
              Her<em>Cycle</em><span className="logo-dot"> AI</span> 🌸
            </div>
            <h1 id="signup-title" className={styles.title}>
              <span className={styles.titleCycle}>Your cycle.</span>
              <span className={styles.titlePower}>Your power.</span>
            </h1>
            <p className={styles.subtitle}>
              AI-powered insights to help you understand your body better and live your best every day.
            </p>
          </div>

          <div className={styles.illustrationWrapper} aria-label="Woman illustration">
            <div className={styles.sunCircle} aria-hidden="true"></div>
            <div className={styles.blurredRadialGlow} aria-hidden="true"></div>
            <div className={styles.centerRadialLight} aria-hidden="true"></div>
            <div className={styles.headGlow} aria-hidden="true"></div>
            {/* Sparkle stars around glow area */}
            <span className={styles.starSparkle} style={{ top: '20%', left: '20%', animationDelay: '2.8s' }}>✦</span>
            <span className={styles.starSparkle} style={{ top: '15%', left: '80%', animationDelay: '0.4s' }}>✧</span>
            <span className={styles.starSparkle} style={{ top: '45%', right: '15%', animationDelay: '1.2s' }}>✦</span>
            <span className={styles.starSparkle} style={{ top: '80%', left: '10%', animationDelay: '2.1s' }}>✧</span>

            <div className={styles.glowingAura} aria-hidden="true"></div>
            <div className={styles.glowingCircle1} aria-hidden="true"></div>
            <div className={styles.glowingCircle2} aria-hidden="true"></div>
            <div className={styles.pinkGlow}></div>
            <div className={styles.yellowGlow}></div>
            <div className={styles.organicBlobPink} aria-hidden="true"></div>
            <div className={styles.organicBlobCream} aria-hidden="true"></div>
            <div className={styles.organicBlobLavender} aria-hidden="true"></div>
            <div className={styles.organicBlob} aria-hidden="true"></div>
            <div className={styles.accentDotTop} aria-hidden="true"></div>
            <div className={styles.accentDotBottom} aria-hidden="true"></div>
            {/* Background silhouettes and botanical lines */}
            <svg className={styles.lowerFloralStem} viewBox="0 0 100 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
               <path d="M50 200 C50 100 20 120 10 50 C30 80 40 100 50 150" stroke="currentColor" strokeWidth="1.5"/>
               <path d="M50 150 C50 80 80 100 90 30 C70 60 60 80 50 100" stroke="currentColor" strokeWidth="1.5"/>
               <path d="M50 200 L50 0" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <svg className={styles.lineArtLeaf1} viewBox="0 0 100 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
               <path d="M50 200 C50 150 20 120 10 80 C30 90 40 120 50 150" stroke="rgba(250, 214, 227, 0.4)" strokeWidth="1"/>
               <path d="M50 150 C50 100 80 80 90 40 C70 50 60 80 50 100" stroke="rgba(250, 214, 227, 0.4)" strokeWidth="1"/>
               <path d="M50 200 L50 0" stroke="rgba(250, 214, 227, 0.4)" strokeWidth="1"/>
            </svg>
            <svg className={styles.leafSilhouette} aria-hidden="true" viewBox="0 0 100 300" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 300 Q40 150 50 0 Q60 150 50 300" fill="rgba(232, 180, 196, 0.1)"/>
              <path d="M50 250 Q20 220 10 180 Q30 200 50 250" fill="rgba(232, 180, 196, 0.1)"/>
              <path d="M50 200 Q80 170 90 130 Q70 150 50 200" fill="rgba(232, 180, 196, 0.1)"/>
              <path d="M50 150 Q20 120 10 80 Q30 100 50 150" fill="rgba(232, 180, 196, 0.1)"/>
            </svg>
            {/* Decorative leaf branches */}
            <svg className={styles.leafBranch} aria-hidden="true" viewBox="0 0 80 220" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M40 220 Q38 160 40 100 Q42 40 40 0" stroke="rgba(232,180,196,0.25)" strokeWidth="1.5" fill="none"/>
              <ellipse cx="22" cy="50" rx="15" ry="24" transform="rotate(-35 22 50)" fill="rgba(250,214,227,0.4)"/>
              <ellipse cx="58" cy="90" rx="13" ry="20" transform="rotate(28 58 90)" fill="rgba(250,214,227,0.35)"/>
              <ellipse cx="24" cy="130" rx="11" ry="18" transform="rotate(-22 24 130)" fill="rgba(250,214,227,0.3)"/>
              <ellipse cx="54" cy="165" rx="10" ry="15" transform="rotate(32 54 165)" fill="rgba(250,214,227,0.25)"/>
            </svg>
            {/* Right-side petal accents */}
            <svg className={styles.leafBranchRight} aria-hidden="true" viewBox="0 0 60 140" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M30 140 Q32 90 30 40 Q28 10 30 0" stroke="rgba(232,180,196,0.2)" strokeWidth="1" fill="none"/>
              <ellipse cx="42" cy="35" rx="10" ry="16" transform="rotate(30 42 35)" fill="rgba(250,214,227,0.3)"/>
              <ellipse cx="18" cy="70" rx="9" ry="14" transform="rotate(-25 18 70)" fill="rgba(250,214,227,0.25)"/>
              <ellipse cx="40" cy="105" rx="8" ry="12" transform="rotate(20 40 105)" fill="rgba(250,214,227,0.2)"/>
            </svg>
            <div className={styles.illustrationShadow} aria-hidden="true"></div>
            <Image 
              src="/her.png" 
              alt="Woman illustration" 
              width={440} 
              height={850}
              className={styles.illustrationImage}
              priority
            />
          </div>
        </div>

        <div className={styles.featureList} aria-label="Highlights">
          <div className={styles.featureItem}>
            <div className={styles.iconWrapper} style={{ color: '#d9477a', backgroundColor: 'rgba(217, 71, 122, 0.1)' }}>
              <CalendarHeart size={20} />
            </div>
            <div className={styles.featureText}>
              <span className={styles.featureTitle}>Track with ease</span>
              <span className={styles.featureDesc}>Log your cycle, symptoms, and moods effortlessly.</span>
            </div>
          </div>
          <div className={styles.featureItem}>
            <div className={styles.iconWrapper} style={{ color: '#e8c547', backgroundColor: 'rgba(232, 197, 71, 0.12)' }}>
              <BarChart3 size={20} />
            </div>
            <div className={styles.featureText}>
              <span className={styles.featureTitle}>AI-powered insights</span>
              <span className={styles.featureDesc}>Get personalized predictions and actionable insights.</span>
            </div>
          </div>
          <div className={styles.featureItem}>
            <div className={styles.iconWrapper} style={{ color: '#d9477a', backgroundColor: 'rgba(217, 71, 122, 0.1)' }}>
              <ShieldPlus size={20} />
            </div>
            <div className={styles.featureText}>
              <span className={styles.featureTitle}>Private &amp; secure</span>
              <span className={styles.featureDesc}>Your data is encrypted and always protected.</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.authSection} aria-label="Sign up">
        <div className={styles.authCard}>
          <SignUp 
            routing="hash" 
            afterSignUpUrl="/" 
            signInUrl="/auth/login"
            appearance={{
              elements: {
                cardBox: {
                  borderRadius: '28px',
                  boxShadow: '0 20px 50px rgba(233, 92, 150, 0.08)',
                  border: '1px solid #fce8f0',
                  background: '#ffffff',
                },
                headerTitle: {
                  fontSize: 0,
                  '&::after': {
                    content: '"Create an account"',
                    fontSize: '1.5rem',
                  }
                },
                headerSubtitle: {
                  fontSize: 0,
                  '&::after': {
                    content: '"Sign up to start your wellness journey"',
                    fontSize: '0.875rem',
                  }
                },
                socialButtonsBlockButton: {
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #fce8f0',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: '#fdf2f5',
                    transform: 'translateY(-1px)',
                  }
                },
                formFieldInput: {
                  borderRadius: '12px',
                  border: '1px solid #fce8f0',
                  padding: '0.75rem 1rem',
                  transition: 'all 0.2s ease',
                  '&:focus': {
                    boxShadow: '0 0 0 2px rgba(255, 111, 165, 0.2)',
                    borderColor: '#ff6fa5',
                  }
                },
                formButtonPrimary: {
                  background: 'linear-gradient(90deg, #f06595, #f78fb3)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  border: 'none',
                  transition: 'all 0.25s ease',
                  '&:hover': {
                    transform: 'translateY(-1px) scale(1.02)',
                    boxShadow: '0 6px 20px rgba(240, 101, 149, 0.35)',
                  }
                },
                dividerLine: {
                  backgroundColor: '#e5e7eb',
                },
                footerActionLink: {
                  color: '#ff6fa5',
                  transition: 'color 0.2s ease',
                  '&:hover': {
                    color: '#ff8ab8',
                  }
                }
              }
            }}
          />
        </div>
      </section>
    </main>
  )
}
