"use client";

import { useEffect, useState } from "react";
import { AdminHeader, StatsCard, DataTable, Column } from "@/components/noob";
import {
  CreditCard,
  Clock,
  AlertTriangle,
  Users,
  TrendingUp,
  Calendar,
  X,
} from "lucide-react";

interface SubscriptionUser {
  id: string;
  fullName: string;
  email: string;
  plan: string;
  planStatus: string;
  trialEnd?: string;
  renewalDate?: string;
  subscriptionPeriod: string;
  createdAt: string;
  daysRemaining?: number;
}

interface SubscriptionStats {
  totalActive: number;
  totalTrial: number;
  totalTrialsExpiringSoon: number;
  planDistribution: {
    trial: number;
    basic: number;
    pro: number;
    enterprise: number;
  };
}

export default function SubscriptionsPage() {
  const [activeSubscriptions, setActiveSubscriptions] = useState<SubscriptionUser[]>([]);
  const [trialUsers, setTrialUsers] = useState<SubscriptionUser[]>([]);
  const [trialsExpiringSoon, setTrialsExpiringSoon] = useState<SubscriptionUser[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "trial" | "expiring">("active");

  // Modal states
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [extendDays, setExtendDays] = useState(7);
  const [actionLoading, setActionLoading] = useState(false);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/noob/subscriptions");
      const data = await response.json();
      setActiveSubscriptions(data.activeSubscriptions);
      setTrialUsers(data.trialUsers);
      setTrialsExpiringSoon(data.trialsExpiringSoon);
      setStats(data.stats);
    } catch (error) {
      console.error("Error loading subscriptions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const handleExtendTrials = async () => {
    if (selectedUsers.length === 0) return;
    
    setActionLoading(true);
    try {
      const response = await fetch("/api/noob/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_extend_trials",
          userId: selectedUsers[0], // Dummy, we use actionData.userIds
          data: {
            userIds: selectedUsers,
            days: extendDays,
          },
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setShowExtendModal(false);
        setSelectedUsers([]);
        loadSubscriptions();
      }
    } catch (error) {
      console.error("Error extending trials:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleAction = async (userId: string, action: string, actionData: any) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/noob/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userId,
          data: actionData,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        loadSubscriptions();
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const activeColumns: Column<SubscriptionUser>[] = [
    {
      key: "fullName",
      header: "User",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      sortable: true,
      render: (value) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            value.toLowerCase().includes("enterprise")
              ? "bg-purple-100 text-purple-800"
              : value.toLowerCase().includes("pro")
                ? "bg-blue-100 text-blue-800"
                : "bg-green-100 text-green-800"
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: "subscriptionPeriod",
      header: "Period",
      render: (value) => (
        <span className="capitalize">{value || "monthly"}</span>
      ),
    },
    {
      key: "renewalDate",
      header: "Renewal Date",
      sortable: true,
      render: (value) =>
        value ? new Date(value).toLocaleDateString() : "-",
    },
    {
      key: "id",
      header: "Actions",
      render: (value, row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() =>
              handleSingleAction(value, "extend", { days: 30 })
            }
            className="text-xs text-primary-600 hover:underline"
          >
            +30 days
          </button>
          <button
            onClick={() => handleSingleAction(value, "cancel", {})}
            className="text-xs text-red-600 hover:underline"
          >
            Cancel
          </button>
        </div>
      ),
    },
  ];

  const trialColumns: Column<SubscriptionUser>[] = [
    {
      key: "fullName",
      header: "User",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={selectedUsers.includes(row.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedUsers([...selectedUsers, row.id]);
              } else {
                setSelectedUsers(selectedUsers.filter((id) => id !== row.id));
              }
            }}
            className="w-4 h-4 rounded border-gray-300"
          />
          <div>
            <p className="font-medium text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "trialEnd",
      header: "Trial Ends",
      sortable: true,
      render: (value) =>
        value ? new Date(value).toLocaleDateString() : "-",
    },
    {
      key: "createdAt",
      header: "Signed Up",
      sortable: true,
      render: (value) =>
        value ? new Date(value).toLocaleDateString() : "-",
    },
    {
      key: "id",
      header: "Actions",
      render: (value) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleSingleAction(value, "extend", { days: 7 })}
            className="text-xs text-primary-600 hover:underline"
          >
            +7 days
          </button>
          <button
            onClick={() => handleSingleAction(value, "extend", { days: 14 })}
            className="text-xs text-primary-600 hover:underline"
          >
            +14 days
          </button>
        </div>
      ),
    },
  ];

  const expiringColumns: Column<SubscriptionUser>[] = [
    {
      key: "fullName",
      header: "User",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={selectedUsers.includes(row.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedUsers([...selectedUsers, row.id]);
              } else {
                setSelectedUsers(selectedUsers.filter((id) => id !== row.id));
              }
            }}
            className="w-4 h-4 rounded border-gray-300"
          />
          <div>
            <p className="font-medium text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "daysRemaining",
      header: "Days Left",
      sortable: true,
      render: (value) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            value <= 1
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {value} day{value !== 1 ? "s" : ""}
        </span>
      ),
    },
    {
      key: "trialEnd",
      header: "Expires",
      sortable: true,
      render: (value) =>
        value ? new Date(value).toLocaleDateString() : "-",
    },
    {
      key: "id",
      header: "Actions",
      render: (value) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleSingleAction(value, "extend", { days: 7 })}
            className="text-xs text-primary-600 hover:underline"
          >
            +7 days
          </button>
          <button
            onClick={() => handleSingleAction(value, "extend", { days: 14 })}
            className="text-xs text-primary-600 hover:underline"
          >
            +14 days
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Subscriptions"
        subtitle="Manage user subscriptions and trials"
        onRefresh={loadSubscriptions}
        loading={loading}
      />

      <div className="p-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatsCard
              title="Active Subscriptions"
              value={stats.totalActive}
              icon={<CreditCard className="w-6 h-6" />}
              color="green"
            />
            <StatsCard
              title="Trial Users"
              value={stats.totalTrial}
              icon={<Clock className="w-6 h-6" />}
              color="yellow"
            />
            <StatsCard
              title="Expiring Soon"
              value={stats.totalTrialsExpiringSoon}
              icon={<AlertTriangle className="w-6 h-6" />}
              color={stats.totalTrialsExpiringSoon > 0 ? "red" : "gray"}
              subtitle="Within 3 days"
            />
            <StatsCard
              title="Plan Distribution"
              value={`${stats.planDistribution.basic}/${stats.planDistribution.pro}/${stats.planDistribution.enterprise}`}
              icon={<TrendingUp className="w-6 h-6" />}
              color="purple"
              subtitle="Basic / Pro / Enterprise"
            />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => {
                  setActiveTab("active");
                  setSelectedUsers([]);
                }}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "active"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Active Subscriptions ({activeSubscriptions.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab("trial");
                  setSelectedUsers([]);
                }}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "trial"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Trial Users ({trialUsers.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab("expiring");
                  setSelectedUsers([]);
                }}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "expiring"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Expiring Soon ({trialsExpiringSoon.length})
                {trialsExpiringSoon.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                    !
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {(activeTab === "trial" || activeTab === "expiring") &&
            selectedUsers.length > 0 && (
              <div className="bg-primary-50 px-6 py-3 flex items-center justify-between">
                <span className="text-sm text-primary-700">
                  {selectedUsers.length} user
                  {selectedUsers.length > 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowExtendModal(true)}
                    className="btn-primary text-sm"
                  >
                    Extend Trials
                  </button>
                  <button
                    onClick={() => setSelectedUsers([])}
                    className="btn-secondary text-sm"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

          {/* Table Content */}
          <div className="p-0">
            {activeTab === "active" && (
              <DataTable
                columns={activeColumns}
                data={activeSubscriptions}
                loading={loading}
                pageSize={25}
                exportable
                emptyMessage="No active subscriptions"
              />
            )}
            {activeTab === "trial" && (
              <DataTable
                columns={trialColumns}
                data={trialUsers}
                loading={loading}
                pageSize={25}
                exportable
                emptyMessage="No trial users"
              />
            )}
            {activeTab === "expiring" && (
              <DataTable
                columns={expiringColumns}
                data={trialsExpiringSoon}
                loading={loading}
                pageSize={25}
                exportable
                emptyMessage="No trials expiring soon"
              />
            )}
          </div>
        </div>
      </div>

      {/* Bulk Extend Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Extend Trials
              </h2>
              <button
                onClick={() => setShowExtendModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Extend trial period for {selectedUsers.length} user
              {selectedUsers.length > 1 ? "s" : ""}.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Days to extend
              </label>
              <select
                value={extendDays}
                onChange={(e) => setExtendDays(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowExtendModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleExtendTrials}
                disabled={actionLoading}
                className="btn-primary"
              >
                {actionLoading ? "Extending..." : "Extend Trials"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
