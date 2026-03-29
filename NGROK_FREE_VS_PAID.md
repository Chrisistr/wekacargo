# ngrok Free vs Paid - What You Need

## Free Tier (No Subscription Required) ✅

**You can use ngrok for FREE** with these features:

### What's Free:
- ✅ Public HTTPS URLs
- ✅ HTTP tunneling (what you need for M-Pesa callbacks)
- ✅ Basic web interface
- ✅ Works perfectly for development/testing

### Free Tier Limitations:
- ⚠️ **URL changes each time** you restart ngrok
  - Each time you run `ngrok http 5000`, you get a new random URL
  - Example: `https://abc123.ngrok.io` → `https://xyz789.ngrok.io`
  - **Solution**: Update your `.env` file each time with the new URL

- ⚠️ **Session time limits** (8 hours for free tier)
  - After 8 hours, ngrok stops and you need to restart
  - Just restart and update the URL

- ⚠️ **Limited connections per minute**
  - Usually fine for testing, but might hit limits with heavy traffic

## Paid Plans (Optional)

### If You Want:
- ✅ **Stable URLs** that don't change
- ✅ **Custom domains** (your-company.ngrok.io)
- ✅ **Longer sessions** (no 8-hour limit)
- ✅ **More connections**

**Cost**: Starting at $8/month

## For Your Use Case (M-Pesa Testing)

**Free tier is PERFECT!** You just need to:

1. **Start ngrok**: `ngrok http 5000`
2. **Copy the URL** it gives you
3. **Update `.env`** with that URL
4. **Restart backend**
5. **Test payment**

If you restart ngrok later, just update the URL in `.env` again.

## Alternative Free Solutions

If you don't want to use ngrok, here are free alternatives:

### Option 1: webhook.site (Easiest for Testing)
1. Go to: https://webhook.site
2. Copy your unique URL
3. Use it as callback URL
4. **Note**: You won't receive callbacks in your app, but STK Push will work

### Option 2: localtunnel (Free, Open Source)
```bash
npm install -g localtunnel
lt --port 5000
```
- Free alternative to ngrok
- URLs also change each time (like ngrok free)

### Option 3: serveo.net (Free, No Install)
```bash
ssh -R 80:localhost:5000 serveo.net
```
- Free SSH tunneling
- No installation needed (uses SSH)

### Option 4: Cloudflare Tunnel (Free)
- More complex setup
- Free and stable URLs
- Good for production

## Recommendation

**For Testing/Development:**
- ✅ Use **ngrok free tier** - easiest and most reliable
- Just update `.env` when URL changes

**For Production:**
- Deploy your backend to a real server (Heroku, AWS, etc.)
- Use your actual domain for callbacks
- No ngrok needed

## Quick Start with ngrok Free

1. **Download ngrok** (free): https://ngrok.com/download
2. **Extract and run**:
   ```bash
   ngrok http 5000
   ```
3. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)
4. **Add to `backend/.env`**:
   ```env
   MPESA_CALLBACK_URL=https://abc123.ngrok.io/api/payments/callback
   ```
5. **Restart backend**
6. **Done!** No subscription needed.

## Summary

- ❌ **No subscription needed** for testing
- ✅ **Free tier works perfectly** for M-Pesa callbacks
- ⚠️ **Just update URL** in `.env` when you restart ngrok
- 💰 **Paid plans** only needed if you want stable URLs or custom domains

**Bottom line: Use ngrok free tier - it's all you need for testing!**

