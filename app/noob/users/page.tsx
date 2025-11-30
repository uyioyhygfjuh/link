"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminHeader, DataTable, Column } from "@/components/noob";
import {
  User,
  Shield,
  Mail,
  Calendar,
  CreditCard,
  X,
  Check,
  Trash2,
  Edit,
  Eye,
  Clock,
  RefreshCw,
  Bell,
  Send,
  Users,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
} from "lucide-react";

interface UserData {
  id: string;
  fullName: string;
  email: string;
  photoURL?: string;
  plan: string;
  planStatus: string;
  trialEnd?: string;
  renewalDate?: string;
  isAdmin: boolean;
  createdAt: string;
}

interface UserDetails {
  user: UserData & {
    planId?: string;
    subscriptionPeriod?: string;
    trialStart?: string;
    emailAlerts?: boolean;
    weeklyReports?: boolean;
    scansUsed?: number;
    videosScannedToday?: number;
    lastScanDate?: string;
    lastLogin?: string;
  };
  referral: {
    referralCode: string;
    referredBy?: string;
    referredByName?: string;
    referralCount: number;
    totalEarnings: number;
    availableBalance: number;
    pendingBalance?: number;
    totalWithdrawn?: number;
  } | null;
  stats: {
    channelsCount: number;
    sessionsCount: number;
    paymentsCount: number;
  };
  payments: any[];
}

interface EditFormData {
  fullName: string;
  email: string;
  plan: string;
  planId: string;
  planStatus: string;
  subscriptionPeriod: string;
  trialEnd: string;
  renewalDate: string;
  isAdmin: boolean;
  emailAlerts: boolean;
  weeklyReports: boolean;
  scansUsed: number;
  // Referral fields
  referralCount: number;
  totalEarnings: number;
  availableBalance: number;
}

interface PlanOption {
  id: string;
  name: string;
}

