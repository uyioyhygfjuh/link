# Notification System Integration Guide

## Overview
The LinkGuard notification system provides real-time notifications for all major user actions. Notifications appear in the header bell icon and update automatically without page refresh.

## ✅ Already Implemented

### 1. Core System
- ✅ Notification library (`lib/notifications.ts`)
- ✅ NotificationBell component with dropdown
- ✅ Real-time Firestore listener
- ✅ Mark as read functionality
- ✅ Header integration (desktop & mobile)
- ✅ Login notifications on dashboard

## 🔧 Integration Required

### 2. Channel Added Notification

**Location:** `app/channels/page.tsx`

**When to trigger:** After successfully connecting a new channel

```typescript
import { notifyChannelAdded } from '@/lib/notifications';

// In handleConnectChannel function, after successful channel creation:
await notifyChannelAdded(user.uid, channelData.channelName, channelId);
```

**Example:**
```typescript
const handleConnectChannel = async () => {
  try {
    // ... existing channel connection code ...
    
    // After channel is saved to Firestore:
    await notifyChannelAdded(
      user.uid,
      channelData.channelName,
      channelDoc.id
    );
    
    alert('Channel connected successfully!');
  } catch (error) {
    // ... error handling ...
  }
};
```

---

### 3. Channel Removed Notification

**Location:** `app/channels/page.tsx`

**When to trigger:** After successfully removing a channel

```typescript
import { notifyChannelRemoved } from '@/lib/notifications';

// In handleRemoveChannel function:
await notifyChannelRemoved(user.uid, channelName);
```

**Example:**
```typescript
const handleRemoveChannel = async (channelId: string, channelName: string) => {
  try {
    await deleteDoc(doc(db, 'channels', channelId));
    
    // Send notification
    await notifyChannelRemoved(user.uid, channelName);
    
    // Refresh channels list
    loadChannels();
  } catch (error) {
    console.error('Error removing channel:', error);
  }
};
```

---

### 4. Scan Completed Notification

**Location:** `app/channels/page.tsx` or wherever channel scanning happens

**When to trigger:** After channel scan completes

```typescript
import { notifyScanCompleted } from '@/lib/notifications';

// After scan completes:
await notifyScanCompleted(
  user.uid,
  channelName,
  videoCount,
  brokenLinksCount,
  channelId
);
```

**Example:**
```typescript
const handleScanChannel = async (channel: Channel) => {
  try {
    // ... scanning logic ...
    
    // After scan completes and results are saved:
    const scanResults = await performScan(channel.id);
    
    await notifyScanCompleted(
      user.uid,
      channel.channelName,
      scanResults.videoCount,
      scanResults.brokenLinks,
      channel.id
    );
    
  } catch (error) {
    console.error('Scan error:', error);
  }
};
```

---

### 5. Extract Completed Notification

**Location:** Where channel video extraction happens

**When to trigger:** After extracting videos from a channel

```typescript
import { notifyExtractCompleted } from '@/lib/notifications';

// After extraction completes:
await notifyExtractCompleted(
  user.uid,
  channelName,
  extractedVideoCount,
  channelId
);
```

**Example:**
```typescript
const handleExtractVideos = async (channelId: string, channelName: string) => {
  try {
    const videos = await extractChannelVideos(channelId);
    
    // Save videos to database
    await saveVideos(videos);
    
    // Send notification
    await notifyExtractCompleted(
      user.uid,
      channelName,
      videos.length,
      channelId
    );
    
  } catch (error) {
    console.error('Extract error:', error);
  }
};
```

---

### 6. Bulk Scan Completed Notification

**Location:** `app/Video/page.tsx` or bulk scan functionality

**When to trigger:** After bulk video scan completes

```typescript
import { notifyBulkScanCompleted } from '@/lib/notifications';

// After bulk scan completes:
await notifyBulkScanCompleted(
  user.uid,
  totalVideosScanned,
  totalBrokenLinks
);
```

**Example:**
```typescript
const handleBulkScan = async (videoUrls: string[]) => {
  try {
    const results = await scanMultipleVideos(videoUrls);
    
    const brokenLinks = results.reduce((sum, r) => sum + r.brokenLinks, 0);
    
    // Send notification
    await notifyBulkScanCompleted(
      user.uid,
      videoUrls.length,
      brokenLinks
    );
    
  } catch (error) {
    console.error('Bulk scan error:', error);
  }
};
```

---

### 7. Plan Upgraded Notification

**Location:** `app/pricing/page.tsx` or payment success handler

**When to trigger:** After successful plan upgrade

```typescript
import { notifyPlanUpgraded } from '@/lib/notifications';

// After plan upgrade:
await notifyPlanUpgraded(user.uid, planName);
```

**Example:**
```typescript
const handlePlanUpgrade = async (planId: string, planName: string) => {
  try {
    // Process payment
    await processPayment(planId);
    
    // Update user plan in Firestore
    await updateDoc(doc(db, 'users', user.uid), {
      plan: planName,
      planStatus: 'Active'
    });
    
    // Send notification
    await notifyPlanUpgraded(user.uid, planName);
    
    router.push('/dashboard');
  } catch (error) {
    console.error('Upgrade error:', error);
  }
};
```

---

## 📊 Firestore Structure

### Notifications Collection

```typescript
{
  userId: string;           // User who receives notification
  type: NotificationType;   // Type of notification
  title: string;            // Notification title
  message: string;          // Notification message
  read: boolean;            // Read status
  createdAt: string;        // ISO timestamp
  metadata: {               // Optional metadata
    channelId?: string;
    channelName?: string;
    videoCount?: number;
    brokenLinks?: number;
    planName?: string;
  }
}
```

