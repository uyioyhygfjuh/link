# Firestore Security Rules Setup

## Error: "Missing or insufficient permissions"

This error occurs because Firestore security rules need to be configured to allow read/write access.

## Quick Fix (Development Mode)

### Step 1: Go to Firebase Console
1. Open: https://console.firebase.google.com/project/broken-link-checker-547e5
2. Click on **Firestore Database** in the left menu
3. Click on the **Rules** tab

### Step 2: Update Security Rules

Replace the existing rules with these **development rules**:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own channels
    match /channels/{channelId} {
      allow read, write: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Step 3: Publish Rules
Click the **Publish** button to save the rules.

---

## Alternative: Test Mode (Temporary - Not for Production!)

If you want to test quickly, you can use test mode rules (⚠️ **INSECURE - Only for development**):

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

This allows all read/write access until Dec 31, 2025. **Use only for testing!**

---

## Production Rules (Recommended)

For production, use these secure rules:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Channels collection
    match /channels/{channelId} {
      // Users can only read their own channels
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // Users can only create channels with their own userId
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      
      // Users can only update their own channels
      allow update: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // Users can only delete their own channels
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Scans collection
    match /scans/{scanId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    
    // Reports collection
    match /reports/{reportId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## How to Apply Rules

### Method 1: Firebase Console (Recommended)
1. Go to Firebase Console → Firestore Database → Rules
2. Paste the rules
3. Click **Publish**

### Method 2: Firebase CLI
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firestore
firebase init firestore

# Edit firestore.rules file
# Then deploy
firebase deploy --only firestore:rules
```

---

## Verify Rules are Working

After updating rules, try these steps:

1. **Refresh your browser** at http://localhost:3000/channels
2. **Click "Connect Channel"**
3. **Enter a YouTube channel** (e.g., @mkbhd)
4. **Click "Connect Channel"**

If it works, you'll see:
- ✅ Channel data fetched from YouTube
- ✅ Channel saved to Firestore
- ✅ Channel displayed in the grid

---

## Troubleshooting

### Still getting permission errors?
1. **Check you're logged in**: Make sure you're authenticated
2. **Clear browser cache**: Ctrl+Shift+Delete
3. **Check Firebase Console**: Verify rules are published
4. **Check browser console**: Look for detailed error messages

### Rules not applying?
- Wait 1-2 minutes after publishing
- Refresh the page
- Check the Rules tab shows "Published" status

---

## Security Best Practices

✅ **DO:**
- Use authentication checks (`request.auth != null`)
- Validate userId matches (`resource.data.userId == request.auth.uid`)
- Limit access to user's own data
- Use specific collection paths

❌ **DON'T:**
- Use `allow read, write: if true;` in production
- Allow access to all documents (`/{document=**}`)
- Skip authentication checks
- Use test mode rules in production

---

## Current Status

Your Firestore is currently in **locked mode** (default). You need to apply one of the rules above to allow your app to read/write data.

**Recommended for now**: Use the **Development Mode** rules (first option) to get started quickly, then switch to Production rules before deploying.
