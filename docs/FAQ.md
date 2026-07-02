# Frequently Asked Questions (FAQ)

This document addresses frequently asked questions regarding the architecture, data security, local setups, and calculation logics of HerCycle AI.

---

## 1. How does the cycle prediction model work?
* **Mechanism:** Calculated in [lib/api-helpers.js](file:///d:/Documents/Projects/HerCycle%20org/lib/api-helpers.js) using chronological historical cycle entries (at least 2 entries required).
* **Deduplication:** Filters out entries within a 20-day window to prevent duplicate logging errors.
* **Calculation:** Blends the average gap duration between cycles (40% weight) with any explicit user-entered cycle length values (60% weight). It then projects forward from the start date of the most recent logged cycle.
* **Regularity & Confidence:** The standard deviation of the cycle gaps is calculated; smaller deviations yield higher prediction confidence scores (up to 95%).

---

## 2. How is my personal health data secured?
* **Authentication isolation:** Clerk manages user credentials and authentication sessions securely. The database only stores a random alphanumeric user identifier string (`user_...`) instead of usernames, emails, or passwords.
* **Database Isolation:** Row Level Security (RLS) is enabled on all tables in Supabase. Direct public database reads or writes using the anonymous key are completely blocked.
* **Trusted Intermediary:** The database can only be queried through the Next.js API routes, which use the service role key after verifying the Clerk session token. Every query is filtered strictly by the user's authenticated ID.

---

## 3. How is the bilingual support implemented?
* **Framework:** Localized translations are stored in [lib/i18n.js](file:///d:/Documents/Projects/HerCycle%20org/lib/i18n.js).
* **Context Provider:** A React Context provider (`LanguageProvider` in [LanguageContext.jsx](file:///d:/Documents/Projects/HerCycle%20org/lib/LanguageContext.jsx)) manages the state of the active language ('en' for English, 'हि' for Hindi).
* **Translation Hooks:** Frontend components import text strings matching the active language key. AI Chat prompts dynamically adjust the system instructions to respond in Hindi when 'हि' is active.

---

## 4. Why is the project name "nextjs-mongo-template" in `package.json`?
* **Context:** The repository was originally initialized from a standard Next.js template. We retained this configuration inside [package.json](file:///d:/Documents/Projects/HerCycle%20org/package.json) to maintain compatibility and package resolution logs. You can safely ignore or rename this field.
