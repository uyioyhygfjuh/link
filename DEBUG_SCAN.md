# Debug Scanning Issue - Step by Step

## Issue: Scan button not working

Let's diagnose this systematically:

## Step 1: Open Browser Console

1. Open your app: `http://localhost:3000/channels`
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Keep it open

## Step 2: Try to Start a Scan

1. Click "Scan" button on any channel
2. Configure scan modal should open
3. Select "Scan by Video Count"
4. Enter: **5**
5. Click "Start Scan"

## Step 3: Check Console Messages

You should see these messages in order:

```
Starting scan for channel: [Channel Name]
Scan mode: count
Parameters: { videoCount: 5 }
```

### If you DON'T see these messages:
**Problem:** JavaScript not executing
**Solution:** Check for errors above these messages

### If you see "Async mode unavailable, using synchronous scan...":
**Good!** This means it's trying to scan

### If you see "Scan response: { success: true, ... }":
**Great!** Scan is working

### If you see errors in RED:
**Copy the error message** - that's the problem

## Step 4: Common Error Messages & Solutions

### Error: "selectedScanChannel is null"
**Cause:** Channel not properly selected
**Solution:**
```javascript
// Check if channel has all required fields
console.log('Selected channel:', selectedScanChannel);
// Should show: { channelId, channelName, firestoreId, ... }
```

### Error: "Failed to fetch"
**Cause:** API route not responding
**Solution:**
1. Check dev server is running: `npm run dev`
2. Check URL: `http://localhost:3000/api/scan-channel`
3. Try accessing API directly in browser

### Error: "channelId is undefined"
**Cause:** Channel data incomplete
**Solution:** Reconnect the channel from scratch

### Error: "YouTube API key missing"
**Cause:** Environment variable not loaded
**Solution:**
1. Check `.env.local` exists
2. Restart dev server: `Ctrl+C` then `npm run dev`

## Step 5: Manual API Test

Test the API directly using curl or browser:

```bash
# Test if API is accessible
curl http://localhost:3000/api/scan-channel -X POST -H "Content-Type: application/json" -d "{\"channelId\":\"UCm_yUJ38zRtrvQcaCu-Z-Fg\",\"videoCount\":5}"
```

Expected response:
```json
{
  "success": true,
  "scannedVideos": 5,
  "videosWithLinks": 3,
  "statistics": { ... }
}
```

## Step 6: Check Network Tab

In browser DevTools:

1. Go to **Network** tab
2. Click "Start Scan"
3. Look for request to `/api/scan-channel` or `/api/scan-channel-async`
4. Click on it
5. Check:
   - **Status:** Should be 200 (success) or 500 (error)
   - **Response:** What did the server return?
   - **Request Payload:** What was sent?

### If Status is 404:
**Problem:** API route not found
**Solution:** Check file exists at `app/api/scan-channel/route.ts`

### If Status is 500:
**Problem:** Server error
**Solution:** Check terminal running `npm run dev` for error messages

### If Status is 400:
**Problem:** Invalid request data
**Solution:** Check request payload has all required fields

## Step 7: Verify Channel Data

Add this temporary code to check channel data:

```javascript
// In handleStartScan function, add at the top:
console.log('=== DEBUG INFO ===');
console.log('selectedScanChannel:', selectedScanChannel);
console.log('scanVideoCount:', scanVideoCount);
console.log('scanMode:', scanMode);
console.log('user:', user);
console.log('==================');
```

Expected output:
```
=== DEBUG INFO ===
selectedScanChannel: {
  channelId: "UCm_yUJ38zRtrvQcaCu-Z-Fg",
  channelName: "Technical Guruji",
  firestoreId: "abc123",
  ...
}
scanVideoCount: "50"
scanMode: "count"
user: { uid: "user123", ... }
==================
```

## Step 8: Check if Modal Opens

If clicking "Scan" button does nothing:

1. Check if `handleScanChannel` is called:
```javascript
const handleScanChannel = (channel: any) => {
  console.log('handleScanChannel called with:', channel);
  setSelectedScanChannel(channel);
  setShowScanModal(true);
};
```

2. Check if modal state changes:
```javascript
// Add useEffect to monitor modal state
useEffect(() => {
  console.log('showScanModal changed to:', showScanModal);
}, [showScanModal]);
```

## Step 9: Simplified Test

Create a minimal test button:

```javascript
<button onClick={async () => {
  console.log('TEST: Starting simple scan...');
  try {
    const response = await fetch('/api/scan-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: 'UCm_yUJ38zRtrvQcaCu-Z-Fg',
        videoCount: 5
      })
    });
    const data = await response.json();
    console.log('TEST: Response:', data);
    alert(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('TEST: Error:', error);
    alert('Error: ' + error.message);
  }
}}>
  TEST SCAN
</button>
```

Add this button temporarily to the page and click it.

## Step 10: Check Environment

Verify your setup:

```bash
# Check Node version (should be 18+)
node --version

# Check if dev server is running
netstat -ano | findstr :3000

# Check if .env.local exists
dir .env.local

# Check YouTube API key
type .env.local | findstr YOUTUBE
```

## Most Likely Issues (in order):

1. ❌ **Dev server not running** → Run `npm run dev`
2. ❌ **Channel data incomplete** → Reconnect channel
3. ❌ **YouTube API key missing** → Add to `.env.local`
4. ❌ **TypeScript errors** → Check terminal for errors
5. ❌ **Browser cache** → Hard refresh (Ctrl+Shift+R)

## Quick Fix Checklist

- [ ] Dev server running on port 3000
- [ ] Browser console open (F12)
- [ ] No red errors in console
- [ ] Channel connected and showing data
- [ ] `.env.local` file exists with YouTube API key
- [ ] Modal opens when clicking "Scan"
- [ ] Can enter video count
- [ ] "Start Scan" button is enabled (not grayed out)

## If Nothing Works

Try this nuclear option:

```bash
# Stop dev server (Ctrl+C)

# Clear Next.js cache
rmdir /s /q .next

# Reinstall dependencies
npm install

# Restart dev server
npm run dev

# Hard refresh browser (Ctrl+Shift+R)
```

## Get Help

If still not working, provide:
1. Screenshot of browser console
2. Screenshot of Network tab
3. Terminal output from `npm run dev`
4. Output of clicking "TEST SCAN" button
5. Content of `.env.local` (hide the actual API key)

This will help identify the exact issue!
