import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, limit, onSnapshot, updateDoc, doc, writeBatch, deleteDoc, getDocs, getCountFromServer } from 'firebase/firestore';

export type NotificationType = 
  | 'channel_added'
  | 'channel_removed'
  | 'scan_completed'
  | 'extract_completed'
  | 'bulk_scan_completed'
  | 'user_login'
  | 'plan_upgraded'
  | 'session_deleted'
  | 'withdrawal_requested'
  | 'withdrawal_completed'
  | 'withdrawal_rejected'
  | 'auto_scan_started'
  | 'auto_scan_completed';

export interface Notification {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  metadata?: {
    channelId?: string;
    channelName?: string;
    videoCount?: number;
    brokenLinks?: number;
    planName?: string;
    [key: string]: any;
  };
}

/**
 * Create a new notification
 */
export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Notification['metadata']
): Promise<void> => {
  try {
    console.log('📢 Creating notification:', { type, title, userId });
    
    const docRef = await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
      metadata: metadata || {}
    });
    
    console.log('✅ Notification created successfully:', docRef.id);
  } catch (error: any) {
    console.error('❌ Error creating notification:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'permission-denied') {
      console.error('🔒 PERMISSION DENIED: Firestore rules need to be configured!');
      console.error('👉 See FIRESTORE_RULES_SETUP.md for instructions');
    }
  }
};

/**
 * Helper functions for specific notification types
 */

export const notifyChannelAdded = async (userId: string, channelName: string, channelId: string) => {
  await createNotification(
    userId,
    'channel_added',
    'Channel Added',
    `Successfully connected "${channelName}" to your account.`,
    { channelId, channelName }
  );
};

export const notifyChannelRemoved = async (userId: string, channelName: string) => {
  await createNotification(
    userId,
    'channel_removed',
    'Channel Removed',
    `"${channelName}" has been removed from your account.`,
    { channelName }
  );
};

export const notifyScanCompleted = async (
  userId: string,
  channelName: string,
  videoCount: number,
  brokenLinks: number,
  channelId: string
) => {
  await createNotification(
    userId,
    'scan_completed',
    'Scan Completed',
    `Scanned ${videoCount} videos in "${channelName}". Found ${brokenLinks} broken link${brokenLinks !== 1 ? 's' : ''}.`,
    { channelId, channelName, videoCount, brokenLinks }
  );
};

export const notifyExtractCompleted = async (
  userId: string,
  channelName: string,
  videoCount: number,
  channelId: string
) => {
  await createNotification(
    userId,
    'extract_completed',
    'Extraction Completed',
    `Successfully extracted ${videoCount} video${videoCount !== 1 ? 's' : ''} from "${channelName}".`,
    { channelId, channelName, videoCount }
  );
};

export const notifyBulkScanCompleted = async (
  userId: string,
  videoCount: number,
  brokenLinks: number
) => {
  await createNotification(
    userId,
    'bulk_scan_completed',
    'Bulk Scan Completed',
    `Scanned ${videoCount} video${videoCount !== 1 ? 's' : ''}. Found ${brokenLinks} broken link${brokenLinks !== 1 ? 's' : ''}.`,
    { videoCount, brokenLinks }
  );
};

/**
 * Auto-Scan notification helpers
 */

export const notifyAutoScanStarted = async (
  userId: string,
  channelName: string,
  channelId: string,
  videoCount: number
) => {
  await createNotification(
    userId,
    'auto_scan_started',
    '🔄 Auto-Scan Started',
    `Auto-scan has started for "${channelName}". Scanning ${videoCount} videos for broken links.`,
    { channelId, channelName, videoCount }
  );
};

export const notifyAutoScanCompleted = async (
  userId: string,
  channelName: string,
  channelId: string,
  videoCount: number,
  brokenLinks: number,
  totalLinks: number
) => {
  const status = brokenLinks === 0 
    ? '✅ All links are working!' 
    : `⚠️ Found ${brokenLinks} broken link${brokenLinks !== 1 ? 's' : ''}`;
  
  await createNotification(
    userId,
    'auto_scan_completed',
    '✨ Auto-Scan Completed',
    `Auto-scan completed for "${channelName}". Scanned ${videoCount} videos with ${totalLinks} links. ${status}`,
    { channelId, channelName, videoCount, brokenLinks, totalLinks }
  );
};

export const notifyUserLogin = async (userId: string, userName: string) => {
  await createNotification(
    userId,
    'user_login',
    'Welcome Back!',
    `Hello ${userName}, you've successfully logged in.`,
    {}
  );
};

export const notifyPlanUpgraded = async (userId: string, planName: string) => {
  await createNotification(
    userId,
    'plan_upgraded',
    'Plan Upgraded',
    `Your account has been upgraded to ${planName}. Enjoy your new features!`,
    { planName }
  );
};

export const notifySessionDeleted = async (
  userId: string,
  sessionName: string,
  sessionId: string,
  videoCount: number
) => {
  await createNotification(
    userId,
    'session_deleted',
    'Session Deleted',
    `The session "${sessionName}" has been deleted successfully.`,
    { sessionId, sessionName, videoCount }
  );
};

/**
 * Withdrawal notification helpers
 */

