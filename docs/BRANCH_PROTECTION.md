# Branch Protection Configuration Guide

This guide explains how repository administrators can enable branch protection rules in GitHub to secure the `main` branch.

---

## How to Configure Branch Protection Rules

1. Navigate to the main page of your repository on GitHub.
2. Click on the **Settings** tab (the gear icon) at the top of the repository interface.
3. In the left-hand sidebar, under the **Code and automation** section, click on **Branches**.
4. Next to **Branch protection rules**, click the **Add rule** button (or click **Edit** if a rule for `main` already exists).
5. In the **Branch name pattern** field, enter: `main`

---

## Required Protection Settings

Enable the following checkboxes to protect the branch:

### 1. Require a pull request before merging
* Check the box: **Require a pull request before merging**.
* Check the box: **Require approvals**.
* Set **Required number of approvals before merging** to: `1`
* *(Optional)* Check **Dismiss stale pull request approvals when new commits are pushed** to ensure fresh reviews for modifications.

### 2. Require status checks to pass before merging
* Check the box: **Require status checks to pass before merging**.
* Check the box: **Require branches to be up to date before merging** (this forces contributors to merge/rebase with the latest `main` branch before merging their PR).

---

## Workflows/Status Checks to Select

Under the **Search for status checks** search bar, type and select the following status check jobs from our GitHub workflows:

1. **`Build & Verify`**
   * *Origin:* From the `CI` workflow. This ensures that `npm run build` completes successfully before merging.
2. **`Analyze`**
   * *Origin:* From the `CodeQL` workflow. This ensures that CodeQL static security analysis runs and reports no security vulnerabilities.

---

## 3. Save Changes
Scroll to the bottom of the page and click the **Create** (or **Save changes**) button. You may be prompted to enter your GitHub password to confirm.
