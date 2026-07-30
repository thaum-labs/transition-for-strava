# Security & privacy notes (V1)

This app is designed to minimize data retention and reduce common web security risks.

## Token storage
- Strava access/refresh tokens are stored **only** in an encrypted **httpOnly** cookie (`pp_session`).
- Tokens are **never** stored in `localStorage` or exposed to client-side JavaScript.

## OAuth state
- OAuth `state` is a short-lived **signed JWT** (HMAC via `SESSION_SECRET`).
- Callback verifies the signature/expiry — **no `pp_oauth_state` cookie is required**.
- This avoids desktop/proxy cases where Set-Cookie is dropped during the Strava redirect hop.
- A legacy `pp_oauth_state` cookie is cleared on successful login if present.

## Cookies
- `pp_session` (httpOnly): encrypted session containing Strava tokens.
- `pp_csrf` (non-httpOnly): CSRF double-submit token for export requests.

Cookies use:
- `SameSite=Lax`
- `Secure` in production

## Canonical origin
- Prefer the **request host** (forwarded headers) for post-login redirects so the browser stays on the host that received the session cookie.
- `APP_BASE_URL` is still useful as documentation / absolute-link config; do not redirect across hosts after setting cookies.
- Forwarded host/proto values are validated before use.

## CSRF
- OAuth uses a signed `state` JWT verified on callback (no cookie dependency).
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

