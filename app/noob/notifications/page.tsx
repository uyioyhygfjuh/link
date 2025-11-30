"use client";

import { useEffect, useState } from "react";
import { AdminHeader, StatsCard, DataTable, Column } from "@/components/noob";
import {
  Bell,
  Send,
  Users,
  CheckCircle,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  source?: string;
}

interface NotificationStats {
  total: number;
  readCount: number;
  unreadCount: number;
  typeBreakdown: { [key: string]: number };
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Broadcast modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastType, setBroadcastType] = useState("admin_broadcast");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [targetPlan, setTargetPlan] = useState("basic");

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/noob/notifications?limit=200");
      const data = await response.json();
      setNotifications(data.notifications);
      setStats(data.stats);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const sendBroadcast = async () => {
    if (!broadcastTitle || !broadcastMessage) {
      alert("Please fill in title and message");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch("/api/noob/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "broadcast",
          type: broadcastType,
          title: broadcastTitle,
          message: broadcastMessage,
          targetAudience,
          plan: targetPlan,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setShowBroadcastModal(false);
        setBroadcastTitle("");
        setBroadcastMessage("");
        loadNotifications();
      } else {
        alert(data.error || "Failed to send notification");
      }
    } catch (error) {
      console.error("Error sending broadcast:", error);
      alert("Failed to send notification");
    } finally {
      setActionLoading(false);
    }
  };

  const cleanupNotifications = async (action: string) => {
    if (
      !confirm(
        `Are you sure you want to ${action === "cleanup" ? "delete notifications older than 30 days" : "delete all read notifications"}?`
      )
    )
      return;

    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/noob/notifications?action=${action}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        loadNotifications();
      }
    } catch (error) {
      console.error("Error cleaning up notifications:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteNotification = async (id: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/noob/notifications?action=single&id=${id}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json();
      if (data.success) {
        loadNotifications();
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const notificationTypes: { [key: string]: { label: string; color: string } } = {
    admin_broadcast: { label: "Broadcast", color: "purple" },
    admin_message: { label: "Admin", color: "blue" },
    scan_complete: { label: "Scan", color: "green" },
    login: { label: "Login", color: "gray" },
    subscription: { label: "Subscription", color: "yellow" },
    referral: { label: "Referral", color: "pink" },
    withdrawal: { label: "Withdrawal", color: "orange" },
  };

  const columns: Column<Notification>[] = [
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (value) => {
        const typeInfo = notificationTypes[value] || {
          label: value,
          color: "gray",
        };
        return (
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full bg-${typeInfo.color}-100 text-${typeInfo.color}-800`}
          >
            {typeInfo.label}
          </span>
        );
      },
    },
    {
      key: "title",
      header: "Title",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-gray-900">{value}</span>
      ),
    },
    {
      key: "message",
      header: "Message",
      render: (value) => (
        <span className="text-gray-600 truncate max-w-xs block">{value}</span>
      ),
    },
    {
      key: "read",
      header: "Status",
      render: (value) =>
        value ? (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            Read
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            Unread
          </span>
        ),
    },
    {
      key: "createdAt",
      header: "Date",
      sortable: true,
      render: (value) =>
        value ? new Date(value).toLocaleString() : "-",
    },
    {
      key: "id",
      header: "Actions",
      render: (value) => (
        <button
          onClick={() => deleteNotification(value)}
          disabled={actionLoading}
          className="p-1.5 hover:bg-red-100 rounded transition-colors"
          title="Delete notification"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Notifications"
        subtitle="Manage system notifications"
        onRefresh={loadNotifications}
        loading={loading}
      />

      <div className="p-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <StatsCard
              title="Total Notifications"
              value={stats.total}
              icon={<Bell className="w-6 h-6" />}
              color="blue"
            />
            <StatsCard
              title="Unread"
              value={stats.unreadCount}
              icon={<AlertCircle className="w-6 h-6" />}
              color={stats.unreadCount > 0 ? "yellow" : "gray"}
            />
            <StatsCard
              title="Read"
              value={stats.readCount}
              icon={<CheckCircle className="w-6 h-6" />}
              color="green"
            />
            <StatsCard
              title="Read Rate"
              value={`${stats.total > 0 ? Math.round((stats.readCount / stats.total) * 100) : 0}%`}
              icon={<Users className="w-6 h-6" />}
              color="purple"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setShowBroadcastModal(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>Send Broadcast</span>
            </button>
            <button
              onClick={() => cleanupNotifications("cleanup")}
              disabled={actionLoading}
              className="btn-secondary flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Old (30+ days)</span>
            </button>
            <button
              onClick={() => cleanupNotifications("all_read")}
              disabled={actionLoading}
              className="btn-secondary flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All Read</span>
            </button>
          </div>
        </div>

        {/* Type Breakdown */}
        {stats && Object.keys(stats.typeBreakdown).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              Notifications by Type
            </h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.typeBreakdown).map(([type, count]) => {
                const typeInfo = notificationTypes[type] || {
                  label: type,
                  color: "gray",
                };
                return (
                  <div
                    key={type}
                    className="flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full bg-${typeInfo.color}-100 text-${typeInfo.color}-800`}
                    >
                      {typeInfo.label}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notifications Table */}
        <DataTable
          columns={columns}
          data={notifications}
          loading={loading}
          searchable
          searchPlaceholder="Search notifications..."
          pageSize={25}
          exportable
          emptyMessage="No notifications found"
        />
      </div>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Send Broadcast Notification
              </h2>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="all">All Users</option>
                  <option value="trial">Trial Users</option>
                  <option value="active">Active Subscribers</option>
                  <option value="admins">Admins Only</option>
                  <option value="plan">Specific Plan</option>
                </select>
              </div>

              {targetAudience === "plan" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Plan
                  </label>
                  <select
                    value={targetPlan}
                    onChange={(e) => setTargetPlan(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Type
                </label>
                <select
                  value={broadcastType}
                  onChange={(e) => setBroadcastType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="admin_broadcast">Broadcast</option>
                  <option value="admin_message">Admin Message</option>
                  <option value="subscription">Subscription Update</option>
                  <option value="referral">Referral Update</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Notification title"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Notification message"
                  rows={4}
                  className="input-field resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={sendBroadcast}
                disabled={actionLoading || !broadcastTitle || !broadcastMessage}
                className="btn-primary flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>{actionLoading ? "Sending..." : "Send Notification"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
