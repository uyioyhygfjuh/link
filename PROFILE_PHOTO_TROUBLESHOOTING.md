# Profile Photo Upload Troubleshooting Guide

## Current Issue
Profile photo upload shows loading indicator indefinitely and doesn't complete.

## Diagnostic Steps

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Try uploading a photo
4. Look for these log messages:

**Expected Success Flow:**
```
Starting photo upload... [filename]
Uploading to: profile-photos/[userId]/[timestamp]_[filename]
Photo uploaded successfully
Download URL obtained: https://...
Updating Firebase Auth profile...
Firebase Auth profile updated
Updating Firestore document...
Firestore document updated
Profile save completed successfully
```

**If Stuck At:**
- "Starting photo upload..." → Storage upload failing
- "Uploading to:" → Permission denied or network issue
- "Updating Firebase Auth profile..." → Auth update failing
- "Updating Firestore document..." → Firestore write failing

### Step 2: Check Error Messages

**Common Errors:**

#### Error: "Permission denied" or "storage/unauthorized"
**Cause:** Firebase Storage rules not configured
**Solution:** Follow `FIREBASE_STORAGE_SETUP.md`

#### Error: "storage/object-not-found"
**Cause:** Storage bucket doesn't exist
**Solution:** 
1. Go to Firebase Console → Storage
2. Click "Get Started" if Storage isn't initialized
3. Choose production mode or test mode

#### Error: "auth/requires-recent-login"
**Cause:** User session is old
**Solution:** Log out and log back in

#### Error: Network timeout
**Cause:** Large file or slow connection
**Solution:** Try smaller image (< 1MB)

### Step 3: Verify Firebase Storage Setup

1. **Go to Firebase Console:**
   - https://console.firebase.google.com/
   - Select project: `broken-link-checker-547e5`

2. **Check Storage Status:**
   - Click **Storage** in left sidebar
   - Should see "Cloud Storage" bucket
   - If not initialized, click "Get Started"

3. **Check Storage Rules:**
   - Click **Rules** tab
   - Should have rules for `/profile-photos/{userId}/{fileName}`
   - If empty or default, update using `FIREBASE_STORAGE_SETUP.md`

### Step 4: Test with Simple Upload

Try this minimal test in browser console:

```javascript
// Test Firebase Storage connection
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

const testUpload = async () => {
  const testRef = ref(storage, 'test/hello.txt');
  const blob = new Blob(['Hello World'], { type: 'text/plain' });
  try {
    await uploadBytes(testRef, blob);
    console.log('✅ Storage working!');
  } catch (error) {
    console.error('❌ Storage error:', error);
  }
};

testUpload();
```

### Step 5: Check Environment Variables

Verify `.env.local` has correct values:

```env
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=broken-link-checker-547e5.firebasestorage.app
```

**After changing .env.local:**
1. Stop dev server (Ctrl+C)
2. Restart: `npm run dev`
3. Hard refresh browser (Ctrl+Shift+R)

## Quick Fixes

### Fix 1: Update Firebase Storage Rules

Copy this to Firebase Console → Storage → Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-photos/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

### Fix 2: Initialize Firebase Storage

If Storage shows "Get Started" button:
1. Click "Get Started"
2. Choose "Start in production mode"
3. Select location (closest to users)
4. Click "Done"
5. Update rules as shown in Fix 1

### Fix 3: Clear Browser Cache

1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"
4. Try upload again

### Fix 4: Test with Different Image

1. Use a small PNG (< 500KB)
2. Simple filename (no special characters)
3. Try different image format (JPG vs PNG)

## Verification Checklist

- [ ] Firebase Storage is initialized in console
- [ ] Storage rules are configured for profile-photos
- [ ] .env.local has NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- [ ] Dev server restarted after .env changes
- [ ] User is logged in
- [ ] Browser console shows no errors
- [ ] Image is < 5MB
- [ ] Image is valid format (JPG/PNG/GIF)

## Still Not Working?

### Check Network Tab
1. Open DevTools → Network tab
2. Try upload
3. Look for requests to `firebasestorage.googleapis.com`
4. Check status codes:
   - 200/201 = Success
   - 403 = Permission denied (fix rules)
   - 404 = Bucket not found (initialize storage)
   - 500 = Server error (try again)

### Enable Detailed Logging

Add to `lib/firebase.ts`:

```typescript
import { getStorage } from 'firebase/storage';

const storage = getStorage(app);

// Enable debug logging
if (typeof window !== 'undefined') {
  (window as any).FIREBASE_STORAGE_DEBUG = true;
}

export { storage };
```

### Contact Support

If all else fails, provide:
1. Browser console screenshot
2. Network tab screenshot
3. Firebase Storage rules screenshot
4. Error message from alert

## Success Indicators

✅ Photo appears in preview immediately
✅ "Saving..." button shows briefly
✅ Success message appears: "Profile updated successfully!"
✅ Photo appears in header
✅ Page refresh shows photo persists
✅ No errors in console

## Performance Tips

- Compress images before upload (use tools like TinyPNG)
- Recommended size: 500x500px or smaller
- Keep file size under 1MB for best performance
- Use JPG for photos, PNG for graphics
