# Domain Migration Guide: transitionforstrava.com

This guide covers updating the app to use your custom domain `transitionforstrava.com`.

## ✅ Code Changes (Already Done)

The app code is already configured to work with any domain. The OAuth callback route automatically detects the correct domain from request headers, so no code changes are needed.

## 🔧 Required Configuration Updates

### 1. Configure DNS in Namecheap

**First, get the DNS values from DigitalOcean:**

1. Go to your DigitalOcean App Platform dashboard
2. Select your app
3. Navigate to **Settings** → **Domains**
4. Click **Add Domain** and enter: `transitionforstrava.com`
5. DigitalOcean will show you the DNS records you need to configure (either CNAME or A records)

**Then, configure DNS in Namecheap:**

1. Log in to your Namecheap account
2. Go to **Domain List** → Click **Manage** next to `transitionforstrava.com`
3. Navigate to the **Advanced DNS** tab
4. You'll see existing DNS records. You need to add/modify records based on what DigitalOcean shows:

   **If DigitalOcean provides a CNAME:**
   - Click **Add New Record**
   - Type: **CNAME Record**
   - Host: `@` (or leave blank for root domain)
   - Value: The CNAME target from DigitalOcean (e.g., `transition-app-vslqi.ondigitalocean.app`)
   - TTL: Automatic (or 30 min)
   - Click the checkmark to save

   **If DigitalOcean provides A records (IP addresses):**
   - Click **Add New Record** for each IP address
   - Type: **A Record**
   - Host: `@` (or leave blank for root domain)
   - Value: The IP address from DigitalOcean
   - TTL: Automatic (or 30 min)
   - Click the checkmark to save

5. **Remove conflicting records**: If you have any existing A or CNAME records for `@`, remove them first
6. Save all changes

**Note:** DNS changes can take a few minutes to several hours to propagate. You can check propagation status using tools like `whatsmydns.net`.

### 2. DigitalOcean App Platform

1. After adding the domain in DigitalOcean (step 1 above), wait for DNS to propagate
2. DigitalOcean will automatically provision an SSL certificate once DNS is verified
3. This usually takes 5-15 minutes after DNS propagation

### 3. Update Environment Variables in DigitalOcean

1. In DigitalOcean App Platform, go to **Settings** → **App-Level Environment Variables**
2. Update `STRAVA_REDIRECT_URI` to:
   ```
   https://transitionforstrava.com/api/auth/strava/callback
   ```
3. Save changes (this will trigger a new deployment)

### 4. Update Strava App Settings

1. Go to: https://www.strava.com/settings/api
2. Click **Edit** on your API application
3. Update **Authorization Callback Domain** to: `transitionforstrava.com`
4. Update **Website** (if applicable) to: `https://transitionforstrava.com`
5. Save changes

### 5. Test the Migration

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
- Check DNS records are correctly configured in Namecheap
- Verify the domain is properly added in DigitalOcean
- Use `whatsmydns.net` to check if DNS has propagated globally

**DNS not resolving?**
- Double-check the DNS records in Namecheap match exactly what DigitalOcean provided
- Ensure you removed any conflicting A/CNAME records
- Wait for DNS propagation (can take up to 48 hours, usually much faster)
- Clear your local DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)

**Still redirecting to old domain?**
- Clear your browser cache and cookies
- Try an incognito/private window
- Check that the environment variable update triggered a new deployment
