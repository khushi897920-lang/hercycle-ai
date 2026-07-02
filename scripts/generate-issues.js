const fs = require('fs');
const path = require('path');

const issues = [
  // Good First Issues (1-15)
  {
    num: 1,
    title: "Fix typo in docs/SETUP.md API guide",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "documentation"],
    desc: "There is a small typo in docs/SETUP.md where 'walk you through' should be 'walks you through'. Let's correct this typo to maintain documentation quality.",
    obj: "Update the typo in docs/SETUP.md.",
    files: ["docs/SETUP.md"],
    criteria: [
      "Typo is corrected to 'walks you through'",
      "No other text is altered",
      "GitHub Actions checks pass"
    ]
  },
  {
    num: 2,
    title: "Add cursor-pointer styling to calendar day cells on hover",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "ui", "ux"],
    desc: "Hovering over interactive calendar day cells in the cycle tracker doesn't change the cursor style. It should change to 'pointer' to clearly show they are clickable.",
    obj: "Add 'cursor: pointer' to the CSS class selector for calendar day cells.",
    files: ["app/globals.css"],
    criteria: [
      "Hovering over a calendar day changes the cursor to pointer",
      "No layout or calendar functionality is altered",
      "Build succeeds"
    ]
  },
  {
    num: 3,
    title: "Add standard SEO meta description tag in layout.js",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "documentation"],
    desc: "Our root layout lacks a standard SEO description meta tag. Adding one improves indexing on search engines.",
    obj: "Add description tag to metadata in app/layout.js.",
    files: ["app/layout.js"],
    criteria: [
      "Metadata exports a descriptive description property",
      "No compilation warnings are introduced",
      "Build succeeds"
    ]
  },
  {
    num: 4,
    title: "Fix margin offset on dashboard hero banner spacing",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "ui"],
    desc: "The hero banner spacing has a slight alignment mismatch on medium screens. Let's fix this CSS spacing to look perfectly aligned.",
    obj: "Adjust CSS margin/padding on the hero container wrapper.",
    files: ["app/globals.css"],
    criteria: [
      "Hero container wrapper has consistent margins/paddings",
      "Responsive layout is verified",
      "Build succeeds"
    ]
  },
  {
    num: 5,
    title: "Correct spelling mistake in predictNextPeriod helper comments",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "documentation"],
    desc: "There is a spelling mistake in lib/api-helpers.js cycle helper: 'chronologically' is typed as 'cronologically'. Let's correct it.",
    obj: "Correct the comment spelling in lib/api-helpers.js.",
    files: ["lib/api-helpers.js"],
    criteria: [
      "Comment typo is corrected to 'chronologically'",
      "Function logic remains unchanged",
      "Build succeeds"
    ]
  },
  {
    num: 6,
    title: "Add cursor pointer to the logo in Footer.jsx",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "ui", "ux"],
    desc: "The main logo in Footer.jsx is interactive but does not show a pointer cursor on hover.",
    obj: "Add cursor: pointer class styling to the logo image/text in Footer.jsx.",
    files: ["components/layout/Footer.jsx"],
    criteria: [
      "Hovering over the footer logo changes cursor to pointer",
      "Build succeeds"
    ]
  },
  {
    num: 7,
    title: "Adjust close button margin in OnboardingModal.jsx for mobile view",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "ui"],
    desc: "On mobile screen sizes (width < 480px), the onboarding modal close button is too close to the modal header border.",
    obj: "Add CSS margin or padding class to adjust positioning on small viewports.",
    files: ["components/dashboard/OnboardingModal.jsx"],
    criteria: [
      "Close button has appropriate spacing on mobile viewports",
      "No functional changes in modal submit/dismiss logic",
      "Build succeeds"
    ]
  },
  {
    num: 8,
    title: "Document signup URL for Google AI Studio key in SETUP.md",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "documentation"],
    desc: "To help contributors obtain keys faster, let's include the direct URL to sign up for Google AI Studio API keys in SETUP.md.",
    obj: "Add API Key Studio link under the Google AI Studio setup guide.",
    files: ["docs/SETUP.md"],
    criteria: [
      "URL link is added correctly in docs/SETUP.md",
      "Formatting is checked and correct"
    ]
  },
  {
    num: 9,
    title: "Add link transitions to Navigation menu items in Navbar.jsx",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "ui", "ux"],
    desc: "The Navbar links change colors instantly on hover. Adding a subtle fade transition makes the navigation feel more premium.",
    obj: "Add a transition-color CSS property to the Navbar items.",
    files: ["app/globals.css"],
    criteria: [
      "Transition delay/duration is 200ms or 300ms",
      "Navbar continues to operate correctly"
    ]
  },
  {
    num: 10,
    title: "Correct spelling of 'confidence' in prediction card UI text",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "ui", "documentation"],
    desc: "The word 'confidence' is misspelled in the prediction tooltip description on the dashboard. Let's fix it.",
    obj: "Find and fix the misspelling in components/dashboard/PredictionCard.jsx.",
    files: ["components/dashboard/PredictionCard.jsx"],
    criteria: [
      "UI displays 'confidence' correctly",
      "Build succeeds"
    ]
  },
  {
    num: 11,
    title: "Standardize naming keys in i18n English dictionary",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "documentation"],
    desc: "Some English dictionary keys in lib/i18n.js use lowercase and others use camelCase. Let's standardize them.",
    obj: "Update translation keys in lib/i18n.js.",
    files: ["lib/i18n.js"],
    criteria: [
      "Keys use camelCase format consistently",
      "Bilingual toggles remain functional"
    ]
  },
  {
    num: 12,
    title: "Normalize line height of symptom pills in DailyLogPanel.jsx",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "ui"],
    desc: "The symptom checkbox tags have slightly off vertical alignment on mobile views.",
    obj: "Standardize CSS line-height on selector tags.",
    files: ["app/globals.css"],
    criteria: [
      "Pills look centered on both desktop and mobile viewports",
      "Build succeeds"
    ]
  },
  {
    num: 13,
    title: "Add pointer cursor on landing page features list hover",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "ui"],
    desc: "The features grid items change background slightly on hover, but the mouse cursor remains default.",
    obj: "Add cursor: pointer to dashboard features container items.",
    files: ["app/globals.css"],
    criteria: [
      "Hovering changes cursor style to pointer",
      "Build succeeds"
    ]
  },
  {
    num: 14,
    title: "Standardize comment styling at the top of API handlers",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "documentation"],
    desc: "Some API routes use JSDoc block comments, while others use single-line comments. Let's format the top of every route using standard JSDoc comments.",
    obj: "Add JSDoc block description comments to all endpoints.",
    files: ["app/api/cycles/route.js", "app/api/log-day/route.js"],
    criteria: [
      "API handlers have clear JSDoc comments describing URL, method, and authentication",
      "Build succeeds"
    ]
  },
  {
    num: 15,
    title: "Add margin spacing to the list of features in Landing Page",
    difficulty: "good first issue",
    labels: ["ECSOC", "good first issue", "beginner", "ui"],
    desc: "The features list items on the homepage are close to the bottom of the section container.",
    obj: "Add padding/margin properties to features block.",
    files: ["app/globals.css"],
    criteria: [
      "Visual grid features have 24px/32px spacing at the bottom",
      "Build succeeds"
    ]
  },

  // Beginner Issues (16-25)
  {
    num: 16,
    title: "Implement chat input validation to prevent empty submit",
    difficulty: "beginner",
    labels: ["ECSOC", "beginner", "ui", "ux"],
    desc: "In ChatAssistant, clicking the send button or pressing enter with an empty text box still submits the request, causing unnecessary calls.",
    obj: "Add a check on input text value. Disable the send button if the input is empty or contains only whitespace.",
    files: ["components/dashboard/ChatAssistant.jsx"],
    criteria: [
      "Send button is disabled when input is empty",
      "Enter key press with empty text does not trigger API requests",
      "Build succeeds"
    ]
  },
  {
    num: 17,
    title: "Add Hindi translation for 'Select All Symptoms' checkbox",
    difficulty: "beginner",
    labels: ["ECSOC", "beginner", "ui", "ux", "documentation"],
    desc: "The 'Select All Symptoms' helper checkbox label in the logs configuration pane does not translate when Hindi is selected.",
    obj: "Add translation key in lib/i18n.js and fetch it dynamically.",
    files: ["lib/i18n.js", "components/dashboard/DailyLogPanel.jsx"],
    criteria: [
      "Label changes to Hindi translation when 'हि' is active",
      "Build succeeds"
    ]
  },
  {
    num: 18,
    title: "Limit message input field length in ChatAssistant.jsx",
    difficulty: "beginner",
    labels: ["ECSOC", "beginner", "ui", "security"],
    desc: "There is no restriction on maximum characters in the chat assistant input box. A user could paste very large payloads, causing rendering slowness or API issues.",
    obj: "Add `maxLength={1000}` attribute on the textarea/input element.",
    files: ["components/dashboard/ChatAssistant.jsx"],
    criteria: [
      "Input is capped at 1000 characters",
      "Build succeeds"
    ]
  },
  {
    num: 19,
    title: "Add average cycle length info on Insights page header",
    difficulty: "beginner",
    labels: ["ECSOC", "beginner", "ui", "ux"],
    desc: "The Insights page displays charts and export buttons, but does not display the user's computed average cycle length at the top.",
    obj: "Render the computed average cycle length in the header of the Insights view.",
    files: ["app/insights/page.js"],
    criteria: [
      "Average cycle length (e.g. 28 days) is displayed",
      "Build succeeds"
    ]
  },
  {
    num: 20,
    title: "Adjust scroll container margins in logs history",
    difficulty: "beginner",
    labels: ["ECSOC", "beginner", "ui"],
    desc: "The scroll wrapper listing daily logs overlaps slightly with the border on smaller laptop screens.",
    obj: "Increase margins at the bottom of the log list container.",
    files: ["app/globals.css"],
    criteria: [
      "Scrolling elements have proper bottom padding",
      "Build succeeds"
    ]
  },
  {
    num: 21,
    title: "Add pointer cursor on Onboarding modal overlay click",
    difficulty: "beginner",
    labels: ["ECSOC", "beginner", "ui", "ux"],
    desc: "Clicking outside the OnboardingModal dismisses it, but the background overlay does not hint at clickability.",
    obj: "Add cursor: pointer class to the modal overlay container class.",
    files: ["components/dashboard/OnboardingModal.jsx"],
    criteria: [
      "Overlay hover shows pointer cursor",
      "Modal dismiss logic continues to work"
    ]
  },
  {
    num: 22,
    title: "Gracefully handle null state in PredictionCard.jsx when no cycle history exists",
    difficulty: "beginner",
    labels: ["ECSOC", "beginner", "ui", "ux"],
    desc: "If a new user signs in and has not logged any cycle entries, the prediction card displays null or blank values.",
    obj: "Check if cycle list is empty, and display a supportive placeholder string (e.g. 'Log your first cycle to see predictions').",
    files: ["components/dashboard/PredictionCard.jsx"],
    criteria: [
      "No null/blank values are rendered",
      "Supportive instruction is shown when cycle history is empty",
      "Build succeeds"
    ]
  },
  {
    num: 23,
    title: "Display application version number in footer matching package.json",
    difficulty: "beginner",
    labels: ["ECSOC", "beginner", "ui", "documentation"],
    desc: "To improve release tracking, the footer should dynamically print the application version from package.json.",
    obj: "Import version from package.json and render in Footer component.",
    files: ["components/layout/Footer.jsx"],
    criteria: [
      "Version is imported and rendered correctly",
      "Build succeeds"
    ]
  },
  {
    num: 24,
    title: "Add horizontal scroll wrapper on logged symptoms list for mobile view",
    difficulty: "beginner",
    labels: ["ECSOC", "beginner", "ui", "ux"],
    desc: "When a user logs multiple symptoms, the lists overflow the grid card vertically on small screen devices.",
    obj: "Wrap symptom pills in a container with overflow-x: auto scroll on mobile.",
    files: ["app/globals.css"],
    criteria: [
      "Mobile view shows horizontal scrolling symptoms when overflowing",
      "Desktop view styling remains intact",
      "Build succeeds"
    ]
  },
  {
    num: 25,
    title: "Translate calendar month headers to Hindi if language is 'हि'",
    difficulty: "beginner",
    labels: ["ECSOC", "beginner", "ui", "ux", "documentation"],
    desc: "The month headers on the cycle tracker calendar always display in English even when the Hindi translation is active.",
    obj: "Add month name translations to i18n dictionary and render names dynamically.",
    files: ["lib/i18n.js", "components/dashboard/CycleCalendar.jsx"],
    criteria: [
      "Calendar month names are correctly localized in Hindi",
      "Build succeeds"
    ]
  },

  // Intermediate Issues (26-40)
  {
    num: 26,
    title: "Expose cycle history CSV export button on Insights page",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux", "api"],
    desc: "Users want to export their cycle records in CSV format. Let's add a button to export this data directly.",
    obj: "Add a button on Insights page to download cycle records (start_date, end_date, cycle_length) as a CSV file.",
    files: ["app/insights/page.js"],
    criteria: [
      "CSV file downloads successfully on click",
      "Data formatting is clean and readable",
      "Build succeeds"
    ]
  },
  {
    num: 27,
    title: "Add dropdown month and year selectors to CycleCalendar",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux"],
    desc: "Navigating years or months in the cycle calendar currently requires clicking arrows repeatedly. Adding selectors speeds up calendar navigation.",
    obj: "Add Month and Year selector dropdowns to change the active calendar date window.",
    files: ["components/dashboard/CycleCalendar.jsx"],
    criteria: [
      "Selectors successfully update calendar date window",
      "Build succeeds"
    ]
  },
  {
    num: 28,
    title: "Integrate line chart illustrating cycle lengths over time in Insights",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux", "performance"],
    desc: "The Insights page needs to visually show cycle length trends over the last 12 entries to help users detect variations.",
    obj: "Use Recharts to render a line chart showing cycle length (y-axis) vs cycle start date (x-axis).",
    files: ["app/insights/page.js"],
    criteria: [
      "Line chart renders correctly with cycle length data",
      "Tooltips show exact values on hover",
      "Build succeeds"
    ]
  },
  {
    num: 29,
    title: "Render symptom frequency bar chart in Insights page",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux"],
    desc: "Users want to see which symptoms occur most frequently. Let's render a bar chart aggregating symptom logs.",
    obj: "Retrieve daily logs, count occurrences of each symptom tag, and render a horizontal bar chart.",
    files: ["app/insights/page.js"],
    criteria: [
      "Bar chart displays symptom counts correctly",
      "Sorted from most frequent to least frequent",
      "Build succeeds"
    ]
  },
  {
    num: 30,
    title: "Render flow intensity distribution pie chart in Insights page",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux"],
    desc: "To help users analyze flow variations, the Insights page should show the distribution of flow intensity.",
    obj: "Aggregate flow logs ('f1', 'f2', 'f3') and display a pie chart showing the percentage breakdown.",
    files: ["app/insights/page.js"],
    criteria: [
      "Pie chart renders correctly with data breakdown",
      "Legend displays flow category names (Light, Medium, Heavy)",
      "Build succeeds"
    ]
  },
  {
    num: 31,
    title: "Add prediction support for multiple year gaps on calendar",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ux", "testing"],
    desc: "If a user has not logged data for more than a year, the prediction algorithm should handle this transition gracefully without throwing date parsing errors.",
    obj: "Add validation checks in predictNextPeriod helper to handle gap intervals of 365+ days safely.",
    files: ["lib/api-helpers.js"],
    criteria: [
      "Large cycle gaps do not cause calculation errors",
      "Return reasonable default predictions when gaps are excessive",
      "Build succeeds"
    ]
  },
  {
    num: 32,
    title: "Add screen-reader ARIA accessibility labels to Insights charts",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ux", "ui"],
    desc: "Our interactive Recharts graphs lack ARIA labels, making them inaccessible to screen readers.",
    obj: "Add descriptive aria-labels and descriptions to chart container elements.",
    files: ["app/insights/page.js"],
    criteria: [
      "ARIA roles and labels are present",
      "Screen readers correctly announce chart purposes",
      "Build succeeds"
    ]
  },
  {
    num: 33,
    title: "Enable keyboard navigation (arrow keys) on CycleCalendar cells",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux"],
    desc: "Interactive calendar day cells can only be selected via mouse clicks. Enable keyboard arrow key navigation for better accessibility.",
    obj: "Add onKeyDown handler on cells to update focus and date selections.",
    files: ["components/dashboard/CycleCalendar.jsx"],
    criteria: [
      "Arrow keys navigate focus across calendar grid",
      "Enter key selects active focused cell",
      "Build succeeds"
    ]
  },
  {
    num: 34,
    title: "Allow adding custom symptom tags during daily symptom logs",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux", "database"],
    desc: "Currently, users can only choose from predefined symptom tags. Let's allow users to type and log custom symptom tags.",
    obj: "Add an 'Add Custom' text input in DailyLogPanel to add user-defined symptom strings to the selection array.",
    files: ["components/dashboard/DailyLogPanel.jsx"],
    criteria: [
      "Custom symptom tags are appended to selection list",
      "Successfully saved in database table daily_logs",
      "Build succeeds"
    ]
  },
  {
    num: 35,
    title: "Integrate custom styling on toast alert notifications",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux"],
    desc: "Standard hot-toast notifications look generic and do not match the pink glassmorphism branding of the application.",
    obj: "Customize `Toaster` styles (background, borders, text colors) to match our pink glassmorphism style.",
    files: ["app/layout.js"],
    criteria: [
      "Toast notifications display with pink gradient borders/background",
      "Build succeeds"
    ]
  },
  {
    num: 36,
    title: "Secure client IP rate limiting fallback in predict-cycle POST endpoint",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "api", "security"],
    desc: "If the Clerk authentication userId fails to resolve or is missing in test mock runs, the rate-limiter should fallback to limiting by client IP address.",
    obj: "Fetch client IP from request headers and pass it as rate-limiter key fallback if userId is empty.",
    files: ["app/api/predict-cycle/route.js"],
    criteria: [
      "Client IP used as fallback for rate limiting",
      "Build succeeds"
    ]
  },
  {
    num: 37,
    title: "Add API timeout handlers on frontend fetch requests",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux", "performance"],
    desc: "If network latency is high or Supabase fails to respond quickly, client-side API requests hang indefinitely without reporting errors.",
    obj: "Implement an AbortController timeout mechanism on all frontend `fetch()` wrappers.",
    files: ["components/dashboard/DailyLogPanel.jsx", "components/dashboard/CycleCalendar.jsx"],
    criteria: [
      "Requests abort if they exceed 8 seconds",
      "Friendly error message tells the user the request timed out",
      "Build succeeds"
    ]
  },
  {
    num: 38,
    title: "Fix Next.js next-themes hydration mismatch warnings",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux"],
    desc: "The theme provider is causing hydration mismatch warning logs in the developer console on reload.",
    obj: "Wrap theme rendering or add `suppressHydrationWarning` on the HTML tag.",
    files: ["app/layout.js"],
    criteria: [
      "No hydration warning logs in browser console",
      "Theme is applied correctly",
      "Build succeeds"
    ]
  },
  {
    num: 39,
    title: "Add skeleton loader in Insights route during data fetch",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux"],
    desc: "When navigating to Insights page, empty charts display briefly before data loads, causing a visual flash.",
    obj: "Add visual skeleton placeholders for charts during loading state.",
    files: ["app/insights/page.js"],
    criteria: [
      "Skeleton states render during data fetching",
      "Smooth fade-in transition when charts load",
      "Build succeeds"
    ]
  },
  {
    num: 40,
    title: "Add local search filter text-box to the symptoms list panel",
    difficulty: "intermediate",
    labels: ["ECSOC", "intermediate", "ui", "ux"],
    desc: "The symptoms checklist contains many tags. Users should be able to type in a search box to quickly filter tags.",
    obj: "Add search input at the top of DailyLogPanel to filter list array items.",
    files: ["components/dashboard/DailyLogPanel.jsx"],
    criteria: [
      "Typing in search input filters symptoms checklist dynamically",
      "Checkbox status is maintained during filter",
      "Build succeeds"
    ]
  },

  // Advanced Issues (41-50)
  {
    num: 41,
    title: "Implement cycle prediction variance threshold filtering in predictNextPeriod",
    difficulty: "advanced",
    labels: ["ECSOC", "advanced", "performance", "ux"],
    desc: "When predicting future cycles, highly irregular history entries skew predictions. We need to implement an outlier filtration system.",
    obj: "Calculate standard deviation of cycle lengths; filter out cycle entries that deviate by more than 2.5 standard deviations from the median before calculating average lengths.",
    files: ["lib/api-helpers.js"],
    criteria: [
      "Outliers are successfully ignored during prediction calculations",
      "Normal cycle calculations remain accurate",
      "Build succeeds"
    ]
  },
  {
    num: 42,
    title: "Enhance PCOD risk scoring engine with symptom recurrence mapping",
    difficulty: "advanced",
    labels: ["ECSOC", "advanced", "performance", "api"],
    desc: "PCOD risk assessment currently checks only symptom count. The assessment should analyze symptom recurrence (frequency) over multiple months.",
    obj: "Update calculatePCODRisk to calculate symptom frequency trends over a 90-day window, adjusting the risk score based on recurrence patterns.",
    files: ["lib/api-helpers.js"],
    criteria: [
      "PCOD engine accurately scores symptom recurrence",
      "Risk tiers calculate correctly",
      "Build succeeds"
    ]
  },
  {
    num: 43,
    title: "Implement chat history pruning / token optimization in /api/chat",
    difficulty: "advanced",
    labels: ["ECSOC", "advanced", "ai", "security", "performance"],
    desc: "To prevent Gemini/Groq context windows from blowing up and optimize API costs, we must prune older messages from the context window.",
    obj: "Implement a sliding window token estimator that keeps only recent message payloads up to a safe character limit before calling AI models.",
    files: ["app/api/chat/route.js"],
    criteria: [
      "Total prompt payloads remain below configured token limits",
      "Chatbot continues to reply contextually",
      "Build succeeds"
    ]
  },
  {
    num: 44,
    title: "Implement Clerk webhook retry log auditing to prevent duplication",
    difficulty: "advanced",
    labels: ["ECSOC", "advanced", "api", "security"],
    desc: "Clerk webhooks can retry requests in case of network timeouts, which could cause duplicate database delete operations.",
    obj: "Log and audit webhook event IDs to prevent duplicate processing of identical `user.deleted` events.",
    files: ["app/api/webhooks/clerk/route.js"],
    criteria: [
      "System logs duplicate webhooks and ignores them",
      "Database operations are safe and idempotent",
      "Build succeeds"
    ]
  },
  {
    num: 45,
    title: "Add custom retry and timeout configurations in Groq/Gemini API calls",
    difficulty: "advanced",
    labels: ["ECSOC", "advanced", "ai", "performance"],
    desc: "If Gemini API key fails or times out, the chat endpoint should retry the request once before falling back to the Groq model.",
    obj: "Implement a retry block (up to 1 retry) for the Gemini call before triggering the Groq fallback.",
    files: ["app/api/chat/route.js"],
    criteria: [
      "Transient API issues are handled by retries",
      "Fallback logic triggers if retries fail",
      "Build succeeds"
    ]
  },
  {
    num: 46,
    title: "Integrate database pooled connection port in lib/supabase-admin.js",
    difficulty: "advanced",
    labels: ["ECSOC", "advanced", "database", "performance"],
    desc: "To prevent connection exhaustion in serverless deployments, database operations should support a pooled connection URL format.",
    obj: "Modify getSupabaseAdmin to use the connection pooler port (PgBouncer/Supavisor) configuration from environment variables if available.",
    files: ["lib/supabase-admin.js"],
    criteria: [
      "Service client connects via pooled port",
      "App builds successfully"
    ]
  },
  {
    num: 47,
    title: "Build Clerk OAuth callback error logging logic",
    difficulty: "advanced",
    labels: ["ECSOC", "advanced", "api", "security"],
    desc: "If social login (Google OAuth) fails or is cancelled by the user, the callback route should log a sanitized error description.",
    obj: "Catch errors on `/auth/callback` route and log them using the centralized logger.",
    files: ["app/auth/callback/route.js"],
    criteria: [
      "OAuth callback errors are securely logged without leaking personal details",
      "Build succeeds"
    ]
  },
  {
    num: 48,
    title: "Write automated tests for rate-limiting sliding window limits",
    difficulty: "advanced",
    labels: ["ECSOC", "advanced", "testing", "performance"],
    desc: "We need unit/integration tests to verify that the rate-limiter correctly blocks requests once limit thresholds are breached.",
    obj: "Add rate-limiting simulation tests in the local test script.",
    files: ["scripts/production-check.js"],
    criteria: [
      "Test script accurately verifies 429 rate-limiting responses",
      "No regressions are introduced"
    ]
  },
  {
    num: 49,
    title: "Optimize Turbopack tree-shaking configs in next.config.js",
    difficulty: "advanced",
    labels: ["ECSOC", "advanced", "performance"],
    desc: "Heavy libraries like jsPDF and Recharts should be fully tree-shaken to reduce build size and improve client loading times.",
    obj: "Configure experimental Turbopack optimization packages in next.config.js.",
    files: ["next.config.js"],
    criteria: [
      "Compilation build completes successfully",
      "Production build size is verified"
    ]
  },
  {
    num: 50,
    title: "Implement automated lint checks in GitHub Actions CI workflow",
    difficulty: "advanced",
    labels: ["ECSOC", "advanced", "testing"],
    desc: "Let's automate code quality checks. We need to configure ESLint and add it to our GitHub Actions CI pipeline.",
    obj: "Install and configure ESLint, define a lint script in package.json, and update .github/workflows/ci.yml.",
    files: ["package.json", ".github/workflows/ci.yml"],
    criteria: [
      "ESLint runs successfully on build check",
      "Lint failures block merging in pull requests"
    ]
  }
];

