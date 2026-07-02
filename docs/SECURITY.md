# Security Policy

This document outlines the security architecture of HerCycle AI and provides guidelines for reporting vulnerabilities.

---

## 1. Security Architecture Summary
* **Authentication:** Clerk OAuth + Session Token validation.
* **Database Isolation:** Row Level Security (RLS) enabled on all tables. Public access is disabled. Server routes query using the Service Role Key with strict `user_id` query filters.
* **Rate Limiting:** In-memory sliding window rate limits (10 req/min for Chat, 20 req/min for predictions, 30 req/min for cycle/log writes).
* **Payload Validation:** Inbound parameters validated against Zod schemas.
* **Log Sanitization:** A custom logger masks passwords, API keys, bearer tokens, and sensitive symptoms/mood data before printing output.

---

## 2. Reporting a Vulnerability
We take security issues seriously. If you find a security vulnerability, please do not open a public GitHub issue. 

Instead, report it privately to the project maintainers:
1. Email: `security@hercycle.test` (or contact the project lead on LinkedIn).
2. Include a detailed description of the vulnerability, step-by-step instructions to reproduce it, and any potential impact analysis.
3. We will acknowledge your report within 48 hours and work with you to release a fix.

---

## 3. Security Updates
* We actively patch dependencies and monitor security alerts using GitHub Dependabot.
* Security patches are backported to the current major version. Keep your production deployments updated to the latest release.
