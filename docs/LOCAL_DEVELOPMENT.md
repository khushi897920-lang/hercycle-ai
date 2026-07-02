# Local Development Guide

This guide describes how to run, test, and debug the HerCycle AI application locally.

---

## 1. Running the Development Server
1. Clone the repository and configure your `.env.local` file as shown in [SETUP.md](file:///d:/Documents/Projects/HerCycle%20org/docs/SETUP.md).
2. Start the local server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your web browser. Next.js supports Hot Module Replacement (HMR), so any code changes you save will instantly update in the browser.

---

## 2. Seeding Your Local Database
We provide a development seeder route to populate cycles and symptom logs for testing:
1. Ensure your local server is running.
2. Sign in to your application.
3. Open your browser and navigate to: `http://localhost:3000/api/seed`
4. The endpoint will clear legacy mock records and insert **6 cycle rows** and **146 daily logs** representing six months of mock cycle trends.
*Note:* The `/api/seed` endpoint is disabled in production to protect data integrity.

---

## 3. Running Production & Security Checks
To verify that your local changes do not break authentication rules, rate limits, or webhook verification:
1. Run the production verification test runner:
   ```bash
   node scripts/production-check.js
   ```
2. The runner will spawn Next.js on port 3001, execute security and integration checks, and write a summary report to [docs/database/PRODUCTION_TESTS_REPORT.md](file:///d:/Documents/Projects/HerCycle%20org/docs/database/PRODUCTION_TESTS_REPORT.md).

---

## 4. Verification Before Staging
Before committing changes to Git, please run a production compilation build:
```bash
npm run build
```
This ensures your changes do not introduce bundler, Next.js page generation, or compilation warnings.
