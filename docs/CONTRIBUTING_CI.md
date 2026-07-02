# Contributor CI/CD Guide

Welcome to the HerCycle AI repository! This guide helps you understand our automated checks and integration pipeline.

---

## 1. What Happens When You Open a Pull Request?
As soon as you open a Pull Request (PR) or push new changes to an existing PR, GitHub automatically runs a set of checks to verify that your changes are safe, stable, and ready to be merged.

These checks run in the cloud and report their status directly at the bottom of your PR conversation tab.

---

## 2. Which Checks Run?

### A. CI (Continuous Integration)
This check runs the standard build verify job:
1. Clones your code.
2. Configures Node.js (version 20).
3. Installs project dependencies (`npm ci`).
4. Runs `npm run build` to verify the Next.js production compilation completes with zero errors.

### B. CodeQL Analysis
This check runs GitHub's static security scanner:
* Analyzes your JavaScript files for common coding vulnerabilities, security risks, and code quality issues.

---

## 3. Why Did a Check Fail?
If you see a red `X` next to a check, it means something went wrong. Common reasons for failures are:
* **Syntax/Build Errors:** A typo, missing import, or Javascript syntax error caused `npm run build` to fail.
* **Missing Dependencies:** You imported a new package in your code but forgot to save it in `package.json`.
* **Security Flags:** CodeQL detected a potential vulnerability (such as SQL injection risks or hardcoded secrets).

---

## 4. How Can I Fix a Failure?
1. Click the **Details** button next to the failed check in your PR to open the log console.
2. Read the error message at the bottom of the console logs to see what failed (e.g. Next.js compile errors or missing environment variable logs).
3. Fix the issue in your local editor.
4. Stage, commit, and push your changes to your branch. GitHub will automatically detect the push and trigger a fresh run of the checks.

---

## 5. How Do I Rerun Failed Checks?
If you believe a check failed due to a transient error (like a network timeout on package installations) and not a bug in your code, you can trigger a rerun:
1. Navigate to the **Actions** tab at the top of the repository page.
2. Click on the failed workflow run (e.g. `CI` or `CodeQL`).
3. Click the **Re-run jobs** button in the top-right corner.
4. Select **Re-run failed jobs** or **Re-run all jobs**.
