<div align="center">
  <img src="public/logo.png" alt="Transition for Strava logo" width="140" />
  
  # Transition for Strava
  
  **Export your Strava activities as GPX or FIT files**
  
  [🌐 Live Site](https://transitionforstrava.com) • [📖 Documentation](#how-to-use-it) • [🐛 Report Issue](https://github.com/thaum-labs/transition-for-strava/issues)
</div>

---

## ✨ Overview

Transition for Strava is a **mobile-first web app** that helps you export your Strava activities as GPX or FIT files, making it easy to move your data between apps or back up your activities.

## 🚀 Quick Start

1. Visit [transitionforstrava.com](https://transitionforstrava.com)
2. Tap **Continue with Strava** to authenticate
3. Browse your activities (with elevation profiles!)
4. Tap **Export** and choose **GPX** or **FIT**
5. On mobile: share directly to other apps
6. On desktop: download the file

## 🎯 Features

- 🔐 **Strava OAuth** - Secure authentication
- 📱 **Mobile-first** - Optimized for phones and tablets
- 🗺️ **GPX Export** - Universal compatibility
- 🏃 **FIT Export** - Generated with Garmin FIT SDK for maximum compatibility
- 🏷️ **Auto-detect Sport Type** - Automatically detects cycling, running, etc.
- 📊 **Rich Metrics** - Includes elevation, speed, heart rate, cadence, and power
- 🎨 **Elevation Profiles** - Visual elevation charts on activity cards
- 🔒 **Privacy-focused** - No data storage, encrypted sessions only

## 📋 How It Works

### Export Formats

- **GPX**: Generated from Strava GPS stream data. Universal format, works with most apps.
- **FIT**: Generated using the Garmin FIT SDK from Strava streams. Includes proper sport type, metadata, and summary statistics (avg speed, max speed, elevation gain, heart rate).

### Mobile vs Desktop

- **Mobile**: Uses Web Share API for direct sharing to other apps
- **Desktop**: Standard file download

## 🧪 Local development & testing

You can run the app locally to test changes (including Segments) before deploying:

1. **Clone and install**
   - Clone the repo and run `npm install` in the project root.

2. **Environment**
   - Copy `.env.example` to `.env.local`.
   - Set `APP_BASE_URL=http://localhost:3000` and `STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/strava/callback`.
   - Add your Strava app credentials (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`) and a `SESSION_SECRET` (e.g. `openssl rand -base64 32`).
   - In the [Strava API app settings](https://www.strava.com/settings/api), add `http://localhost:3000/api/auth/strava/callback` as an Authorization Callback Domain.

3. **Run**
   - `npm run dev` then open [http://localhost:3000](http://localhost:3000).
   - Log in with Strava, go to **Activities** → **Segments** (or `/segments`).

4. **Testing Segments (free vs Summit)**
   - **Free account:** You may see “Segment efforts require a Strava Summit subscription.” If the API allows one effort for free, you’ll see a single effort per segment.
   - **Summit account:** You should see up to 5 efforts per starred segment. If you have both account types, test with each to confirm behavior before pushing to production.

## ⚠️ Notes & Limitations

- **Segment efforts (Segments page)** – Listing your best efforts per segment uses Strava’s segment efforts API. That access may require a **Strava Summit** subscription; free accounts may get limited or no data (402 Payment Required). The app shows a clear message when Summit is required.
- **Not all activities can be exported** - Indoor/manual activities or privacy-restricted activities may not include GPS tracks
- **Mobile downloads vary by browser**:
  - iOS: Often requires opening from Safari downloads/Files before sharing
  - Android: Behavior varies by browser and download settings
- **FIT files are synthesized** - They're generated from Strava streams, not the original device upload

## 🔒 Privacy

- ✅ **No credential storage** - We don't store your Strava credentials
- ✅ **No file storage** - Activity files are generated on-demand and never stored
- ✅ **Encrypted sessions** - Login tokens stored in secure httpOnly cookies
- ✅ **OAuth-based** - Uses Strava's official OAuth flow

## 🛠️ Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Garmin FIT SDK** (@garmin/fitsdk)
- **Strava API**

## 📝 Support

If something doesn't work, please [open an issue](https://github.com/thaum-labs/transition-for-strava/issues) with:
- Device/browser you're using
- What you clicked/tried to do
- The error message (if any)

## ⚖️ Disclaimer

This project is not affiliated with Strava.