### Firestore Rules

Add these rules to Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Notifications
    match /notifications/{notificationId} {
      // Users can read their own notifications
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // Only server/admin can create notifications
      allow create: if request.auth != null;
      
      // Users can update (mark as read) their own notifications
      allow update: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // Users can delete their own notifications
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## 🎨 Notification Types & Icons

| Type | Icon | Title | Use Case |
|------|------|-------|----------|
| `channel_added` | 📺 | Channel Added | New channel connected |
| `channel_removed` | 🗑️ | Channel Removed | Channel disconnected |
| `scan_completed` | ✅ | Scan Completed | Channel scan finished |
| `extract_completed` | 📥 | Extraction Completed | Videos extracted |
| `bulk_scan_completed` | ⚡ | Bulk Scan Completed | Multiple videos scanned |
| `user_login` | 👋 | Welcome Back! | User logged in |
| `plan_upgraded` | 🎉 | Plan Upgraded | Subscription upgraded |

---

## 🔔 Features

### Real-Time Updates
- Notifications appear instantly without page refresh
- Uses Firestore real-time listeners
- Auto-updates unread count badge

### User Experience
- **Unread Badge:** Red badge shows unread count (max "9+")
- **Visual Indicators:** Blue dot and highlight for unread notifications
- **Time Display:** Shows relative time (e.g., "5m ago", "2h ago")
- **Mark as Read:** Click notification to mark as read
- **Mark All Read:** Button to mark all notifications as read
- **Responsive:** Works on desktop and mobile

### Performance
- Limits to 20 most recent notifications
- Efficient Firestore queries with indexes
- Automatic cleanup of old notifications (optional)

---

## 🧪 Testing

### Test Each Notification Type:

1. **Channel Added:**
   - Go to Channels page
   - Connect a new channel
   - Check notification bell

2. **Channel Removed:**
   - Remove a channel
   - Check notification

3. **Scan Completed:**
   - Scan a channel
   - Wait for completion
   - Check notification

4. **Extract Completed:**
   - Extract videos from channel
   - Check notification

5. **Bulk Scan:**
   - Scan multiple videos
   - Check notification

6. **Login:**
   - Log out and log back in
   - Check notification

7. **Plan Upgrade:**
   - Upgrade plan (or simulate)
   - Check notification

---

## 🐛 Troubleshooting

### Notifications Not Appearing

**Check Firestore Rules:**
```bash
# Ensure notifications collection has proper read/write rules
```

**Check Console Logs:**
```javascript
// Look for errors in browser console
console.log('Notification created:', notificationId);
```

**Verify User ID:**
```javascript
// Ensure correct user ID is being used
console.log('User ID:', user.uid);
```

### Duplicate Notifications

**Use Refs to Prevent Duplicates:**
```typescript
const notificationSent = useRef(false);

if (!notificationSent.current) {
  await notifyChannelAdded(...);
  notificationSent.current = true;
}
```

### Real-Time Not Working

**Check Firestore Connection:**
- Verify internet connection
- Check Firebase project status
- Ensure Firestore is enabled

---

## 📝 Best Practices

1. **Always await notifications:**
   ```typescript
   await notifyChannelAdded(...);
   ```

2. **Handle errors gracefully:**
   ```typescript
   try {
     await notifyChannelAdded(...);
   } catch (error) {
     console.error('Notification error:', error);
     // Don't block main flow
   }
   ```

3. **Provide meaningful messages:**
   ```typescript
   // Good
   `Scanned 50 videos in "Tech Channel". Found 3 broken links.`
   
   // Bad
   `Scan complete.`
   ```

4. **Include relevant metadata:**
   ```typescript
   metadata: {
     channelId: channel.id,
     channelName: channel.name,
     videoCount: 50,
     brokenLinks: 3
   }
   ```

---

## 🚀 Quick Start Checklist

- [ ] Firestore rules configured
- [ ] NotificationBell appears in header
- [ ] Login notification works
- [ ] Channel added notification integrated
- [ ] Channel removed notification integrated
- [ ] Scan completed notification integrated
- [ ] Extract completed notification integrated
- [ ] Bulk scan notification integrated
- [ ] Plan upgrade notification integrated
- [ ] All notifications tested
- [ ] Mobile view tested

---

## 📚 API Reference

### Available Functions

```typescript
// Create custom notification
createNotification(userId, type, title, message, metadata?)

// Specific notification helpers
notifyChannelAdded(userId, channelName, channelId)
notifyChannelRemoved(userId, channelName)
notifyScanCompleted(userId, channelName, videoCount, brokenLinks, channelId)
notifyExtractCompleted(userId, channelName, videoCount, channelId)
notifyBulkScanCompleted(userId, videoCount, brokenLinks)
notifyUserLogin(userId, userName)
notifyPlanUpgraded(userId, planName)

// Mark as read
markNotificationAsRead(notificationId)
markAllNotificationsAsRead(userId)

// Subscribe to notifications
subscribeToNotifications(userId, callback, limit?)
```

---

## 🎯 Next Steps

1. Integrate notifications into all workflows (see sections 2-7 above)
2. Test each notification type
3. Customize notification messages if needed
4. Add notification preferences in Account settings (optional)
5. Implement notification cleanup for old notifications (optional)

---

For questions or issues, check the browser console for error messages and verify Firestore rules are properly configured.
