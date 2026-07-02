# Changelog Guide

This guide explains how to document release changes in our release notes and updates.

---

## 1. Why Keep a Changelog?
A changelog helps contributors, developers, and users understand the evolution of the project. It highlights new features, bug fixes, and security patches in a human-readable format.

---

## 2. Changelog Structure
We group changes into the following standard categories:

* **🚀 Features:** For new additions, layouts, or capabilities.
* **🐛 Bug Fixes:** For resolutions to issues or crashes.
* **🔒 Security:** For vulnerability patches, RLS upgrades, or library updates.
* **⚡ Performance:** For query optimizations or build enhancements.
* **🧹 Maintenance (Chores):** For version bumps, dependency patches, or doc edits.

---

## 3. How to Write Changelog Entries

### Keep It Concise
* Write entries in the past tense (e.g. *"Added"* instead of *"Add"*).
* Reference the PR and Issue IDs where applicable.
* Highlight contributor names to acknowledge their work.

### Example Changelog Template
```markdown
## [0.2.0] - 2026-07-02

### 🚀 Features
* Added Clerk account deletion webhook endpoint (`/api/webhooks/clerk`) to clean up user data. (@khushi897920-lang)
* Added bilingual support hooks for Hindi/English translation toggle.

### 🔒 Security
* Enabled Row Level Security (RLS) on `cycles` and `daily_logs` database tables.
* Implemented lightweight in-memory rate-limiting on API routes.
* Added input payload validation using Zod.

### ⚡ Performance
* Created PostgreSQL indexes for `cycles(user_id)` and `daily_logs(user_id, date)`.
```
