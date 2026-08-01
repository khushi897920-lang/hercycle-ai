## Linked Issue
Fixes #183

## Description
Added proper error handling for malformed JSON payloads across all POST/PATCH API route handlers.

When Next.js API routes call `await request.json()`, a client sending malformed or empty JSON causes a `SyntaxError` that crashes the route handler. Without protection, this resulted in an unhandled **500 Server Error** instead of a proper **400 Bad Request** response.

**Fix:** Wrapped each `await request.json()` / `await req.json()` call in a dedicated inner try/catch that:
1. Catches `SyntaxError` (malformed JSON)
2. Logs a warning via the project's `logger` or `console.warn`
3. Returns a clean **400 Bad Request** response with `"error": "Bad Request: Invalid JSON payload"`

This prevents the parse error from reaching the outer catch block (which would return 500), ensuring correct HTTP status code semantics.

## Type of Change
- [x] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Refactoring (clean code updates, no behavior modifications)
- [ ] Documentation update
- [ ] Performance optimization
- [ ] Security patch

## Files Modified (9 files, 10 endpoints)

| File | Endpoints Protected |
|------|-------------------|
| `app/api/chat/route.js` | POST |
| `app/api/cycles/route.js` | POST, PATCH |
| `app/api/log-day/route.js` | POST |
| `app/api/weight/route.js` | POST |
| `app/api/profile/route.js` | POST |
| `app/api/partner-coach/route.js` | POST |
| `app/api/forum/comments/route.js` | POST |
| `app/api/forum/posts/route.js` | POST |
| `app/api/forum/vote/route.js` | POST |

## Testing
1. Start the dev server: `npm run dev`
2. Send a POST/PATCH request with malformed JSON body (e.g., `{invalid json}`) to any of the 10 endpoints
3. Verify the response returns status **400** with `"Bad Request: Invalid JSON payload"`
4. Verify valid JSON payloads still work correctly

## Screenshots (if UI changes are made)
N/A — Backend-only change, no UI modifications.

## Checklist
- [x] This PR is submitted under ECSOC.
- [x] Added the required **ECSoc26** label to this Pull Request.
- [x] Linked issue using `Fixes #183`.
- [x] Tested locally.
- [ ] `npm run build` completes successfully.
- [ ] GitHub Actions checks pass.
- [x] No breaking changes introduced.
- [ ] Documentation updated if required.

> ⚠️ **Important**
>
> PRs submitted for ECSOC **must include the `ECSoc26` label**.
> Pull Requests without this label **will not be processed by ECSOC Sentinel and will not receive a score.**

