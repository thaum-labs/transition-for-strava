# Domain Migration Guide: transitionforstrava.com

This guide covers updating the app to use your custom domain `transitionforstrava.com`.

## ✅ Code Changes (Already Done)

The app code is already configured to work with any domain. The OAuth callback route automatically detects the correct domain from request headers, so no code changes are needed.

## 🔧 Required Configuration Updates

### 1. DigitalOcean App Platform

1. Go to your DigitalOcean App Platform dashboard
2. Select your app
3. Navigate to **Settings** → **Domains**
4. Add your custom domain: `transitionforstrava.com`
5. Follow DigitalOcean's instructions to configure DNS records (usually CNAME or A records)
6. Wait for SSL certificate to be provisioned (automatic)

### 2. Update Environment Variables in DigitalOcean

1. In DigitalOcean App Platform, go to **Settings** → **App-Level Environment Variables**
2. Update `STRAVA_REDIRECT_URI` to:
   ```
   https://transitionforstrava.com/api/auth/strava/callback
   ```
3. Save changes (this will trigger a new deployment)

### 3. Update Strava App Settings

1. Go to: https://www.strava.com/settings/api
2. Click **Edit** on your API application
3. Update **Authorization Callback Domain** to: `transitionforstrava.com`
4. Update **Website** (if applicable) to: `https://transitionforstrava.com`
5. Save changes

### 4. Test the Migration

1. Visit `https://transitionforstrava.com`
2. Click "Continue with Strava"
3. Complete OAuth flow
4. Verify you're redirected back to the app successfully

## 📝 Notes

- The old DigitalOcean subdomain (`transition-app-vslqi.ondigitalocean.app`) will continue to work until you remove it
- You can keep both domains active during migration for testing
- Make sure DNS propagation is complete before testing (can take up to 48 hours, usually much faster)

## 🐛 Troubleshooting

**"invalid redirect_uri" error?**
- Double-check `STRAVA_REDIRECT_URI` in DigitalOcean matches exactly: `https://transitionforstrava.com/api/auth/strava/callback`
- Verify the Authorization Callback Domain in Strava settings matches: `transitionforstrava.com`
- Ensure there are no trailing slashes or extra characters

**SSL certificate not working?**
- Wait a few minutes for Let's Encrypt to provision the certificate
- Check DNS records are correctly configured
- Verify the domain is properly added in DigitalOcean

**Still redirecting to old domain?**
- Clear your browser cache and cookies
- Try an incognito/private window
- Check that the environment variable update triggered a new deployment
