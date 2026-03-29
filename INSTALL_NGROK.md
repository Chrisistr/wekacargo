# How to Install ngrok on Windows

## Option 1: Download and Install (Recommended)

### Step 1: Download ngrok
1. Go to: https://ngrok.com/download
2. Click "Download for Windows"
3. Save the ZIP file (e.g., `ngrok-v3-stable-windows-amd64.zip`)

### Step 2: Extract ngrok
1. Right-click the ZIP file
2. Select "Extract All..."
3. Choose a location (e.g., `C:\ngrok` or `C:\Users\USER\ngrok`)
4. Click "Extract"

### Step 3: Add to PATH (Optional but Recommended)

**Method A: Add to PATH (Permanent)**
1. Copy the path where you extracted ngrok (e.g., `C:\ngrok`)
2. Press `Win + X` → "System" → "Advanced system settings"
3. Click "Environment Variables"
4. Under "User variables", find "Path" and click "Edit"
5. Click "New" and paste your ngrok path (e.g., `C:\ngrok`)
6. Click "OK" on all windows
7. **Close and reopen PowerShell** for changes to take effect

**Method B: Use Full Path (Quick Fix)**
- Instead of `ngrok`, use the full path:
  ```powershell
  C:\ngrok\ngrok.exe config add-authtoken 366LF8VwR9nEah130FkWCzkgy7P_4L6BESj9TcnexEkxyAuMJ
  ```
  (Replace `C:\ngrok` with your actual path)

### Step 4: Verify Installation
Open a **new** PowerShell window and run:
```powershell
ngrok version
```

You should see the version number.

## Option 2: Install via Chocolatey (If You Have It)

If you have Chocolatey package manager:
```powershell
choco install ngrok
```

## Option 3: Install via Scoop (If You Have It)

If you have Scoop package manager:
```powershell
scoop install ngrok
```

## Quick Setup After Installation

1. **Run the auth command** (use full path if not in PATH):
   ```powershell
   ngrok config add-authtoken 366LF8VwR9nEah130FkWCzkgy7P_4L6BESj9TcnexEkxyAuMJ
   ```
   
   OR if not in PATH:
   ```powershell
   C:\ngrok\ngrok.exe config add-authtoken 366LF8VwR9nEah130FkWCzkgy7P_4L6BESj9TcnexEkxyAuMJ
   ```

2. **Start ngrok**:
   ```powershell
   ngrok http 5000
   ```

3. **Copy the HTTPS URL** and add to `backend/.env`

## Troubleshooting

### "ngrok.exe not found"
- Make sure you extracted the ZIP file
- Check the path where you extracted it
- Use the full path: `C:\path\to\ngrok.exe`

### "Still not recognized after adding to PATH"
- Close and reopen PowerShell (PATH changes require new session)
- Or restart your computer
- Or use the full path method

### "Permission denied"
- Right-click PowerShell → "Run as Administrator"
- Then run the command again

## Recommended: Use Full Path (Easiest)

If you don't want to mess with PATH:

1. **Extract ngrok** to a simple location like `C:\ngrok`
2. **Use full path** in all commands:
   ```powershell
   # Auth
   C:\ngrok\ngrok.exe config add-authtoken 366LF8VwR9nEah130FkWCzkgy7P_4L6BESj9TcnexEkxyAuMJ
   
   # Start ngrok
   C:\ngrok\ngrok.exe http 5000
   ```

## Summary

1. ✅ Download ngrok from https://ngrok.com/download
2. ✅ Extract the ZIP file
3. ✅ Use full path OR add to PATH
4. ✅ Run auth command
5. ✅ Start ngrok with `ngrok http 5000`

