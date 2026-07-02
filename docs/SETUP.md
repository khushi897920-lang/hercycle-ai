# Setup Guide

This document walk you through setting up account providers, configuring databases, and preparing your local environment for HerCycle AI.

---

## 1. Prerequisites
* Node.js version `18.x` or `>= 20.x`
* npm (bundled with Node.js)
* Git

---

## 2. External Provider Setup

### A. Clerk (Authentication)
1. Go to [clerk.com](https://clerk.com/) and create a free account.
2. Create a new application named **HerCycle AI**.
3. Choose **Email** and **Google** (OAuth) as sign-in options.
4. Copy the API keys from your Clerk dashboard:
   * `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   * `CLERK_SECRET_KEY`
5. Go to **Webhooks** -> **Add Endpoint**:
   * URL: `https://your-domain.com/api/webhooks/clerk` (during local development, you can use ngrok to expose your port 3000/3001).
   * Subscribe to event: `user.deleted`
   * Copy the webhook signing secret: `CLERK_WEBHOOK_SECRET`

### B. Supabase (Database)
1. Go to [supabase.com](https://supabase.com/) and create a free project.
2. In your Supabase Dashboard, navigate to **Settings** -> **API** and copy:
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `SUPABASE_SERVICE_ROLE_KEY`
3. Navigate to the **SQL Editor** in Supabase and run the SQL schema script provided in [DATABASE_EXPORT.sql](file:///d:/Documents/Projects/HerCycle%20org/docs/database/DATABASE_EXPORT.sql) to create the tables, enable RLS, and add indexes.

### C. Google AI Studio (Gemini)
1. Go to [Google AI Studio](https://aistudio.google.com/) and create a free API key.
2. Copy the key as `GEMINI_API_KEY`.

### D. Groq Console (Fallback LLaMA, Optional)
1. Go to [Groq Console](https://console.groq.com/) and generate an API key.
2. Copy the key as `GROQ_API_KEY`.

---

## 3. Environment File Configuration
1. In the root directory of the project, duplicate the example file:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and paste in all your keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   CLERK_WEBHOOK_SECRET=whsec_...
   GEMINI_API_KEY=AIzaSy...
   GROQ_API_KEY=gsk_...
   ```
