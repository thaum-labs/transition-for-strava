<div align="center">
  <img src="public/logo.png" alt="Transition for Strava logo" width="140" />
  
  # Transition for Strava
  
  **Export your Strava activities as GPX or FIT files**
  
  [Live Site](https://transitionforstrava.com) · [How to use](#how-to-use-it) · [Report Issue](https://github.com/thaum-labs/transition-for-strava/issues)
</div>

---

## Overview

Transition for Strava is a **mobile-first web app** that helps you export your Strava activities as GPX or FIT files, so you can move data between apps or keep a local backup. It also lets you review starred segments and recent efforts (Strava Summit required for segment efforts).

Works on **phone and desktop** browsers.

## Quick start

1. Visit [transitionforstrava.com](https://transitionforstrava.com)
2. Tap **Continue with Strava** to sign in
3. Browse your activities (with elevation profiles) or open **Segments** for starred segments and efforts
4. Tap **Export** and choose **GPX** or **FIT**
5. On mobile: share directly to other apps  
   On desktop: download the file

## Features

- Secure Strava sign-in (official OAuth)
- Mobile-first layout that also works on desktop
- GPX export for broad app compatibility
- FIT export generated for devices and training apps
- Auto-detected sport type (cycling, running, e-bike, and more)
- Metrics such as elevation, speed, heart rate, cadence, and power when available
- Elevation profiles on activity cards
- Starred segments with recent/fastest efforts (Summit)
- Privacy-focused: no database, no stored activity files

## How to use it

### Export formats

- **GPX**: Built from Strava GPS streams. Works with most mapping and training apps.
- **FIT**: Generated from your Strava data (not a re-upload of the original device file). Includes sport type, timing, elevation, heart rate, and related fields when present.

### Mobile vs desktop

| | Mobile | Desktop |
|---|---|---|
| Sign-in | Same Strava OAuth flow | Same Strava OAuth flow |
| Export | Share sheet when supported | File download |
| Notes | iOS may require opening the file from Downloads/Files before sharing | Use Chrome/Firefox/Safari/Edge |

## Security & privacy

- **No password storage** — sign-in goes through Strava OAuth only.
- **Signed OAuth `state`** — login CSRF protection uses a short-lived signed token in the OAuth URL (no reliance on a fragile cross-site state cookie).
- **Encrypted session cookie** — Strava access/refresh tokens live only in an httpOnly `pp_session` cookie (not `localStorage`).
- **No activity file storage** — GPX/FIT files are generated on demand and discarded after the response.
- **No database in V1** — nothing is retained server-side beyond the session cookie on your device.

See [SECURITY.md](./SECURITY.md) for cookie and CSRF details.

## Notes & limitations

- **Segments** need a **Strava Summit** subscription for effort history.
- Indoor, manual, or privacy-restricted activities may have no GPS track and cannot be exported.
- FIT files are **generated** from Strava streams, not the original device upload.
- Mobile download/share behavior varies by browser and OS.

## Local development

Requirements: Node.js 20.x

```bash
cp .env.example .env.local
# Fill in SESSION_SECRET, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET,
# STRAVA_REDIRECT_URI, and APP_BASE_URL
npm install
npm run dev
```

Generate a session secret:

```bash
npm run generate-secret
```

Useful scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | Local Next.js server |
| `npm run build` / `npm start` | Production build & start |
| `npm test` | OAuth state unit/integration tests |
| `npm run lint` | ESLint |

Configure the same callback URL in your [Strava API application](https://www.strava.com/settings/api) as `STRAVA_REDIRECT_URI` (for local use: `http://localhost:3000/api/auth/strava/callback`).

## Support

If something breaks, [open an issue](https://github.com/thaum-labs/transition-for-strava/issues) with:

- Device and browser
- What you clicked / tried
- The exact error message (if any)

## Disclaimer

This project is not affiliated with Strava. Strava is a trademark of Strava, Inc.

## License

[MIT](./LICENSE) © Thaum Labs
