# Troubleshooting Guide - Scanning Not Working

## Quick Fix (Most Common Issue)

The scanning feature has **two modes**:

### 1. **Synchronous Mode** (Default - Works Immediately)
- ✅ No setup required
- ✅ Works out of the box
- ⚠️ Browser must stay open during scan
- ⚠️ Scan stops if browser closes

### 2. **Asynchronous Mode** (Requires Setup)
- ✅ Scan continues in background
- ✅ Can close browser
- ⚠️ Requires Redis + Worker running

---

## Solution: The app will automatically use Synchronous mode if Redis is not available!

**Your scanning should work now without any additional setup.**

---

## Check System Status

Visit this URL to check your setup:
```
http://localhost:3000/api/check-setup
```

You'll see:
```json
{
  "checks": {
    "nextjs": true,
    "youtube_api": true,
    "redis": false,        ← If false, using sync mode
    "worker": false,       ← If false, using sync mode
    "firestore": true
  },
  "messages": [
    "✅ YouTube API key configured",
    "❌ Redis not available",
    "ℹ️  Scans will run in synchronous mode"
  ]
}
```

---

## Common Issues & Solutions

### Issue 1: "Start Scan" button does nothing

**Cause:** JavaScript error or missing dependencies

**Solution:**
1. Open browser console (F12)
2. Look for red error messages
3. Check if you see any errors when clicking the button
4. Share the error message for specific help

---

### Issue 2: Scan starts but fails immediately

**Cause:** YouTube API key issue

**Solution:**
1. Check `.env.local` file exists
2. Verify `NEXT_PUBLIC_YOUTUBE_API_KEY` is set
3. Restart dev server: `npm run dev`

---

### Issue 3: Scan takes forever / browser freezes

**Cause:** Scanning too many videos in sync mode

**Solution:**
1. Start with smaller number (e.g., 10 videos)
2. Or set up Redis + Worker for background mode

---

### Issue 4: Want to use Background Mode

**Requirements:**
1. Redis installed and running
2. Worker process started

**Quick Setup:**

**Step 1: Install Redis**
```bash
# Windows (WSL2)
wsl --install
sudo apt-get install redis-server
sudo service redis-server start

# Or use Docker
docker run -d -p 6379:6379 redis
```

**Step 2: Verify Redis**
```bash
redis-cli ping
# Should return: PONG
```

**Step 3: Start Worker**
```bash
# In a new terminal
node worker.js
```

**Step 4: Restart App**
```bash
npm run dev
```

Now scans will run in background mode!

---

## Testing the Scan

1. Go to Channels page: `http://localhost:3000/channels`
2. Click "Scan" on any channel
3. Configure scan:
   - Select "Scan by Video Count"
   - Enter: **5** (start small for testing)
4. Click "Start Scan"
5. Wait for results

**Expected behavior:**
- **Sync mode:** Alert shows "Scan Complete!" after 1-2 minutes
- **Async mode:** Alert shows "Scan Started (Background Mode)!"

---

## Debug Checklist

- [ ] Dev server running: `npm run dev`
- [ ] Browser console open (F12)
- [ ] No red errors in console
- [ ] YouTube API key in `.env.local`
- [ ] At least one channel connected
- [ ] Valid video count entered (1-10000)
- [ ] Internet connection active

---

## Still Not Working?

### Check Browser Console

Press F12 and look for errors. Common errors:

**Error: "Failed to fetch"**
- Solution: Check if dev server is running on port 3000

**Error: "YouTube API key missing"**
- Solution: Add key to `.env.local` and restart server

**Error: "channelId is undefined"**
- Solution: Reconnect the channel from Channels page

---

## Get Detailed Logs

1. Open browser console (F12)
2. Go to Console tab
3. Click "Start Scan"
4. Look for these messages:

```
Starting scan for channel: Channel Name
Scan mode: count
Parameters: { videoCount: 50 }
Async mode unavailable, using synchronous scan...
Scan response: { success: true, ... }
```

If you see "Scan response", the scan is working!

---

## Mode Comparison

| Feature | Sync Mode | Async Mode |
|---------|-----------|------------|
| Setup Required | None | Redis + Worker |
| Browser Dependency | Must stay open | Can close |
| Scan Speed | Same | Same |
| Reliability | Good | Excellent |
| Auto-retry | No | Yes (3 attempts) |
| Progress Tracking | No | Yes (0-100%) |

---

## Quick Test Commands

```bash
# Check if dev server is running
curl http://localhost:3000/api/check-setup

# Check Redis (if installed)
redis-cli ping

# Check worker (if running)
# Look for "Scan worker started" message in worker terminal

# Test scan API directly
curl -X POST http://localhost:3000/api/scan-channel \
  -H "Content-Type: application/json" \
  -d '{"channelId":"UCm_yUJ38zRtrvQcaCu-Z-Fg","videoCount":5}'
```

---

## Summary

✅ **The app now works in both modes automatically!**

- If Redis is available → Uses background mode
- If Redis is NOT available → Uses synchronous mode
- Either way, scanning will work!

**No additional setup required for basic functionality.**

For background mode (optional), follow the Redis setup in `BACKGROUND_WORKER_SETUP.md`.
