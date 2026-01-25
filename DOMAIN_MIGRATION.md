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

**Important:** You're currently viewing the "Advanced DNS" tab. The existing records you see (CNAME for `www` and URL Redirect for `@`) will become inactive once you change nameservers to DigitalOcean. You don't need to delete them - they'll simply be ignored.

**Step-by-step instructions:**

1. Log in to your Namecheap account
2. Go to **Domain List** (from the main dashboard)
3. Find `transitionforstrava.com` and click **Manage** (the green button on the right)
4. You'll see several tabs at the top: **Domain**, **Nameservers**, **Advanced DNS**, etc.
5. **Click on the "Nameservers" tab** (NOT "Advanced DNS")
6. You'll see a section showing your current nameservers (likely "Namecheap BasicDNS" or similar)
7. Click the dropdown/radio button to select **"Custom DNS"** (instead of "Namecheap BasicDNS")
8. You'll see 2-4 input fields for nameservers. Enter the DigitalOcean nameservers you copied:
   - **Nameserver 1:** `ns1.digitalocean.com`
   - **Nameserver 2:** `ns2.digitalocean.com`
   - **Nameserver 3:** `ns3.digitalocean.com`
   - (If there's a 4th field, you can leave it blank or add `ns4.digitalocean.com` if DigitalOcean provided it)
9. Click the **green checkmark** (✓) button to save
10. You should see a confirmation message that the nameservers have been updated

**Note:** 
- The existing DNS records in "Advanced DNS" (like the CNAME and URL Redirect you see) will stop working once nameservers change - this is expected and correct
- Nameserver changes can take 24-48 hours to propagate globally (though often much faster, sometimes within minutes)
- You can verify propagation using `whatsmydns.net` - search for your domain and check the "NS" (nameserver) records

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