export const notifyWithdrawalRequested = async (
  userId: string,
  amount: number,
  method: string,
  withdrawalId: string
) => {
  const methodLabel = method === 'paypal' ? 'PayPal' : method === 'upi' ? 'UPI' : 'Bank Transfer';
  await createNotification(
    userId,
    'withdrawal_requested',
    'Withdrawal Request Submitted',
    `Your withdrawal request for $${amount.toFixed(2)} via ${methodLabel} has been submitted and is being processed.`,
    { amount, method, withdrawalId }
  );
};

export const notifyWithdrawalCompleted = async (
  userId: string,
  amount: number,
  method: string,
  withdrawalId: string
) => {
  const methodLabel = method === 'paypal' ? 'PayPal' : method === 'upi' ? 'UPI' : 'Bank Transfer';
  await createNotification(
    userId,
    'withdrawal_completed',
    'Withdrawal Completed! 🎉',
    `Your withdrawal of $${amount.toFixed(2)} via ${methodLabel} has been successfully processed. The funds should arrive in your account shortly.`,
    { amount, method, withdrawalId }
  );
};

export const notifyWithdrawalRejected = async (
  userId: string,
  amount: number,
  method: string,
  withdrawalId: string,
  reason?: string
) => {
  const methodLabel = method === 'paypal' ? 'PayPal' : method === 'upi' ? 'UPI' : 'Bank Transfer';
  const reasonText = reason ? ` Reason: ${reason}` : '';
  await createNotification(
    userId,
    'withdrawal_rejected',
    'Withdrawal Rejected',
    `Your withdrawal request for $${amount.toFixed(2)} via ${methodLabel} has been rejected.${reasonText} The amount has been returned to your available balance.`,
    { amount, method, withdrawalId, reason }
  );
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const batch = writeBatch(db);
    const snapshot = await getDocs(q);
    
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

/**
 * Subscribe to real-time notifications
 */
export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[], added: Notification[], meta: { fromCache: boolean }) => void,
  onError?: (error: any) => void,
  limitCount: number = 50
) => {
  const notificationsRef = collection(db, 'notifications');
  const primary = query(
    notificationsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  let unsubscribe: (() => void) | undefined;

  const startPrimary = () => {
    unsubscribe = onSnapshot(
      primary,
      { includeMetadataChanges: true },
      (snapshot) => {
        const notifications: Notification[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as any)
        } as Notification));

        const added: Notification[] = snapshot
          .docChanges()
          .filter((c) => c.type === 'added')
          .map((c) => ({ id: c.doc.id, ...(c.doc.data() as any) } as Notification));

        callback(notifications, added, { fromCache: snapshot.metadata.fromCache });
      },
      (error) => {
        const msg = String(error?.message || '').toLowerCase();
        const code = String((error as any)?.code || '');
        if (code === 'failed-precondition' || msg.includes('requires an index')) {
          if (unsubscribe) unsubscribe();
          startFallback();
        } else {
          if (onError) onError(error);
        }
      }
    );
  };

  const startFallback = () => {
    const fallback = query(
      notificationsRef,
      where('userId', '==', userId),
      limit(limitCount)
    );
    unsubscribe = onSnapshot(
      fallback,
      { includeMetadataChanges: true },
      (snapshot) => {
        const notifications: Notification[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as any)
        } as Notification));
        const added: Notification[] = snapshot
          .docChanges()
          .filter((c) => c.type === 'added')
          .map((c) => ({ id: c.doc.id, ...(c.doc.data() as any) } as Notification));
        callback(notifications, added, { fromCache: snapshot.metadata.fromCache });
      },
      (error) => {
        if (onError) onError(error);
      }
    );
  };

  startPrimary();
  return () => {
    if (unsubscribe) unsubscribe();
  };
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};

export const pruneOldNotifications = async (userId: string, keep: number = 10): Promise<string[]> => {
  try {
    const baseRef = collection(db, 'notifications');
    const baseQ = query(baseRef, where('userId', '==', userId));
    const countSnap = await getCountFromServer(baseQ);
    const total = (countSnap.data().count as number) || 0;
    const extras = total - keep;
    if (extras <= 0) return [];

    try {
      const ascQ = query(baseRef, where('userId', '==', userId), orderBy('createdAt', 'asc'), limit(extras));
      const snap = await getDocs(ascQ);
      const batch = writeBatch(db);
      const ids: string[] = [];
      snap.forEach((d) => {
        batch.delete(d.ref);
        ids.push(d.id);
      });
      await batch.commit();
      return ids;
    } catch (error: any) {
      const msg = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '');
      if (code === 'failed-precondition' || msg.includes('requires an index')) {
        const allSnap = await getDocs(baseQ);
        const docs = allSnap.docs.map((d) => ({ id: d.id, data: d.data() as any, ref: d.ref }));
        const toMillis = (v: any): number => {
          try {
            if (!v) return 0;
            if (typeof v === 'string') {
              const t = Date.parse(v);
              return isNaN(t) ? 0 : t;
            }
            if (v?.toMillis) return v.toMillis();
            if (v instanceof Date) return v.getTime();
            return 0;
          } catch {
            return 0;
          }
        };
        docs.sort((a, b) => toMillis(a.data.createdAt) - toMillis(b.data.createdAt));
        const targets = docs.slice(0, extras);
        const batch = writeBatch(db);
        const ids: string[] = [];
        targets.forEach((d) => {
          batch.delete(d.ref);
          ids.push(d.id);
        });
        await batch.commit();
        return ids;
      }
      throw error;
    }
  } catch (err) {
    console.error('Error pruning notifications:', err);
    return [];
  }
};

// Import getDocs for batch operations
