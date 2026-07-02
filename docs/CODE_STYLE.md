# Code Style Guide

This document outlines the coding standards, patterns, and conventions expected of all contributors to HerCycle AI.

---

## 1. Naming Conventions

### A. Folder Naming
* All folder names under `app/`, `components/`, and `lib/` must use **kebab-case** (lowercase words separated by hyphens).
* **Examples:** `components/dashboard`, `components/layout`, `app/api/log-day`.

### B. Component Naming
* React components (.js or .jsx) must use **PascalCase** (capitalized first letters of each word).
* File names must exactly match the default export component name.
* **Examples:** `PredictionCard.jsx`, `CycleCalendar.jsx`.

### C. Helper & Utility Files
* Helper modules and plain JavaScript utility files must use **kebab-case** or **camelCase**.
* **Examples:** `lib/supabase-admin.js`, `lib/api-helpers.js`.

---

## 2. Branch & Commit Message Conventions

### A. Branch Naming
Keep branch names descriptive and group them by task types using a slash prefix:
* **Features:** `feature/add-pcod-charts`
* **Bug Fixes:** `fix/prediction-offset`
* **Refactoring:** `refactor/logger-integration`
* **Documentation:** `docs/ci-guide`

### B. Commit Messages
We follow **Semantic Commit Message Guidelines** (Conventional Commits) to maintain a readable git history:
```
<type>(<scope>): <short description>
```
* **Types:**
  * `feat`: A new feature (e.g. `feat(api): add clerk webhook deleted handler`)
  * `fix`: A bug fix (e.g. `fix(chat): add auth checking on chat route`)
  * `docs`: Documentation updates (e.g. `docs(readme): add environment description`)
  * `style`: Styling changes, spacing, missing semicolons (no logic modifications)
  * `refactor`: Code changes that neither fix a bug nor add a feature
  * `perf`: Performance improvements
  * `chore`: Maintenance tasks, dependencies updates
* **Format Guidelines:**
  * Keep the subject line under 72 characters.
  * Use the imperative, present tense (e.g., "add", not "added" or "adds").
  * Do not capitalize the first letter of the description.
  * Do not end the description with a period.

---

## 3. API Conventions
* **Response Shapes:** Every API endpoint must return JSON payloads matching the project's standard structure:
  * On success: `NextResponse.json({ success: true, ... })`
  * On failure: `NextResponse.json({ success: false, error: 'Reason/Message' }, { status: HTTP_STATUS_CODE })`
* **Authentication:** Verify user session using `getAuthUserId()` immediately at the entry point of any endpoint. Return `401 Unauthorized` if no session exists.
* **Validation:** Define schemas using Zod for all write methods (`POST`, `PATCH`, `PUT`) and return `400 Bad Request` if input parameters fail validation.
* **Error Handling:** Wrap all API route logic inside `try/catch` blocks and use the centralized logger to record database or runtime exceptions.

---

## 4. Code Quality & Security Expectations
* **No `console.log`:** Remove all temporary debugging console print statements before staging. Use the centralized `logger` (from `@/lib/logger`) for necessary output.
* **SQL Injection Prevention:** Never write raw SQL concatenation in database calls. Always use Supabase parameterized clients (`supabaseAdmin.from(...)`).
* **Environment Separation:** Sensitive variables (like service role keys) must only be accessed inside serverless routes or helper functions, never in the frontend markup.
