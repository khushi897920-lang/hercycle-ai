<div align="center">

# 🌸 HerCycle AI

### *Know your body. Love yourself.*

**AI-powered menstrual health companion built for modern Indian women**

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-hercycle--ai.vercel.app-e8527e?style=for-the-badge&logoColor=white)](https://hercycle-ai.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js%2016-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini%202.0-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-pink?style=for-the-badge)](LICENSE)

</div>

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Playfair+Display&size=22&duration=3000&pause=1000&color=C2185B&center=true&vCenter=true&multiline=true&repeat=true&width=600&height=120&lines=AI-Powered+Menstrual+Health+Companion+%F0%9F%8C%B8;Know+your+body.+Love+yourself.+%F0%9F%92%95;Built+for+every+woman+in+India+%F0%9F%87%AE%F0%9F%87%B3" alt="Typing SVG" />

</div>

---

> 💬 *"1 in 5 Indian women has PCOD. Most are undiagnosed.*
> *We built HerCycle AI to change that."*

---

<div align="center">

<table>
<tr>
<td align="center"><b>🌍 355M+</b><br/><sub>Women in India</sub></td>
<td align="center"><b>🤖 Gemini 2.0</b><br/><sub>AI Powered</sub></td>
<td align="center"><b>🌐 EN + हिंदी</b><br/><sub>Bilingual</sub></td>
<td align="center"><b>🩺 PCOD AI</b><br/><sub>Risk Screening</sub></td>
<td align="center"><b>⚡ Live</b><br/><sub>Deployed on Vercel</sub></td>
</tr>
</table>

</div>

---

## 📸 Screenshots

### 🏠 Dashboard — *"Know your body, love yourself"*
![Dashboard](screenshots/dashboard.png)

<table>
<tr>
<td width="50%">

### 🗓️ Cycle Tracker
![Cycle Tracker](screenshots/track.png)

</td>
<td width="50%">

### 📊 Insights & Analytics
![Insights](screenshots/insights.png)

</td>
</tr>
<tr>
<td colspan="2">

### 🤖 AI Health Assistant
![AI Chat](screenshots/chat.png)

</td>
</tr>
</table>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗓️ **Smart Cycle Calendar** | Visual month-view calendar with color-coded period days, ovulation windows, and predicted future cycles |
| 🤖 **AI Health Assistant** | Powered by **Google Gemini 2.0 Flash** with automatic **Groq LLaMA 3.1** fallback — always online |
| 📝 **Daily Symptom Logging** | Log symptoms, mood, and flow intensity with smart upsert — edit any day, any time |
| 🔮 **Cycle Prediction** | Statistical prediction engine with confidence score based on personal cycle history |
| 🩺 **PCOD Risk Assessment** | Automated risk scoring (LOW / MEDIUM / HIGH) based on cycle regularity and symptom patterns |
| 📄 **Doctor Report PDF Export** | Generate a professional PDF health report to share with your doctor |
| 🌐 **Bilingual Support** | Full Hindi (हिंदी) and English language toggle throughout the app |
| 🔐 **Secure Auth** | Email/password + Google OAuth via Supabase Auth with middleware route protection |
| 🌙 **Beautiful UI** | Glassmorphism design with pink-purple gradient, smooth animations, and mobile-responsive layout |

---

## 🔄 How It Works

```mermaid
flowchart LR
    A["🔐 Sign Up / Login"] --> B["🗓️ Log Your Period"]
    B --> C["📝 Track Symptoms Daily"]
    C --> D["🤖 AI Analyzes Patterns"]
    D --> E["🩺 PCOD Risk Score"]
    D --> F["🔮 Cycle Predictions"]
    E --> G["📄 PDF Doctor Report"]
    F --> G
```

> **Step 1** — Sign up with email or Google · **Step 2** — Log your period start/end dates  
> **Step 3** — Track daily symptoms & mood · **Step 4** — AI analyzes your patterns  
> **Step 5** — Get PCOD risk score & cycle predictions · **Step 6** — Export a PDF report for your doctor

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), React 18 |
| **Styling** | Vanilla CSS, Glassmorphism, Radix UI |
| **Charts** | Recharts (Line, Bar, custom tooltips) |
| **Backend** | Next.js API Routes (serverless) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Clerk (@clerk/nextjs) |
| **AI (Primary)** | Google Gemini 2.0 Flash |
| **AI (Fallback)** | Groq LLaMA 3.1 8B Instant |
| **PDF Export** | jsPDF + jsPDF-AutoTable |
| **Deployment** | Vercel (Edge Network) |
| **Language** | JavaScript (ES2022) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js `>= 18.x`
- A [Supabase](https://supabase.com/) account (free database hosting)
- A [Clerk](https://clerk.com/) account (free user authentication)
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)
- A [Groq](https://console.groq.com/) API key (free, optional fallback)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/khushi897920-lang/hercycle-ai.git
cd hercycle-ai

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Open `.env.local` and fill in your keys:

```env
# Supabase Database (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Clerk Auth (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key_here
CLERK_SECRET_KEY=sk_test_your_clerk_secret_here
CLERK_WEBHOOK_SECRET=whsec_your_clerk_webhook_secret_here

# AI APIs (at least one required)
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## 🗄️ Database Setup

This project uses [Supabase](https://supabase.com/) as its database. Create a free project and run the following SQL in the **SQL Editor**:

### Create Tables

```sql
-- Cycles table
CREATE TABLE cycles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE,
  cycle_length  INTEGER DEFAULT 28,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Daily logs table
CREATE TABLE daily_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  date       DATE NOT NULL,
  symptoms   TEXT[],
  mood       TEXT,
  flow       TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT daily_logs_user_date_unique UNIQUE (user_id, date)
);
```

### Row Level Security (RLS)

```sql
-- Enable RLS and allow users to manage their own data
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own cycles"
  ON cycles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own daily logs"
  ON daily_logs FOR ALL USING (auth.uid() = user_id);
```

---

## ☁️ Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/khushi897920-lang/hercycle-ai)

1. Click the button above or import your forked repo at [vercel.com](https://vercel.com)
2. Add **all environment variables** from `.env.example` in the Vercel dashboard
3. Deploy — Vercel auto-detects Next.js and configures everything

### Configure Clerk Redirects

In your **Clerk Dashboard → Paths / Redirects**:

* Set **Sign-in Path** to `/auth/login`
* Set **Sign-up Path** to `/auth/signup`
* Set **After Sign-in Redirect URL** to `/`
* Set **After Sign-up Redirect URL** to `/`

### Configure Clerk Webhook (Account Deletion Cascade)

1. Go to **Clerk Dashboard → Webhooks** and click **Add Endpoint**.
2. Set Endpoint URL to `https://your-domain.vercel.app/api/webhooks/clerk`.
3. Subscribe to the `user.deleted` event.
4. Copy the Signing Secret and configure it in your Vercel/production environment as `CLERK_WEBHOOK_SECRET`. This triggers a cascading purge of user cycles and logs when their account is deleted.

---

## 🗺️ Roadmap

```
Phase 1  ✅  Core dashboard with AI chat and cycle calendar
Phase 2  ✅  User authentication (email + Google OAuth)
Phase 3  ✅  Multi-page routing (Track, Insights, Chat)
Phase 4  🔲  Full Hindi localization across all pages
Phase 5  🔲  Mobile app (React Native / Expo)
Phase 6  🔲  Doctor Connect — share reports directly with verified doctors
Phase 7  🔲  Wearable integration (smart ring / watch sync)
Phase 8  🔲  Community forum for anonymous peer support
```

---

## 📊 Project Progress

| Feature | Progress |
|---------|----------|
| Core Dashboard | ![100%](https://progress-bar.xyz/100/?title=Complete&color=C2185B&width=200) |
| AI Chat (EN+HI) | ![100%](https://progress-bar.xyz/100/?title=Complete&color=C2185B&width=200) |
| PCOD Risk Engine | ![100%](https://progress-bar.xyz/100/?title=Complete&color=C2185B&width=200) |
| User Authentication | ![100%](https://progress-bar.xyz/100/?title=Complete&color=C2185B&width=200) |
| Cycle Prediction | ![100%](https://progress-bar.xyz/100/?title=Complete&color=C2185B&width=200) |
| PDF Doctor Report | ![100%](https://progress-bar.xyz/100/?title=Complete&color=C2185B&width=200) |
| Hindi Localization | ![60%](https://progress-bar.xyz/60/?title=In+Progress&color=7B1FA2&width=200) |
| Mobile App | ![10%](https://progress-bar.xyz/10/?title=Planned&color=9E9E9E&width=200) |
| Doctor Connect | ![5%](https://progress-bar.xyz/5/?title=Planned&color=9E9E9E&width=200) |

---

## 👩‍💻 Contributors

Thank you to all the amazing people who built HerCycle AI!

### Sole Builder & Project Lead

| Avatar | Name | Role | GitHub | LinkedIn |
|--------|------|------|--------|----------|
| <img src="https://github.com/khushi897920-lang.png" width="60" style="border-radius:50%"> | **Khushi Singh** | Sole Builder / Project Lead<br/><sub>(Full Stack Developer, AI Integration, Database, UI/UX — everything)</sub> | [@khushi897920-lang](https://github.com/khushi897920-lang) | [LinkedIn](https://www.linkedin.com/in/khushii-singh01) |

### 💖 Acknowledgements / Special Thanks

#### Early Contributors
*Note: Contributed during initial prototype phase*

- **zaaraf027-glitch** —  Database ([@zaaraf027-glitch](https://github.com/zaaraf027-glitch))
- **Samiksha48787** —  Presentation ([@Samiksha48787](https://github.com/Samiksha48787))

---

[![Contributors](https://contrib.rocks/image?repo=khushi897920-lang/hercycle-ai)](#-contributors)

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
## 🏆 ECSOC Contributors

This project is officially participating in **ECSOC 2026**.

To ensure your contribution is evaluated by the ECSOC Sentinel system, please follow these requirements carefully.

### Before You Start
- Fork the repository.
- Comment on an issue and wait for it to be assigned.
- Work on only one assigned issue at a time.
- Create a separate branch for your changes.

### Pull Request Requirements

Every Pull Request **must**:

- Reference the issue using:
  ```text
  Fixes #<issue_number>
  ```

- Include the **ECSoc26** label.

> ⚠️ **Important**
>
> Pull Requests **without the `ECSoc26` label will NOT be processed by ECSOC Sentinel and will not be scored.**

- Pass all GitHub Actions checks.
- Build successfully (`npm run build`).
- Follow the project's coding standards.
- Update documentation when applicable.

Thank you for contributing and best of luck in ECSOC! 🚀

For comprehensive instructions on setting up, code styles, and opening pull requests, please read our **[Contribution Guide](docs/CONTRIBUTING.md)**.

Please make sure your code:
* Has no `console.log` debug statements (use `logger` from `@/lib/logger`).
* Uses `start_date` / `end_date` for cycle columns (not `period_start` / `period_end`).
* Uses the server-side `getSupabaseAdmin()` client helper for database updates.
* Passes the integration checks: `node scripts/production-check.js`.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 📈 Repository Activity

![GitHub Activity](https://github-readme-activity-graph.vercel.app/graph?username=khushi897920-lang&theme=react-dark&bg_color=0D1117&color=C2185B&line=C2185B&point=ffffff&area=true&hide_border=true)


<div align="center">

![GitHub Stats](https://github-readme-stats.vercel.app/api?username=khushi897920-lang&show_icons=true&theme=radical&bg_color=0D1117&title_color=C2185B&icon_color=C2185B&text_color=ffffff&border_color=C2185B&cache_seconds=1800)

</div>

<div align="center">

---

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=150&section=footer&text=HerCycle%20AI&fontSize=42&fontColor=ffffff&animation=twinkling&fontAlignY=65" width="100%"/>

### 🌸 Thank you for visiting HerCycle AI

*Every woman deserves to understand her own body.*
*I built this so she can.*

[![Live Demo](https://img.shields.io/badge/🚀%20Try%20Live%20Demo-C2185B?style=for-the-badge&logoColor=white)](https://hercycle-ai.vercel.app)
[![GitHub Stars](https://img.shields.io/github/stars/khushi897920-lang/hercycle-ai?style=for-the-badge&color=C2185B&logo=github)](https://github.com/khushi897920-lang/hercycle-ai)
[![Contributors](https://img.shields.io/github/contributors/khushi897920-lang/hercycle-ai?style=for-the-badge&color=7B1FA2&cacheSeconds=1800)](#-contributors)

<br/>

*Made with* 💕 *in India 🇮🇳*

*© 2026 Khushi Singh · MIT License*

</div>
