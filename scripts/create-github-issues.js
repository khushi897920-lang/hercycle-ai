const fs = require('fs');
const https = require('https');

const OWNER = 'khushi897920-lang';
const REPO = 'hercycle-ai';

const ISSUES = [
  // ── Frontend & UI/UX (15 Issues) ──
  {
    title: 'Frontend: Add cursor-pointer styling to calendar day cells on hover',
    body: 'Hovering over interactive calendar day cells in the cycle tracker doesn\'t change the cursor style to pointer. Add `cursor: pointer` on cell hover in `app/globals.css`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Fix margin offset on dashboard hero banner spacing',
    body: 'Spacing alignment mismatch on medium screens. Ensure consistent margins and padding on the hero container wrapper in `app/globals.css`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Add cursor pointer to the logo in Footer.jsx',
    body: 'Logo in Footer is interactive but does not show a pointer cursor on hover. Add `cursor: pointer` to the image/text wrapper in `components/layout/Footer.jsx`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Adjust close button margin in OnboardingModal.jsx for mobile view',
    body: 'Close button is too close to the modal header border on mobile screen sizes (width < 480px). Add mobile responsive margins in `components/dashboard/OnboardingModal.jsx`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Add link transitions to Navigation menu items in Navbar.jsx',
    body: 'Navbar links change colors instantly on hover. Add a smooth `transition-colors` property with a 200ms or 300ms duration in `app/globals.css`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Normalize line height of symptom pills in DailyLogPanel.jsx',
    body: 'Symptom checkbox tags have off-vertical alignment on mobile views. Standardize CSS `line-height` on selectors in `app/globals.css`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Add pointer cursor on landing page features list hover',
    body: 'Features grid items change background on hover but keep the default mouse cursor. Change to `pointer` in `app/globals.css`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Add margin spacing to the list of features in Landing Page',
    body: 'The features list needs extra padding/margin at the bottom for breathing room on smaller screens in `app/globals.css`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Add average cycle length info on Insights page header',
    body: 'Display the calculated average cycle length inside the subheader text for quick reference in `app/[locale]/insights/page.js`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Adjust scroll container margins in logs history',
    body: 'Scroll container has clipping margins in track logs list. Correct scroll bar offset in `app/globals.css`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Add pointer cursor on Onboarding modal overlay click',
    body: 'Overlay clicks are interactive; make the overlay cursor a pointer when hovered in `components/dashboard/OnboardingModal.jsx`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Add horizontal scroll wrapper on logged symptoms list for mobile view',
    body: 'Avoid layout wrap breakage on mobile; implement a flex horizontal scroll layout for logged symptoms in `app/[locale]/track/page.js`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Prevent Self-Care Step Illustration Opacity Glitch on Navigation',
    body: 'Opacity transitions on steps flickers. Apply standard `will-change: opacity` and check CSS properties in `app/[locale]/self-care/page.js`.',
    labels: ['frontend', 'ECSoC26', 'good first issue', 'ui']
  },
  {
    title: 'Frontend: Ensure responsive button, page, and section alignment across all screen sizes',
    body: 'Ensure all buttons, grids, forms, and page content sections are perfectly aligned and spaced on mobile viewports. Check layout padding and borders in `app/globals.css`.',
    labels: ['frontend', 'ECSoC26', 'ui', 'feature-improvement']
  },
  {
    title: 'Frontend: Relocate Challenges and Community navigation to User Profile dropdown',
    body: 'To optimize the navbar layout and declutter mobile/desktop top bars, migrate the \'Challenges\' and \'Community\' options into the User Profile dropdown menu (alongside \'Manage Account\', \'Sign Out\', and \'Notifications\'). Modify `Navbar.jsx` rendering, ensure clean dropdown styling, and adjust desktop/mobile views.',
    labels: ['frontend', 'ECSoC26', 'ui', 'feature-improvement']
  },

  // ── Backend & API (10 Issues) ──
  {
    title: 'Backend: Secure client IP rate limiting fallback in predict-cycle POST',
    body: 'Implement client IP verification block if `getRateLimitIdentifier` falls back to \'unknown\' in `app/api/predict-cycle/route.js`.',
    labels: ['backend', 'ECSoC26', 'security']
  },
  {
    title: 'Backend: Add API timeout handlers on frontend fetch requests',
    body: 'Add an `AbortController` signal to fetch calls in `OfflineContext` to timeout slow requests (e.g., after 8 seconds) in `lib/OfflineContext.jsx`.',
    labels: ['backend', 'ECSoC26', 'feature-improvement']
  },
  {
    title: 'Backend: Implement cycle prediction variance threshold filtering',
    body: 'In `predictNextPeriod`, add logic to tag predictions as \'irregular\' if the standard deviation of lengths exceeds 5 days in `lib/api-helpers.js`.',
    labels: ['backend', 'ECSoC26', 'feature-improvement']
  },
  {
    title: 'Backend: Enhance PCOD risk scoring engine with symptom recurrence mapping',
    body: 'Add weight weightings in `calculatePCODRisk` if a user logs severe symptoms (e.g. acne, fatigue) multiple days consecutively in `lib/api-helpers.js`.',
    labels: ['backend', 'ECSoC26', 'feature-improvement']
  },
  {
    title: 'Backend: Implement chat history pruning / token optimization in /api/chat',
    body: 'Cap message history sent to Gemini API at the latest 15 messages to optimize token usage and context size in `app/api/chat/route.js`.',
    labels: ['backend', 'ECSoC26', 'feature-improvement']
  },
  {
    title: 'Backend: Implement Clerk webhook retry log auditing to prevent duplication',
    body: 'Check webhook message IDs in database to prevent processing duplicate event deliveries from Clerk in `app/api/webhooks/clerk/route.js`.',
    labels: ['backend', 'ECSoC26', 'reliability']
  },
  {
    title: 'Backend: Add custom retry and timeout configurations in Groq/Gemini API calls',
    body: 'Implement request retries with exponential backoff on API rate limit or server errors in `app/api/chat/route.js`.',
    labels: ['backend', 'ECSoC26', 'reliability']
  },
  {
    title: 'Backend: Integrate database pooled connection port in lib/supabase-admin.js',
    body: 'Update connection initialization to use pooled port settings to improve concurrent database query performance in `lib/supabase-admin.js`.',
    labels: ['backend', 'ECSoC26', 'performance']
  },
  {
    title: 'Backend: Build Clerk OAuth callback error logging logic',
    body: 'Safely intercept and log auth callback query errors without crashing the main user session flow in `app/api/auth/callback/route.js`.',
    labels: ['backend', 'ECSoC26', 'reliability']
  },
  {
    title: 'Backend: Format Date Fields in CSV Export to Prevent Excel Layout Overflow',
    body: 'Ensure the CSV export formats date columns as `YYYY-MM-DD` explicitly to prevent Excel rendering issues in `app/[locale]/insights/page.js`.',
    labels: ['backend', 'ECSoC26', 'good first issue']
  },

  // ── Accessibility & Keyboard Navigation (5 Issues) ──
  {
    title: 'Accessibility: Add screen-reader ARIA accessibility labels to Insights charts',
    body: 'Recharts SVGs lack descriptive names. Add `aria-label` properties so screen readers can describe chart content in `app/[locale]/insights/page.js`.',
    labels: ['accessibility', 'ECSoC26', 'good first issue']
  },
  {
    title: 'Accessibility: Enable keyboard navigation (arrow keys) on CycleCalendar cells',
    body: 'Keyboard focus is missing. Add tab index and support for moving selection with arrow keys in `components/dashboard/CycleCalendar.jsx`.',
    labels: ['accessibility', 'ECSoC26', 'ui']
  },
  {
    title: 'Accessibility: Add accessible close button focus outline in Dialog panels',
    body: 'Close buttons in drawers and modals should show a distinct visible focus outline for keyboard users in `app/globals.css`.',
    labels: ['accessibility', 'ECSoC26', 'good first issue']
  },
  {
    title: 'Accessibility: Fix low contrast color combinations in dark mode footer text',
    body: 'Footer copyright and link text has a contrast ratio below 4.5:1. Improve color contrast in `components/layout/Footer.jsx`.',
    labels: ['accessibility', 'ECSoC26', 'good first issue']
  },
  {
    title: 'Accessibility: Verify proper form labels (HTML for attributes) in settings form',
    body: 'Ensure all form inputs have associated `<label>` elements with matching `htmlFor` IDs for accessibility in `app/[locale]/settings/page.js`.',
    labels: ['accessibility', 'ECSoC26', 'good first issue']
  },

  // ── PWA & Offline Sync (4 Issues) ──
  {
    title: 'PWA: Create and Implement Service Worker for Complete Offline PWA Experience',
    body: 'Fully test PWA installation prompt and ensure pages and static assets cache correctly for offline start in `public/sw.js`.',
    labels: ['pwa', 'offline', 'ECSoC26', 'feature-improvement']
  },
  {
    title: 'PWA: Add offline detection indicator directly on Log Today drawer',
    body: 'Show a localized warning banner inside the drawer if the user is logging while offline in `components/dashboard/DayLogDrawer.jsx`.',
    labels: ['pwa', 'offline', 'ECSoC26', 'ui']
  },
  {
    title: 'PWA: Implement IndexedDB database migration handling schema upgrades',
    body: 'Currently, DB updates overwrite stores. Implement structured migration support in `onupgradeneeded` using versioning in `lib/db.js`.',
    labels: ['pwa', 'offline', 'ECSoC26', 'reliability']
  },
  {
    title: 'PWA: Sync indicators on specific tracking logs inside history log',
    body: 'Show a \'Pending Sync\' icon next to specific logs in the history list if they exist only in the offline queue in `app/[locale]/track/page.js`.',
    labels: ['pwa', 'offline', 'ECSoC26', 'ui']
  },

  // ── General & Quality (3 Issues) ──
  {
    title: 'General: Fix Next.js next-themes hydration mismatch warnings',
    body: 'Set `suppressHydrationWarning` on `<html>` tag to suppress standard Next.js themes mismatch warning in `app/[locale]/layout.js`.',
    labels: ['general', 'ECSoC26', 'good first issue']
  },
  {
    title: 'General: Implement automated lint checks in GitHub Actions CI workflow',
    body: 'Add a step in the CI build configuration to run `npm run lint` in `.github/workflows/ci.yml`.',
    labels: ['general', 'ECSoC26', 'ci-cd']
  },
  {
    title: 'General: Write automated tests for rate-limiting sliding window limits',
    body: 'Write unit tests for local caching limits and rate limiter window increments in `lib/cache.test.mjs`.',
    labels: ['general', 'testing', 'ECSoC26']
  }
];

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error('\x1b[31mError: GITHUB_TOKEN environment variable is not set.\x1b[0m');
  console.log('\nPlease run the script with a valid GitHub Personal Access Token (PAT):');
  console.log('  Windows PowerShell:');
  console.log('    $env:GITHUB_TOKEN="your_token_here"; node scripts/create-github-issues.js');
  console.log('  Linux/macOS Bash:');
  console.log('    GITHUB_TOKEN=your_token_here node scripts/create-github-issues.js\n');
  process.exit(1);
}

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function createIssue(issue, index) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${OWNER}/${REPO}/issues`,
    method: 'POST',
    headers: {
      'User-Agent': 'node.js',
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    }
  };

  const payload = {
    title: issue.title,
    body: issue.body,
    labels: issue.labels
  };

  try {
    const res = await makeRequest(options, payload);
    if (res.statusCode === 201) {
      console.log(`[${index + 1}/37] \x1b[32mSuccess:\x1b[0m "${issue.title}" created at ${res.data.html_url}`);
    } else {
      console.error(`[${index + 1}/37] \x1b[31mFailed:\x1b[0m "${issue.title}" - Status: ${res.statusCode}`, res.data);
    }
  } catch (err) {
    console.error(`[${index + 1}/37] \x1b[31mError:\x1b[0m "${issue.title}"`, err.message);
  }
}

async function run() {
  console.log(`Starting to create 37 issues in ${OWNER}/${REPO}...\n`);
  
  for (let i = 0; i < ISSUES.length; i++) {
    await createIssue(ISSUES[i], i);
    // Add a delay to avoid triggering GitHub's secondary rate limits
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  
  console.log('\nAll 37 issues process finished!');
}

run();
