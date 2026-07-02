# Release Process

This document describes the steps for building, tagging, and releasing a new version of HerCycle AI.

---

## 1. Versioning Standard
We follow **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`.
* **MAJOR:** Contains incompatible API or architectural breaking changes.
* **MINOR:** Adds backward-compatible functionality or new features.
* **PATCH:** Contains backward-compatible bug fixes or security patches.

---

## 2. Release Steps

### Step 1: Pre-Release Checks
Before publishing a new release:
1. Verify that all GitHub Actions CI and CodeQL status checks pass on the `main` branch.
2. Run the production verification check locally:
   ```bash
   node scripts/production-check.js
   ```
3. Run a compilation build to verify zero compile regressions:
   ```bash
   npm run build
   ```

### Step 2: Version Bump
1. Open [package.json](file:///d:/Documents/Projects/HerCycle%20org/package.json) and update the `"version"` field (e.g. `"0.1.0"` to `"0.2.0"`).
2. Commit the package change:
   ```bash
   git add package.json
   git commit -m "chore(release): bump version to 0.2.0"
   ```

### Step 3: Git Tagging
Create a signed git tag for the release version:
```bash
git tag -a v0.2.0 -m "Release version 0.2.0"
git push origin v0.2.0
```

### Step 4: GitHub Release Creation
1. Navigate to the repository on GitHub.
2. Click on **Releases** -> **Draft a new release**.
3. Select the tag `v0.2.0`.
4. Generate the changelog using GitHub's auto-generation tool (or write it manually following the [CHANGELOG_GUIDE.md](file:///d:/Documents/Projects/HerCycle%20org/docs/CHANGELOG_GUIDE.md)).
5. Click **Publish release**.

---

## 3. Vercel Deployment
Our Vercel integration automatically deploys the code when changes are pushed or merged into the `main` branch. 
* Production release pushes trigger a production build.
* Always check the Vercel dashboard to verify the build completes successfully and goes live.