export default function UsersPage() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState<EditFormData>({
    fullName: "",
    email: "",
    plan: "Free Trial",
    planId: "",
    planStatus: "Trial",
    subscriptionPeriod: "monthly",
    trialEnd: "",
    renewalDate: "",
    isAdmin: false,
    emailAlerts: false,
    weeklyReports: false,
    scansUsed: 0,
    referralCount: 0,
    totalEarnings: 0,
    availableBalance: 0,
  });
  
  // Available plans from Firestore
  const [availablePlans, setAvailablePlans] = useState<PlanOption[]>([]);

  // Notification modal state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    message: "",
    type: "info" as "info" | "success" | "warning" | "error",
    targetAudience: "specific" as "all" | "trial" | "active" | "admins" | "specific",
  });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [notificationSending, setNotificationSending] = useState(false);

  // Send notification to selected users
  const sendNotification = async () => {
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      alert("Please fill in both title and message");
      return;
    }

    if (notificationForm.targetAudience === "specific" && selectedUserIds.length === 0) {
      alert("Please select at least one user");
      return;
    }

    setNotificationSending(true);
    try {
      const response = await fetch("/api/noob/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "broadcast",
          title: notificationForm.title,
          message: notificationForm.message,
          type: notificationForm.type,
          targetAudience: notificationForm.targetAudience,
          userIds: notificationForm.targetAudience === "specific" ? selectedUserIds : undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`Notification sent successfully to ${data.sentCount} user(s)`);
        setShowNotificationModal(false);
        setNotificationForm({
          title: "",
          message: "",
          type: "info",
          targetAudience: "specific",
        });
        setSelectedUserIds([]);
      } else {
        alert(data.error || "Failed to send notification");
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      alert("Failed to send notification");
    } finally {
      setNotificationSending(false);
    }
  };

  // Send notification to a single user
  const sendSingleNotification = async (userId: string, userName: string) => {
    const title = prompt("Notification Title:", "Important Update");
    if (!title) return;

    const message = prompt("Notification Message:", `Hello ${userName}, `);
    if (!message) return;

    const typeChoice = prompt("Notification Type (info/success/warning/error):", "info");
    const type = ["info", "success", "warning", "error"].includes(typeChoice || "") 
      ? typeChoice as "info" | "success" | "warning" | "error"
      : "info";

    try {
      const response = await fetch("/api/noob/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_single",
          userId,
          title,
          message,
          type,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert("Notification sent successfully!");
      } else {
        alert(data.error || "Failed to send notification");
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      alert("Failed to send notification");
    }
  };

  // Toggle user selection for bulk notifications
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Select all visible users
  const selectAllUsers = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u.id));
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        plan: planFilter,
        status: statusFilter,
        search,
      });
      
      const response = await fetch(`/api/noob/users?${params}`);
      const data = await response.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available plans from Firestore
  const loadPlans = async () => {
    try {
      const response = await fetch("/api/noob/plans");
      const data = await response.json();
      if (data.plans) {
        const planOptions = data.plans.map((p: any) => ({
          id: p.id,
          name: p.name,
        }));
        // Add Free Trial option
        setAvailablePlans([
          { id: "", name: "Free Trial" },
          { id: "free", name: "Free" },
          ...planOptions,
        ]);
      }
    } catch (error) {
      console.error("Error loading plans:", error);
      // Fallback to default plans
      setAvailablePlans([
        { id: "", name: "Free Trial" },
        { id: "free", name: "Free" },
        { id: "starter", name: "Starter" },
        { id: "professional", name: "Professional" },
        { id: "enterprise", name: "Enterprise" },
      ]);
    }
  };

  useEffect(() => {
    loadUsers();
    loadPlans();
  }, [page, pageSize, planFilter, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    loadUsers();
  };

  const viewUser = async (user: UserData) => {
    try {
      const response = await fetch(`/api/noob/users/${user.id}`);
      const data = await response.json();
      setSelectedUser(data);
      setShowUserModal(true);
    } catch (error) {
      console.error("Error loading user details:", error);
    }
  };

  const toggleAdmin = async (userId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/noob/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_admin" }),
      });
      const data = await response.json();
      if (data.success) {
        loadUsers();
        if (selectedUser) {
          setSelectedUser({
            ...selectedUser,
            user: { ...selectedUser.user, isAdmin: data.isAdmin },
          });
        }
      }
    } catch (error) {
      console.error("Error toggling admin:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const extendTrial = async (userId: string, days: number) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/noob/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extend_trial",
          updates: { daysToExtend: days },
        }),
      });
      const data = await response.json();
      if (data.success) {
        loadUsers();
        alert(data.message);
      }
    } catch (error) {
      console.error("Error extending trial:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/noob/users/${userId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        setShowDeleteModal(false);
        setShowUserModal(false);
        setSelectedUser(null);
        loadUsers();
        alert("User deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (user: UserDetails) => {
    setEditForm({
      fullName: user.user.fullName || "",
      email: user.user.email || "",
      plan: user.user.plan || "Free Trial",
      planId: user.user.planId || "",
      planStatus: user.user.planStatus || "Trial",
      subscriptionPeriod: user.user.subscriptionPeriod || "monthly",
      trialEnd: user.user.trialEnd ? user.user.trialEnd.split("T")[0] : "",
      renewalDate: user.user.renewalDate ? user.user.renewalDate.split("T")[0] : "",
      isAdmin: user.user.isAdmin || false,
      emailAlerts: user.user.emailAlerts || false,
      weeklyReports: user.user.weeklyReports || false,
      scansUsed: user.user.scansUsed || 0,
      referralCount: user.referral?.referralCount || 0,
      totalEarnings: user.referral?.totalEarnings || 0,
      availableBalance: user.referral?.availableBalance || 0,
    });
    setShowEditModal(true);
  };

  const saveUser = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      const updates: any = {
        fullName: editForm.fullName,
        displayName: editForm.fullName,
        email: editForm.email,
        plan: editForm.plan,
        planId: editForm.planId,
        planStatus: editForm.planStatus,
        subscriptionPeriod: editForm.subscriptionPeriod,
        isAdmin: editForm.isAdmin,
        emailAlerts: editForm.emailAlerts,
        weeklyReports: editForm.weeklyReports,
        scansUsed: editForm.scansUsed,
      };

      // Add dates if provided
      if (editForm.trialEnd) {
        updates.trialEnd = new Date(editForm.trialEnd).toISOString();
      }
      if (editForm.renewalDate) {
        updates.renewalDate = new Date(editForm.renewalDate).toISOString();
      }

      // Add referral updates
      if (selectedUser.referral) {
        updates.referralCount = editForm.referralCount;
        updates.totalEarnings = editForm.totalEarnings;
        updates.availableBalance = editForm.availableBalance;
      }

      const response = await fetch(`/api/noob/users/${selectedUser.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const data = await response.json();
      if (data.success) {
        alert("User updated successfully");
        setShowEditModal(false);
        // Refresh user details
        const userResponse = await fetch(`/api/noob/users/${selectedUser.user.id}`);
        const userData = await userResponse.json();
        setSelectedUser(userData);
        loadUsers();
      } else {
        alert(data.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Failed to update user");
    } finally {
      setActionLoading(false);
    }
  };

  const columns: Column<UserData>[] = [
    {
      key: "fullName",
      header: "User",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
            {row.photoURL ? (
              <img
                src={row.photoURL}
                alt={value}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-4 h-4 text-gray-500" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      sortable: true,
      render: (value, row) => (
        <div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              value.toLowerCase().includes("enterprise")
                ? "bg-purple-100 text-purple-800"
                : value.toLowerCase().includes("pro")
                  ? "bg-blue-100 text-blue-800"
                  : value.toLowerCase().includes("basic")
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
            }`}
          >
            {value}
          </span>
        </div>
      ),
    },
    {
      key: "planStatus",
      header: "Status",
      sortable: true,
      render: (value) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            value === "Active"
              ? "bg-green-100 text-green-800"
              : value === "Trial"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: "isAdmin",
      header: "Admin",
      render: (value) =>
        value ? (
          <Shield className="w-5 h-5 text-primary-600" />
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: "createdAt",
      header: "Joined",
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
            onClick={(e) => {
              e.stopPropagation();
              viewUser(row);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="View details"
          >
            <Eye className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              sendSingleNotification(row.id, row.fullName);
            }}
            className="p-1 hover:bg-blue-100 rounded"
            title="Send notification"
          >
            <Bell className="w-4 h-4 text-blue-600" />
          </button>
          <input
            type="checkbox"
            checked={selectedUserIds.includes(row.id)}
            onChange={(e) => {
              e.stopPropagation();
              toggleUserSelection(row.id);
            }}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
            title="Select for bulk action"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Users"
        subtitle={`${total} total users`}
        onRefresh={loadUsers}
        loading={loading}
      />

      <div className="p-6">
        {/* Bulk Actions Bar */}
        {selectedUserIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-medium">
                {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setNotificationForm(prev => ({ ...prev, targetAudience: "specific" }));
                  setShowNotificationModal(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span>Send Notification</span>
              </button>
              <button
                onClick={() => setSelectedUserIds([])}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="input-field"
              />
            </div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="all">All Plans</option>
              <option value="trial">Free Trial</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={handleSearch} className="btn-primary">
              Search
            </button>
            <div className="border-l border-gray-300 h-8 mx-2" />
            <button
              onClick={() => {
                setNotificationForm(prev => ({ ...prev, targetAudience: "all" }));
                setShowNotificationModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Broadcast</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          pageSize={pageSize}
          onRowClick={viewUser}
          exportable
          emptyMessage="No users found"
        />
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                User Details
              </h2>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                  {selectedUser.user.photoURL ? (
                    <img
                      src={selectedUser.user.photoURL}
                      alt={selectedUser.user.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedUser.user.fullName}
                  </h3>
                  <p className="text-gray-500">{selectedUser.user.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        selectedUser.user.plan
                          .toLowerCase()
                          .includes("enterprise")
                          ? "bg-purple-100 text-purple-800"
                          : selectedUser.user.plan
                                .toLowerCase()
                                .includes("pro")
                            ? "bg-blue-100 text-blue-800"
                            : selectedUser.user.plan
                                  .toLowerCase()
                                  .includes("basic")
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {selectedUser.user.plan}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        selectedUser.user.planStatus === "Active"
                          ? "bg-green-100 text-green-800"
                          : selectedUser.user.planStatus === "Trial"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {selectedUser.user.planStatus}
                    </span>
                    {selectedUser.user.isAdmin && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedUser.stats.channelsCount}
                  </p>
                  <p className="text-sm text-gray-500">Channels</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedUser.stats.sessionsCount}
                  </p>
                  <p className="text-sm text-gray-500">Scans</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedUser.stats.paymentsCount}
                  </p>
                  <p className="text-sm text-gray-500">Payments</p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Joined:</span>
                  <span className="text-gray-900">
                    {selectedUser.user.createdAt
                      ? new Date(
                          selectedUser.user.createdAt
                        ).toLocaleDateString()
                      : "-"}
                  </span>
                </div>
                {selectedUser.user.planStatus === "Trial" &&
                  selectedUser.user.trialEnd && (
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Trial ends:</span>
                      <span className="text-gray-900">
                        {new Date(
                          selectedUser.user.trialEnd
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                {selectedUser.user.renewalDate && (
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Renewal:</span>
                    <span className="text-gray-900">
                      {new Date(
                        selectedUser.user.renewalDate
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Referral Info */}
              {selectedUser.referral && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Referral Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Code:</span>
                      <span className="ml-2 font-mono text-gray-900">
                        {selectedUser.referral.referralCode}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Referrals:</span>
                      <span className="ml-2 text-gray-900">
                        {selectedUser.referral.referralCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Earnings:</span>
                      <span className="ml-2 text-gray-900">
                        ${selectedUser.referral.totalEarnings.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Available:</span>
                      <span className="ml-2 text-gray-900">
                        ${selectedUser.referral.availableBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openEditModal(selectedUser)}
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit User</span>
                  </button>

                  <button
                    onClick={() => toggleAdmin(selectedUser.user.id)}
                    disabled={actionLoading}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      selectedUser.user.isAdmin
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                    }`}
                  >
                    {selectedUser.user.isAdmin
                      ? "Revoke Admin"
                      : "Grant Admin"}
                  </button>

                  {selectedUser.user.planStatus === "Trial" && (
                    <>
                      <button
                        onClick={() => extendTrial(selectedUser.user.id, 7)}
                        disabled={actionLoading}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                      >
                        +7 Days Trial
                      </button>
                      <button
                        onClick={() => extendTrial(selectedUser.user.id, 14)}
                        disabled={actionLoading}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                      >
                        +14 Days Trial
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    Delete User
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Delete User
            </h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <strong>{selectedUser.user.fullName}</strong>? This action cannot
              be undone and will remove all associated data including channels,
              scans, and referral information.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(selectedUser.user.id)}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-gray-900">
                Edit User
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Profile Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Profile Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) =>
                        setEditForm({ ...editForm, fullName: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Subscription Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Subscription & Plan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plan
                    </label>
                    <select
                      value={editForm.planId}
                      onChange={(e) => {
                        const selectedPlan = availablePlans.find(p => p.id === e.target.value);
                        setEditForm({ 
                          ...editForm, 
                          planId: e.target.value,
                          plan: selectedPlan?.name || "Free Trial"
                        });
                      }}
                      className="input-field"
                    >
                      {availablePlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Current: {editForm.plan} {editForm.planId ? `(ID: ${editForm.planId})` : ""}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={editForm.planStatus}
                      onChange={(e) =>
                        setEditForm({ ...editForm, planStatus: e.target.value })
                      }
                      className="input-field"
                    >
                      <option value="Trial">Trial</option>
                      <option value="Active">Active</option>
                      <option value="Canceled">Canceled</option>
                      <option value="Expired">Expired</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Status is auto-calculated based on dates
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Billing Period
                    </label>
                    <select
                      value={editForm.subscriptionPeriod}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          subscriptionPeriod: e.target.value,
                        })
                      }
                      className="input-field"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trial End Date
                    </label>
                    <input
                      type="date"
                      value={editForm.trialEnd}
                      onChange={(e) =>
                        setEditForm({ ...editForm, trialEnd: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Renewal Date
                    </label>
                    <input
                      type="date"
                      value={editForm.renewalDate}
                      onChange={(e) =>
                        setEditForm({ ...editForm, renewalDate: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scans Used
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.scansUsed}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          scansUsed: parseInt(e.target.value) || 0,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Permissions Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Permissions & Settings
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={editForm.isAdmin}
                      onChange={(e) =>
                        setEditForm({ ...editForm, isAdmin: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">
                      Admin Privileges
                    </span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={editForm.emailAlerts}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          emailAlerts: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Email Alerts</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={editForm.weeklyReports}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          weeklyReports: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Weekly Reports</span>
                  </label>
                </div>
              </div>

              {/* Referral Section */}
              {selectedUser.referral && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                    Referral Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Referral Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.referralCount}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            referralCount: parseInt(e.target.value) || 0,
                          })
                        }
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Earnings ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.totalEarnings}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            totalEarnings: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Available Balance ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.availableBalance}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            availableBalance: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowEditModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveUser}
                disabled={actionLoading}
                className="btn-primary"
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Bell className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Send Notification</h2>
                    <p className="text-sm text-gray-500">
                      {notificationForm.targetAudience === "specific" 
                        ? `To ${selectedUserIds.length} selected user(s)`
                        : "Broadcast to users"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5">
              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience
                </label>
                <select
                  value={notificationForm.targetAudience}
                  onChange={(e) => setNotificationForm(prev => ({
                    ...prev,
                    targetAudience: e.target.value as any
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="specific">Selected Users ({selectedUserIds.length})</option>
                  <option value="all">All Users</option>
                  <option value="trial">Trial Users</option>
                  <option value="active">Active Subscribers</option>
                  <option value="admins">Admins Only</option>
                </select>
              </div>

              {/* Notification Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "info", icon: Info, label: "Info", color: "blue" },
                    { value: "success", icon: CheckCircle, label: "Success", color: "green" },
                    { value: "warning", icon: AlertTriangle, label: "Warning", color: "yellow" },
                    { value: "error", icon: AlertCircle, label: "Error", color: "red" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNotificationForm(prev => ({ ...prev, type: type.value as any }))}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center space-y-1 transition-colors ${
                        notificationForm.type === type.value
                          ? `border-${type.color}-500 bg-${type.color}-50`
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <type.icon className={`w-5 h-5 ${
                        notificationForm.type === type.value ? `text-${type.color}-600` : "text-gray-400"
                      }`} />
                      <span className={`text-xs font-medium ${
                        notificationForm.type === type.value ? `text-${type.color}-700` : "text-gray-500"
                      }`}>
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  placeholder="Enter notification title..."
                  value={notificationForm.title}
                  onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {notificationForm.title.length}/100
                </p>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  placeholder="Enter your notification message..."
                  value={notificationForm.message}
                  onChange={(e) => setNotificationForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {notificationForm.message.length}/500
                </p>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase mb-3">Preview</p>
                <div className={`p-4 rounded-lg border-l-4 ${
                  notificationForm.type === "success" ? "bg-green-50 border-green-500" :
                  notificationForm.type === "warning" ? "bg-yellow-50 border-yellow-500" :
                  notificationForm.type === "error" ? "bg-red-50 border-red-500" :
                  "bg-blue-50 border-blue-500"
                }`}>
                  <p className="font-semibold text-gray-900">
                    {notificationForm.title || "Notification Title"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {notificationForm.message || "Your message will appear here..."}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowNotificationModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendNotification}
                disabled={notificationSending || !notificationForm.title.trim() || !notificationForm.message.trim()}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {notificationSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Notification</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
