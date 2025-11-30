# Firestore Rules Setup - REQUIRED for Notifications

## ⚠️ CRITICAL: Notifications Won't Work Without These Rules

If you're not seeing notifications, it's because **Firestore security rules need to be configured**.

## 🔧 Quick Fix (5 Minutes)

### Step 1: Go to Firebase Console
1. Open: https://console.firebase.google.com/
2. Select your project: **broken-link-checker-547e5**
3. Click **Firestore Database** in left sidebar
4. Click **Rules** tab at the top

### Step 2: Copy These Rules

**Replace ALL existing rules** with this:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Channels collection
    match /channels/{channelId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Channel Reports collection
    match /channelReports/{reportId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Scan Sessions collection
    match /scanSessions/{sessionId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Video Scans collection
    match /videoScans/{scanId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // ⭐ NOTIFICATIONS COLLECTION - REQUIRED FOR NOTIFICATION SYSTEM ⭐
    match /notifications/{notificationId} {
      // Users can read their own notifications
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // Users can create notifications (for their own account)
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      
      // Users can update (mark as read) their own notifications
      allow update: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // Users can delete their own notifications
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

### Step 3: Publish Rules
1. Click the **Publish** button (top right)
2. Wait for "Rules published successfully" message
3. **Done!** Notifications will now work

---

## 🧪 Test Notifications

After publishing rules:

1. **Refresh your browser** (Ctrl + Shift + R)
2. **Add a test channel:**
   - Go to Channels page
   - Click "Connect Channel"
   - Enter: `@mkbhd`
   - Click "Connect"
3. **Check notification bell:**
   - Should see red badge with "1"
   - Click bell to see notification
   - Should show: "Channel Added"

4. **Remove the channel:**
   - Click "Remove" on the channel
   - Confirm deletion
5. **Check notification bell again:**
   - Badge should show "2"
   - Should see "Channel Removed" notification

---

## 🐛 Still Not Working?

### Check 1: Browser Console

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for errors

**Common Errors:**

**Error: "Missing or insufficient permissions"**
```
Solution: Rules not published yet. Follow steps above.
```

**Error: "PERMISSION_DENIED"**
```
Solution: 
1. Check you're logged in
2. Verify rules are published
3. Hard refresh browser (Ctrl + Shift + R)
```

**Error: "Network error"**
```
Solution: Check internet connection
```

### Check 2: Firestore Console

1. Go to Firebase Console → Firestore Database
2. Click **Data** tab
3. Look for `notifications` collection
4. Should see documents being created when you add/remove channels

**If collection doesn't exist:**
- Rules might not be published
- Or no notifications have been created yet

**If documents exist but you don't see them:**
- Rules might be blocking reads
- Check browser console for permission errors

### Check 3: Network Tab

1. Open DevTools → Network tab
2. Filter by "firestore"
3. Add/remove a channel
4. Look for requests to Firestore

**Should see:**
- POST request to create notification
- Response: 200 OK

**If you see 403 Forbidden:**
- Rules not configured correctly
- Republish rules and hard refresh

---

## 📋 Complete Firestore Rules (Copy-Paste Ready)

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Channels collection
    match /channels/{channelId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Channel Reports collection
    match /channelReports/{reportId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Scan Sessions collection
    match /scanSessions/{sessionId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Video Scans collection
    match /videoScans/{scanId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Notifications collection
    match /notifications/{notificationId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update: if request.auth != null && resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## ✅ Verification Steps

After setting up rules:

1. **Check Rules Published:**
   - Firebase Console → Firestore → Rules
   - Should see the rules above
   - Should see "Last published" timestamp

2. **Test Notification Creation:**
   - Add a channel
   - Open browser console
   - Should see: "Notification created" (no errors)

3. **Check Firestore Data:**
   - Firebase Console → Firestore → Data
   - Click `notifications` collection
   - Should see documents with your userId

4. **Check Notification Bell:**
   - Should see red badge
   - Click to open dropdown
   - Should see notifications

---

## 🎯 Quick Checklist

- [ ] Opened Firebase Console
- [ ] Selected correct project
- [ ] Went to Firestore Database → Rules
- [ ] Copied rules from above
- [ ] Clicked Publish
- [ ] Saw success message
- [ ] Hard refreshed browser (Ctrl + Shift + R)
- [ ] Tested adding a channel
- [ ] Saw notification in bell
- [ ] Tested removing channel
- [ ] Saw second notification

---

## 💡 Why This Happens

**Default Firestore Rules:**
```javascript
// Default rules block everything
allow read, write: if false;
```

**This blocks:**
- ❌ Creating notifications
- ❌ Reading notifications
- ❌ Updating notifications

**After adding rules:**
- ✅ Users can create their own notifications
- ✅ Users can read their own notifications
- ✅ Users can mark notifications as read
- ✅ Real-time updates work

---

## 🔒 Security Notes

These rules are **secure** because:
- ✅ Users can only see their own notifications
- ✅ Users can only create notifications for themselves
- ✅ Users cannot see other users' notifications
- ✅ Users cannot modify other users' notifications
- ✅ Requires authentication (logged in)

---

## 📞 Need Help?

If notifications still don't work after following this guide:

1. **Check browser console** for specific error messages
2. **Screenshot the error** and check the message
3. **Verify you're logged in** to the app
4. **Try in incognito mode** to rule out cache issues
5. **Check Firebase project** is active and not paused

---

## 🎉 Success!

Once rules are published, you should see:
- ✅ Notifications appear when adding channels
- ✅ Notifications appear when removing channels
- ✅ Notifications appear when scans complete
- ✅ Red badge shows unread count
- ✅ Real-time updates without refresh
- ✅ Click to mark as read works

**The notification system is now fully functional!** 🔔
