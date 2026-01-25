# Quick Setup Checklist

## ✅ What's Already Done
- ✅ Project scaffolded and ready
- ✅ `.env.local` created with `SESSION_SECRET` set
- ✅ Dev server starting (check terminal output)

## 🔧 What You Need to Do (2 minutes)

### 1. Configure Strava Developer App
Go to: **https://www.strava.com/settings/api**

For your app, set:
- **Authorization Callback Domain**: `localhost`
- **Redirect URI**: `http://localhost:3000/api/auth/strava/callback`

### 2. Add Your Strava Credentials
Edit `.env.local` and replace:
- `STRAVA_CLIENT_ID=replace_me` → your Client ID from Strava
- `STRAVA_CLIENT_SECRET=replace_me` → your Client Secret from Strava

### 3. Test It
1. Open: **http://localhost:3000**
2. Click "Continue with Strava"
3. Approve the OAuth request
4. You should land on `/activities` with your activity list!

## 🐛 Troubleshooting

**"invalid redirect_uri" error?**
- Double-check the Redirect URI in Strava settings matches exactly: `http://localhost:3000/api/auth/strava/callback`

**"invalid client" error?**
- Verify `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` in `.env.local` are correct

**Dev server not running?**
- Check the terminal output for errors
- Make sure Node.js is installed: `node -v` should show v18+ or v20+