const guidelineText = `
---

# 🚀 ECSOC Contribution Guidelines

This issue is officially available for **ECSOC** contributors.

### Before starting:

- Comment on this issue requesting assignment.
- Wait until a maintainer assigns the issue.
- Do not start working before assignment.
- Work on only one issue at a time.
- Mention **Fixes #<issue_number>** in your Pull Request.
- Ensure all GitHub Actions checks pass.
- Ensure the project builds successfully.
- Follow the project's coding standards.
- Update documentation if necessary.

Failure to follow these guidelines may result in the Pull Request being closed.

Happy Coding! ❤️
`;

let mdContent = `# ECSOC Issues Backlog

This document lists 50 repository-specific issues ready for **ECSOC** contributors. Maintainers can copy and paste these directly into the GitHub Issue Tracker.

---

`;

for (const issue of issues) {
  mdContent += `## Issue #${issue.num}: ${issue.title}
* **Difficulty:** ${issue.difficulty}
* **Labels:** ${issue.labels.map(l => `\`${l}\``).join(', ')}

### 📌 Description
${issue.desc}

### 🎯 Objective
${issue.obj}

### ✅ Acceptance Criteria
${issue.criteria.map(c => `- [ ] ${c}`).join('\n')}
- [ ] No existing functionality is broken
- [ ] GitHub Actions pass

### 📂 Expected Files
${issue.files.map(f => `* [${path.basename(f)}](file:///${f.replace(/\\/g, '/')})`).join('\n')}

${guidelineText.replace('<issue_number>', issue.num)}

---

`;
}

const outputPath = path.resolve(__dirname, '../docs/ECSOC_ISSUES.md');
fs.writeFileSync(outputPath, mdContent);
console.log(`Successfully generated 50 issues in: docs/ECSOC_ISSUES.md`);
