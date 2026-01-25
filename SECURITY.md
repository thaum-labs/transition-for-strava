# Security & privacy notes (V1)

This app is designed to minimize data retention and reduce common web security risks.

## Token storage
- Strava access/refresh tokens are stored **only** in an encrypted **httpOnly** cookie (`pp_session`).
- Tokens are **never** stored in `localStorage` or exposed to client-side JavaScript.

## Cookies
- `pp_session` (httpOnly): encrypted session containing Strava tokens.
- `pp_oauth_state` (httpOnly): short-lived OAuth state cookie used to validate the callback.
- `pp_csrf` (non-httpOnly): CSRF double-submit token for export requests.

Cookies use:
- `SameSite=Lax`
- `Secure` in production

## CSRF
- OAuth uses `state` and validates it against the `pp_oauth_state` cookie.
- Export endpoint uses **double-submit CSRF**:
  - Client sends `x-csrf-token`
  - Server compares it to `pp_csrf`

## Data retention
- No database is used in V1.
- Exported files are generated on demand and **not stored** server-side.

## Abuse protection
- Lightweight in-memory rate limiting is applied to:
  - `/api/activities`
  - `/api/export`

This is best-effort (works well for single-instance deployments; not a full distributed rate limiter).

## Logging
- Do not log:
  - access tokens, refresh tokens, authorization codes, client secret
  - athlete ids, activity names, or raw activity payloads
- Safe logging signals:
  - request id, endpoint, status code
  - Strava rate-limit headers (`X-RateLimit-*`)

