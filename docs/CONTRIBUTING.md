# Contributing Guidelines

Welcome to HerCycle AI! We are thrilled that you are interested in contributing. As an open-source project, we rely on contributors like you to keep HerCycle AI secure, performant, and helpful for women across India.

This document guides you through the process of contributing, from raising issues to submitting pull requests.

---

## 1. Code of Conduct
By participating in this project, you agree to abide by our standards of respectful, inclusive, and professional behavior. Always be supportive, kind, and collaborative in discussions, issues, and reviews.

---

## 2. How to Request Assignment
We use GitHub issues to track features and bugs.
* **Find an Issue:** Browse our open issues and find one that interests you.
* **Ask for Assignment:** Comment on the issue asking to be assigned (e.g., *"I would like to work on this issue. Please assign it to me."*).
* **Do Not Start Work Without Assignment:** To avoid multiple contributors working on the same task, please wait until a maintainer assigns the issue to you and labels it `in-progress`.

---

## 3. The Contribution Workflow

### Step 1: Fork and Clone
1. Fork the repository to your own GitHub account by clicking the **Fork** button in the top-right corner.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/hercycle-ai.git
   cd hercycle-ai
   ```

### Step 2: Create a Branch
Create a branch for your feature or bug fix:
```bash
git checkout -b feature/your-feature-name
# Or for bug fixes:
git checkout -b fix/your-fix-name
```
*(For detailed branch naming conventions, see [CODE_STYLE.md](file:///d:/Documents/Projects/HerCycle%20org/docs/CODE_STYLE.md)).*

### Step 3: Install and Run Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure your environment variables by copying `.env.example` to `.env.local` and filling in the values.
3. Start the Next.js dev server:
   ```bash
   npm run dev
   ```
*(For detailed setup steps, see [SETUP.md](file:///d:/Documents/Projects/HerCycle%20org/docs/SETUP.md)).*

### Step 4: Make Changes and Validate
* Write your code, keeping it clean, documented, and aligned with our standards.
* Run the production check test suite to verify no security or validation checks are broken:
  ```bash
  node scripts/production-check.js
  ```
* Verify that the production build completes successfully:
  ```bash
  npm run build
  ```

### Step 5: Commit Changes
Commit your changes using semantic commit messages:
```bash
git add .
git commit -m "feat: add cycle length trend charts on Insights page"
```
*(For detailed commit conventions, see [CODE_STYLE.md](file:///d:/Documents/Projects/HerCycle%20org/docs/CODE_STYLE.md)).*

### Step 6: Update Branch and Resolve Conflicts
Before opening a PR, ensure your branch is up-to-date with the official `main` branch to avoid merge conflicts:
```bash
git fetch origin
git rebase origin/main
```
If there are merge conflicts, resolve them locally in your editor, stage the resolved files, and complete the rebase:
```bash
git add <conflict-file>
git rebase --continue
```

### Step 7: Push and Open a Pull Request
1. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Go to the original HerCycle AI repository on GitHub. You will see a prompt to open a **Pull Request**.
3. Fill out the PR template completely:
   * Describe the changes.
   * Reference the issue ID it closes (e.g., `Closes #12`).
   * Include screenshots or videos if the PR modifies the UI.

---

## 4. How GitHub Actions & CI Checks Work
Once you open a PR, GitHub Actions automatically executes our Continuous Integration (CI) and Security pipeline:
1. **CI Check (`ci.yml`):** Automatically boots up a Node.js runner, installs dependencies, and runs `npm run build` to verify the code compiles without errors.
2. **CodeQL Check (`codeql.yml`):** Automatically scans your code for potential security vulnerabilities and alerts maintainers if risks are found.

If any check fails (indicated by a red `X` in your PR status list), click **Details**, view the build/security log, fix the issue locally, and push the fix. The pipeline will automatically rerun.

---

## 5. Review & Merging Process
* At least **one review approval** from a maintainer is required.
* All status checks (CI and CodeQL) **must pass** (turn green).
* Once these conditions are met, the maintainer will merge your branch into the `main` branch. Thank you for your contribution!
