# Enable Google Maps APIs - Quick Fix

## The Error You're Seeing
```
REQUEST_DENIED - This API project is not authorized to use this API.
```

This means your API key is correct, but the required APIs are NOT enabled in Google Cloud Console.

## Quick Fix (5 minutes)

### Step 1: Go to Google Cloud Console
1. Open: https://console.cloud.google.com/
2. Make sure you're in the project that contains your API key: `AIzaSyD7UGNEpxEqtMgMYzeRWI5dXelWzP4jYyk`

### Step 2: Enable Required APIs
Go to: **APIs & Services** → **Library**

Enable these 5 APIs (search for each and click "Enable"):

1. **Geocoding API** ⚠️ REQUIRED
   - Search: "Geocoding API"
   - Click "Enable"
   - Status should show "API enabled"

2. **Distance Matrix API** ⚠️ REQUIRED
   - Search: "Distance Matrix API"
   - Click "Enable"

3. **Maps JavaScript API** ⚠️ REQUIRED (for frontend)
   - Search: "Maps JavaScript API"
   - Click "Enable"

4. **Places API** ⚠️ REQUIRED (for autocomplete)
   - Search: "Places API"
   - Click "Enable"

5. **Directions API** (optional, for routes)
   - Search: "Directions API"
   - Click "Enable"

### Step 3: Verify Billing is Enabled
1. Go to: **Billing** (in left menu)
2. Make sure billing is linked to your project
3. **Note:** You won't be charged for free tier usage

### Step 4: Wait 2-5 Minutes
- API changes can take a few minutes to propagate
- Wait, then test again

### Step 5: Test
Restart your backend server and try creating a booking again.

## Quick Checklist

- [ ] Enabled **Geocoding API**
- [ ] Enabled **Distance Matrix API**
- [ ] Enabled **Maps JavaScript API**
- [ ] Enabled **Places API**
- [ ] Enabled **Directions API** (optional)
- [ ] Billing is linked to project
- [ ] Waited 2-5 minutes after enabling
- [ ] Restarted backend server

## How to Check Which APIs Are Enabled

1. Go to: **APIs & Services** → **Enabled APIs**
2. You should see all 5 APIs listed there
3. If any are missing, enable them

## Still Not Working?

1. **Check API key restrictions:**
   - Go to **APIs & Services** → **Credentials**
   - Click on your API key
   - Under "API restrictions", make sure "Don't restrict key" is selected OR all 5 APIs are checked
   - Click "Save"

2. **Verify the API key:**
   - Make sure you're using the correct API key in your .env file
   - The key should start with: `AIzaSyD7UGNEpxEqtMgMYzeRWI5dXelWzP4jYyk`

3. **Check for typos:**
   - Make sure there are no extra spaces in your .env file
   - Format: `GOOGLE_MAPS_API_KEY=AIzaSyD7UGNEpxEqtMgMYzeRWI5dXelWzP4jYyk`

## Test API Key Directly

You can test if the APIs work by visiting this URL in your browser:
```
https://maps.googleapis.com/maps/api/geocode/json?address=Nairobi,Kenya&key=AIzaSyD7UGNEpxEqtMgMYzeRWI5dXelWzP4jYyk
```

If it works, you should see JSON data with coordinates.
If you see "REQUEST_DENIED", the APIs are not enabled yet.
