# Firebase Storage Setup Guide

## Issue
Profile photo uploads are failing because Firebase Storage rules need to be configured.

## Solution

### Step 1: Access Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your LinkGuard project
3. Click on **Storage** in the left sidebar
4. Click on the **Rules** tab

### Step 2: Update Storage Rules
Replace the existing rules with the following:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Allow users to upload and read their own profile photos
    match /profile-photos/{userId}/{fileName} {
      allow read: if true; // Anyone can read profile photos
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Default: deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Step 3: Publish Rules
1. Click **Publish** button
2. Wait for confirmation message

## What These Rules Do

### Profile Photos (`/profile-photos/{userId}/{fileName}`)
- ✅ **Read**: Anyone can view profile photos (public)
- ✅ **Write**: Only authenticated users can upload to their own folder
- ✅ **Delete**: Only the owner can delete their photos
- ✅ **Security**: Users cannot access other users' upload folders

### File Validation (Optional Enhancement)
Add these constraints for better security:

```javascript
match /profile-photos/{userId}/{fileName} {
  allow read: if true;
  allow write: if request.auth != null 
              && request.auth.uid == userId
              && request.resource.size < 5 * 1024 * 1024 // Max 5MB
              && request.resource.contentType.matches('image/.*'); // Images only
  allow delete: if request.auth != null && request.auth.uid == userId;
}
```

## Testing

After updating the rules:

1. Go to Account Settings page
2. Upload a profile photo
3. Click "Save Changes"
4. Check browser console for logs:
   - "Starting photo upload..."
   - "Photo uploaded successfully"
   - "Download URL obtained"
   - "Profile save completed successfully"

## Troubleshooting

### Still Getting Errors?

**Check Console Logs:**
Open browser DevTools (F12) → Console tab → Look for error messages

**Common Issues:**

1. **"Permission denied"**
   - Rules not published yet
   - User not authenticated
   - Wrong userId in path

2. **"Storage bucket not configured"**
   - Check `.env.local` has `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - Verify Storage is enabled in Firebase Console

3. **"Network error"**
   - Check internet connection
   - Verify Firebase project is active

## Environment Variables

Ensure your `.env.local` file has:

```env
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

## Alternative: Test Mode (Development Only)

For quick testing (NOT for production):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

⚠️ **Warning**: This allows any authenticated user to access all files. Use only for testing!

## Production Recommendations

1. ✅ Use the specific path-based rules shown above
2. ✅ Add file size limits (5MB)
3. ✅ Validate file types (images only)
4. ✅ Consider adding rate limiting
5. ✅ Monitor Storage usage in Firebase Console

## Need Help?

If issues persist after following this guide:
1. Check browser console for specific error messages
2. Verify Firebase Storage is enabled
3. Ensure you're logged in when testing
4. Try with a small test image (< 1MB)
