'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Bell, Check, X, Trash2, CheckCheck } from 'lucide-react';
import { 
  Notification, 
  subscribeToNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  pruneOldNotifications 
} from '@/lib/notifications';

interface NotificationBellProps {
  user: User | null;
}

export default function NotificationBell({ user }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toMillis = (value: any): number => {
    try {
      if (!value) return 0;
      if (typeof value === 'string') {
        const t = Date.parse(value);
        return isNaN(t) ? 0 : t;
      }
      if (value?.toMillis) return value.toMillis();
      if (value instanceof Date) return value.getTime();
      return 0;
    } catch {
      return 0;
    }
  };

  const toDate = (value: any): Date => {
    try {
      if (!value) return new Date();
      if (typeof value === 'string') return new Date(value);
      if (value?.toDate) return value.toDate();
      if (value instanceof Date) return value;
      return new Date();
    } catch {
      return new Date();
    }
  };

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToNotifications(
      user.uid,
      (snapshotNotifications, added, meta) => {
        setOffline(meta.fromCache && typeof navigator !== 'undefined' ? !navigator.onLine : false);

        setNotifications((prev) => {
          const byId = new Map<string, Notification>();
          prev.forEach((n) => {
            if (n.id) byId.set(n.id, n);
          });
          snapshotNotifications.forEach((n) => {
            if (n.id) byId.set(n.id, n);
          });
          const merged = Array.from(byId.values()).sort((a, b) => toMillis(b.createdAt as any) - toMillis(a.createdAt as any));
          return merged.slice(0, 10);
        });

        setUnreadCount((curr) => {
          const count = snapshotNotifications.filter((n) => !n.read).length;
          return count;
        });

        if (!meta.fromCache) setLoading(false);
        if (!meta.fromCache && added && added.length > 0 && user) {
          void pruneOldNotifications(user.uid, 10);
        }
      },
      (err) => {
        const msg = String(err?.message || '');
        const friendly = (err?.code === 'failed-precondition') || msg.toLowerCase().includes('requires an index')
          ? 'Missing Firestore index; using fallback mode.'
          : (err?.message || 'Failed to subscribe to notifications');
        setError(friendly);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read && notification.id) {
      await markNotificationAsRead(notification.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await markAllNotificationsAsRead(user.uid);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'channel_added':
        return '📺';
      case 'channel_removed':
        return '🗑️';
      case 'scan_completed':
        return '✅';
      case 'extract_completed':
        return '📥';
      case 'bulk_scan_completed':
        return '⚡';
      case 'user_login':
        return '👋';
      case 'plan_upgraded':
        return '🎉';
      default:
        return '🔔';
    }
  };

  const formatTime = (timestamp: any) => {
    try {
      const date = toDate(timestamp);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
      return `${Math.floor(diffInSeconds / 604800)}w ago`;
    } catch {
      return 'Recently';
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Loading notifications…</p>
              </div>
            )}
            {!loading && error && (
              <div className="p-4 text-center text-red-600 text-sm">{error}</div>
            )}
            {!loading && !error && notifications.length === 0 && (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No notifications yet</p>
                <p className="text-gray-400 text-xs mt-1">We'll notify you when something happens</p>
              </div>
            )}
            {!loading && !error && notifications.length > 0 && (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <p className={`text-sm font-semibold ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 ml-2 mt-1"></span>
                          )}
                        </div>
                        <p className={`text-sm mt-1 ${
                          !notification.read ? 'text-gray-700' : 'text-gray-500'
                        }`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <p className="text-xs text-center text-gray-500">
                Showing {notifications.length} most recent notification{notifications.length !== 1 ? 's' : ''}
              </p>
              {offline && (
                <p className="text-xs text-center text-yellow-600 mt-1">Offline mode. Showing cached data.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
