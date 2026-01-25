# Domain Migration Guide: transitionforstrava.com

This guide covers updating the app to use your custom domain `transitionforstrava.com`.

## ✅ Code Changes (Already Done)

The app code is already configured to work with any domain. The OAuth callback route automatically detects the correct domain from request headers, so no code changes are needed.

## 🔧 Required Configuration Updates

### 1. Add Domain to DigitalOcean DNS

1. Log in to your DigitalOcean dashboard
2. Go to **Networking** → **Domains** (in the left sidebar)
3. Click **Add Domain**
4. Enter your domain: `transitionforstrava.com`
5. Click **Add Domain**
6. DigitalOcean will display your nameservers (e.g., `ns1.digitalocean.com`, `ns2.digitalocean.com`, `ns3.digitalocean.com`)
7. **Copy these nameservers** - you'll need them for the next step

### 2. Update Nameservers in Namecheap

1. Log in to your Namecheap account
2. Go to **Domain List** → Click **Manage** next to `transitionforstrava.com`
3. Navigate to the **Nameservers** section
4. Select **Custom DNS** (instead of "Namecheap BasicDNS")
5. Enter the DigitalOcean nameservers you copied:
   - `ns1.digitalocean.com`
   - `ns2.digitalocean.com`
   - `ns3.digitalocean.com`
6. Click the checkmark to save
7. **Note:** Nameserver changes can take 24-48 hours to propagate globally (though often much faster)

### 3. Add Domain to App Platform

1. Go to your DigitalOcean App Platform dashboard
2. Select your app
3. Navigate to **Settings** → **Domains**
4. Click **Add Domain** and enter: `transitionforstrava.com`
5. DigitalOcean will automatically create the necessary DNS records (A or CNAME) in your DigitalOcean DNS
6. Wait for DNS to propagate (check with `whatsmydns.net`)
7. DigitalOcean will automatically provision an SSL certificate once DNS is verified (usually 5-15 minutes after DNS propagates)

### 4. Update Environment Variables in DigitalOcean

1. In DigitalOcean App Platform, go to **Settings** → **App-Level Environment Variables**
2. Update `STRAVA_REDIRECT_URI` to:
   ```
   https://transitionforstrava.com/api/auth/strava/callback
   ```
3. Save changes (this will trigger a new deployment)

### 5. Update Strava App Settings

1. Go to: https://www.strava.com/settings/api
2. Click **Edit** on your API application
3. Update **Authorization Callback Domain** to: `transitionforstrava.com`
4. Update **Website** (if applicable) to: `https://transitionforstrava.com`
5. Save changes

### 6. Test the Migration

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
- Wait a few minutes for Let's Encrypt to provision the certificate (usually 5-15 minutes after DNS propagates)
- Verify the domain is properly added in both DigitalOcean DNS and App Platform
- Use `whatsmydns.net` to check if DNS has propagated globally
- Ensure nameservers in Namecheap match DigitalOcean's nameservers exactly

**DNS not resolving?**
- Verify nameservers in Namecheap are set to DigitalOcean's nameservers
- Check that the domain is added in DigitalOcean DNS (Networking → Domains)
- Check that the domain is added in App Platform (Settings → Domains)
- Wait for nameserver propagation (can take 24-48 hours, usually much faster)
- Clear your local DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
- Use `whatsmydns.net` to check nameserver propagation globally

**Still redirecting to old domain?**
- Clear your browser cache and cookies
- Try an incognito/private window
- Check that the environment variable update triggered a new deployment
