# Project Structure Reference

This document maps out the directories, layout conventions, and core configuration files of the HerCycle AI repository.

---

## 1. Visual Directory Tree

```
hercycle-ai/
├── .github/                  # GitHub configurations
│   └── workflows/            # GitHub Actions workflows (CI, CodeQL)
├── app/                      # Next.js App Router (pages and API endpoints)
│   ├── api/                  # Serverless API routes
│   │   ├── chat/             # AI chatbot route
│   │   ├── cycles/           # Cycle CRUD operations
│   │   ├── log-day/          # Daily symptom log operations
│   │   ├── pcod-risk/        # PCOD risk calculation service
│   │   ├── predict-cycle/    # Prediction generator service
│   │   ├── seed/             # Mock data database seeder (Dev only)
│   │   ├── test-db/          # Supabase connection tester (Dev only)
│   │   └── webhooks/         # Webhook endpoints (Clerk event receivers)
│   ├── auth/                 # Authentication pages (Login, Signup, Callback)
│   ├── chat/                 # Frontend Chat Assistant page
│   ├── insights/             # Frontend Insights and Reports page
│   ├── track/                # Frontend Interactive Cycle Calendar page
│   ├── globals.css           # Global Tailwind and custom stylesheet
│   ├── layout.js             # Root Next.js HTML/React shell configuration
│   └── page.js               # Core Landing & User Dashboard controller
├── components/               # Reusable frontend UI components
│   ├── dashboard/            # Cards and panels used in main dash
│   └── layout/               # Common layout components (Navbar, Footer)
├── docs/                     # Technical, database, and contributor docs
├── lib/                      # Helper utilities and client context APIs
├── public/                   # Static images, favicon, and SEO assets
├── screenshots/              # Application preview captures for docs
├── scripts/                  # CI/CD and production verification utilities
├── .env.example              # Env configuration template
├── jsconfig.json             # JavaScript path aliasing configuration
├── next.config.js            # Next.js framework configuration
├── postcss.config.js         # CSS compiler config
├── tailwind.config.js        # UI utility classes configurations
└── package.json              # Project dependencies and script runner
```

---

## 2. Directory Descriptions

### `app/`
Contains Next.js App Router pages and serverless API endpoints. Folder structures directly map to route URLs (e.g. `app/track/page.js` is rendered at `/track` and `app/api/cycles/route.js` handles API requests at `/api/cycles`).

### `components/`
React components that make up the visual interface of the platform. Separated into layout wrappers and functional dashboard components like `CycleCalendar` and `DailyLogPanel`.

### `docs/`
Houses all documentation including database schema designs, branch protections, security rules, and contributor guidelines.

### `lib/`
Holds shared utilities and initializers:
* `env.js`: Startup environment check.
* `logger.js`: Centralized log manager.
* `rate-limiter.js`: In-memory rate limiting.
* `supabase-admin.js`: Supabase server-side client using the service role key.
* `clerk-server.js`: Server-side Clerk auth utilities.
* `api-helpers.js`: Prediction and scoring algorithms.

### `scripts/`
Developer and CI testing utilities. Includes `production-check.js` which verifies route protection, webhook signature, and rate-limiting responses locally.
