"use client";

import { useEffect, useState } from "react";
import { AdminHeader, StatsCard, DataTable, Column } from "@/components/noob";
import {
  Gift,
  DollarSign,
  Users,
  Clock,
  Check,
  X,
  AlertCircle,
  Trophy,
  Eye,
  CreditCard,
  Banknote,
  Mail,
  Smartphone,
  Building,
  User,
  Calendar,
  Hash,
  Settings,
  Percent,
  Save,
} from "lucide-react";

interface Withdrawal {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  amount: number;
  method: "paypal" | "bank" | "upi";
  details: any;
  status: "pending" | "approved" | "completed" | "failed";
  requestDate: string;
  completedDate?: string;
  rejectReason?: string;
}

// Helper function to format withdrawal details based on method
const formatWithdrawalDetails = (method: string, details: any): string => {
  if (!details) return "-";
  
  switch (method) {
    case "paypal":
      return details.email || "-";
    case "upi":
      return details.upiId || "-";
    case "bank":
      if (details.accountName && details.accountNumber) {
        return `${details.accountName} - ****${details.accountNumber.slice(-4)}`;
      }
      return "-";
    default:
      return "-";
  }
};

// Helper function to get method label
const getMethodLabel = (method: string): string => {
  switch (method) {
    case "paypal":
      return "PayPal";
    case "upi":
      return "UPI";
    case "bank":
      return "Bank Transfer";
    default:
      return method;
  }
};

interface ReferralData {
  id: string;
  referralCode: string;
  referralCount: number;
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  totalWithdrawn: number;
  userName: string;
  userEmail: string;
}

interface ReferralTotals {
  totalReferrals: number;
  totalEarnings: number;
  totalPaidOut: number;
  pendingBalance: number;
  totalReferrers: number;
}

interface PendingCommission {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referredUserId: string;
  userName: string;
  planName: string;
  amount: number;
  commission: number;
  subscriptionType: string;
  date: string;
  releaseDate: string;
  isReleasable: boolean;
  daysUntilRelease: number;
}

export default function ReferralsPage() {
  const [withdrawals, setWithdrawals] = useState<{
    pending: Withdrawal[];
    completed: Withdrawal[];
    failed: Withdrawal[];
    all: Withdrawal[];
  }>({ pending: [], completed: [], failed: [], all: [] });
  const [referrals, setReferrals] = useState<ReferralData[]>([]);
  const [totals, setTotals] = useState<ReferralTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "commissions" | "completed" | "leaderboard">("pending");
  const [actionLoading, setActionLoading] = useState(false);
  
  // Pending commissions state
  const [pendingCommissions, setPendingCommissions] = useState<PendingCommission[]>([]);
  const [commissionStats, setCommissionStats] = useState({
    totalPendingAmount: 0,
    releasableAmount: 0,
    totalCount: 0,
    releasableCount: 0,
  });

  // Modal states
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [selectedReferrer, setSelectedReferrer] = useState<ReferralData | null>(null);
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusDescription, setBonusDescription] = useState("");
  
  // Withdrawal details modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);

  // Commission settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [commissionSettings, setCommissionSettings] = useState({
    monthlyRate: 15,
    yearlyRate: 20,
    minWithdrawal: 10,
    pendingDays: 7,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadCommissionSettings = async () => {
    try {
      setSettingsLoading(true);
      const res = await fetch("/api/noob/settings");
      const data = await res.json();
      if (data.success && data.settings?.referralCommission) {
        setCommissionSettings(data.settings.referralCommission);
      }
    } catch (error) {
      console.error("Error loading commission settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveCommissionSettings = async () => {
    try {
      setSettingsSaving(true);
      const res = await fetch("/api/noob/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commissionSettings),
      });
      const data = await res.json();
      if (data.success) {
        alert("Commission settings saved successfully!");
        setShowSettingsModal(false);
      } else {
        alert(data.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving commission settings:", error);
      alert("Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [withdrawalsRes, referralsRes, commissionsRes] = await Promise.all([
        fetch("/api/noob/referrals?type=withdrawals"),
        fetch("/api/noob/referrals"),
        fetch("/api/noob/referrals?type=pending_commissions"),
      ]);

      const withdrawalsData = await withdrawalsRes.json();
      const referralsData = await referralsRes.json();
      const commissionsData = await commissionsRes.json();

      setWithdrawals(withdrawalsData);
      setReferrals(referralsData.referrals);
      setTotals(referralsData.totals);
      setPendingCommissions(commissionsData.pendingCommissions || []);
      setCommissionStats({
        totalPendingAmount: commissionsData.totalPendingAmount || 0,
        releasableAmount: commissionsData.releasableAmount || 0,
        totalCount: commissionsData.totalCount || 0,
        releasableCount: commissionsData.releasableCount || 0,
      });
    } catch (error) {
      console.error("Error loading referral data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadCommissionSettings();
  }, []);

  const handleWithdrawalAction = async (
    referrerId: string,
    withdrawalId: string,
    action: "approve" | "complete" | "reject",
    reason?: string
  ) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/noob/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          referrerId,
          withdrawalId,
          reason,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        loadData();
      }
    } catch (error) {
      console.error("Error processing withdrawal:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddBonus = async () => {
    if (!selectedReferrer || !bonusAmount) return;

    setActionLoading(true);
    try {
      const response = await fetch("/api/noob/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_bonus",
          referrerId: selectedReferrer.id,
          withdrawalId: "", // Not needed for bonus
          amount: parseFloat(bonusAmount),
          description: bonusDescription,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setShowBonusModal(false);
        setSelectedReferrer(null);
        setBonusAmount("");
        setBonusDescription("");
        loadData();
      }
    } catch (error) {
      console.error("Error adding bonus:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseCommission = async (referrerId: string, earningId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/noob/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release_commission",
          referrerId,
          earningId,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        loadData();
      } else {
        alert(data.error || "Failed to release commission");
      }
    } catch (error) {
      console.error("Error releasing commission:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseAllReady = async () => {
    if (!confirm("Release all commissions that have passed the 7-day pending period?")) return;
    
    setActionLoading(true);
    try {
      // Release for all referrers with ready commissions
      const readyCommissions = pendingCommissions.filter(c => c.isReleasable);
      const uniqueReferrers = Array.from(new Set(readyCommissions.map(c => c.referrerId)));
      
      let totalReleased = 0;
      let totalAmount = 0;
      
      for (const referrerId of uniqueReferrers) {
        const response = await fetch("/api/noob/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "release_all_ready",
            referrerId,
          }),
        });
        const data = await response.json();
        if (data.success) {
          totalReleased += data.releasedCount || 0;
          totalAmount += data.releasedAmount || 0;
        }
      }
      
      if (totalReleased > 0) {
        alert(`Released ${totalReleased} commission(s) totaling $${totalAmount.toFixed(2)}`);
      } else {
        alert("No commissions were ready for release");
      }
      loadData();
    } catch (error) {
      console.error("Error releasing commissions:", error);
    } finally {
      setActionLoading(false);
    }
  };

  // Pending Commissions columns
  const commissionColumns: Column<PendingCommission>[] = [
    {
      key: "referrerName",
      header: "Referrer",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{row.referrerEmail}</p>
        </div>
      ),
    },
    {
      key: "userName",
      header: "Referred User",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{row.planName}</p>
        </div>
      ),
    },
    {
      key: "commission",
      header: "Commission",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-green-600">${value.toFixed(2)}</span>
      ),
    },
    {
      key: "subscriptionType",
      header: "Type",
      render: (value) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          value === "yearly" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
        }`}>
          {value}
        </span>
      ),
    },
    {
      key: "date",
      header: "Earned",
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: "daysUntilRelease",
      header: "Status",
      render: (value, row) => (
        <div>
          {row.isReleasable ? (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
              Ready to Release
            </span>
          ) : (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
              {value} day{value !== 1 ? "s" : ""} left
            </span>
          )}
        </div>
      ),
    },
    {
      key: "id",
      header: "Actions",
      render: (value, row) => (
        <button
          onClick={() => handleReleaseCommission(row.referrerId, value)}
          disabled={actionLoading}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            row.isReleasable 
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
        >
          {row.isReleasable ? "Release Now" : "Release Early"}
        </button>
      ),
    },
  ];

  const pendingColumns: Column<Withdrawal>[] = [
    {
      key: "referrerName",
      header: "User",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{row.referrerEmail}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-gray-900">
          ${value.toFixed(2)}
        </span>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (value, row) => (
        <div>
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
            value === "paypal" 
              ? "bg-blue-100 text-blue-800" 
              : value === "upi" 
                ? "bg-purple-100 text-purple-800" 
                : "bg-gray-100 text-gray-800"
          }`}>
            {getMethodLabel(value)}
          </span>
        </div>
      ),
    },
    {
      key: "details",
      header: "Payment Details",
      render: (value, row) => (
        <div className="text-sm">
          <p className="text-gray-900 font-mono">
            {formatWithdrawalDetails(row.method, row.details)}
          </p>
          {row.method === "bank" && row.details?.bankName && (
            <p className="text-xs text-gray-500">{row.details.bankName}</p>
          )}
        </div>
      ),
    },
    {
      key: "requestDate",
      header: "Requested",
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
            onClick={() => {
              setSelectedWithdrawal(row);
              setShowDetailsModal(true);
            }}
            className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() =>
              handleWithdrawalAction(row.referrerId, value, "complete")
            }
            disabled={actionLoading}
            className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            title="Mark as completed"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const reason = prompt("Enter rejection reason:");
              if (reason) {
                handleWithdrawalAction(row.referrerId, value, "reject", reason);
              }
            }}
            disabled={actionLoading}
            className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            title="Reject withdrawal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const completedColumns: Column<Withdrawal>[] = [
    {
      key: "referrerName",
      header: "User",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{row.referrerEmail}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-gray-900">
          ${value.toFixed(2)}
        </span>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (value, row) => (
        <div>
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
            value === "paypal" 
              ? "bg-blue-100 text-blue-800" 
              : value === "upi" 
                ? "bg-purple-100 text-purple-800" 
                : "bg-gray-100 text-gray-800"
          }`}>
            {getMethodLabel(value)}
          </span>
        </div>
      ),
    },
    {
      key: "details",
      header: "Payment Details",
      render: (value, row) => (
        <div className="text-sm">
          <p className="text-gray-900 font-mono">
            {formatWithdrawalDetails(row.method, row.details)}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            value === "completed"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: "completedDate",
      header: "Completed",
      sortable: true,
      render: (value, row) =>
        value
          ? new Date(value).toLocaleDateString()
          : row.requestDate
            ? new Date(row.requestDate).toLocaleDateString()
            : "-",
    },
    {
      key: "id",
      header: "Actions",
      render: (value, row) => (
        <button
          onClick={() => {
            setSelectedWithdrawal(row);
            setShowDetailsModal(true);
          }}
          className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          title="View details"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const leaderboardColumns: Column<ReferralData>[] = [
    {
      key: "userName",
      header: "Referrer",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{row.userEmail}</p>
        </div>
      ),
    },
    {
      key: "referralCode",
      header: "Code",
      render: (value) => (
        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
          {value}
        </span>
      ),
    },
    {
      key: "referralCount",
      header: "Referrals",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-gray-900">{value}</span>
      ),
    },
    {
      key: "totalEarnings",
      header: "Total Earned",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-green-600">
          ${value.toFixed(2)}
        </span>
      ),
    },
    {
      key: "availableBalance",
      header: "Available",
      sortable: true,
      render: (value) => (
        <span className="text-gray-900">${value.toFixed(2)}</span>
      ),
    },
    {
      key: "totalWithdrawn",
      header: "Withdrawn",
      sortable: true,
      render: (value) => (
        <span className="text-gray-500">${value.toFixed(2)}</span>
      ),
    },
    {
      key: "id",
      header: "Actions",
      render: (value, row) => (
        <button
          onClick={() => {
            setSelectedReferrer(row);
            setShowBonusModal(true);
          }}
          className="text-xs text-primary-600 hover:underline"
        >
          Add Bonus
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Referrals"
        subtitle="Manage referral program and withdrawals"
        onRefresh={loadData}
        loading={loading}
      />

      <div className="p-6">
        {/* Commission Settings Card */}
        <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl border border-primary-200 p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Percent className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Commission Rates</h3>
                <p className="text-sm text-gray-600">
                  Monthly: <span className="font-bold text-primary-600">{commissionSettings.monthlyRate}%</span>
                  {" · "}
                  Yearly: <span className="font-bold text-green-600">{commissionSettings.yearlyRate}%</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Edit Rates</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        {totals && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-6">
            <StatsCard
              title="Total Referrals"
              value={totals.totalReferrals}
              icon={<Users className="w-6 h-6" />}
              color="blue"
            />
            <StatsCard
              title="Active Referrers"
              value={totals.totalReferrers}
              icon={<Gift className="w-6 h-6" />}
              color="purple"
            />
            <StatsCard
              title="Total Earnings"
              value={`$${totals.totalEarnings.toFixed(2)}`}
              icon={<DollarSign className="w-6 h-6" />}
              color="green"
            />
            <StatsCard
              title="Paid Out"
              value={`$${totals.totalPaidOut.toFixed(2)}`}
              icon={<Check className="w-6 h-6" />}
              color="green"
            />
            <StatsCard
              title="Pending Commissions"
              value={commissionStats.totalCount}
              icon={<Clock className="w-6 h-6" />}
              color={commissionStats.releasableCount > 0 ? "green" : "yellow"}
              subtitle={`$${commissionStats.totalPendingAmount.toFixed(2)} (${commissionStats.releasableCount} ready)`}
            />
            <StatsCard
              title="Pending Withdrawals"
              value={withdrawals.pending.length}
              icon={<Banknote className="w-6 h-6" />}
              color={withdrawals.pending.length > 0 ? "yellow" : "gray"}
              subtitle={`$${withdrawals.pending.reduce((sum, w) => sum + w.amount, 0).toFixed(2)} total`}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex flex-wrap">
              <button
                onClick={() => setActiveTab("pending")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "pending"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Pending Withdrawals ({withdrawals.pending.length})
                {withdrawals.pending.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                    !
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("commissions")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "commissions"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Clock className="w-4 h-4 inline mr-1" />
                Pending Commissions ({commissionStats.totalCount})
                {commissionStats.releasableCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                    {commissionStats.releasableCount} ready
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "completed"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Withdrawal History (
                {withdrawals.completed.length + withdrawals.failed.length})
              </button>
              <button
                onClick={() => setActiveTab("leaderboard")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "leaderboard"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Trophy className="w-4 h-4 inline mr-1" />
                Top Referrers
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-0">
            {activeTab === "pending" && (
              <>
                {withdrawals.pending.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No pending withdrawals</p>
                  </div>
                ) : (
                  <DataTable
                    columns={pendingColumns}
                    data={withdrawals.pending}
                    loading={loading}
                    pageSize={25}
                    exportable
                    emptyMessage="No pending withdrawals"
                  />
                )}
              </>
            )}
            {activeTab === "commissions" && (
              <>
                {/* Header with Release All button */}
                {commissionStats.releasableCount > 0 && (
                  <div className="p-4 bg-green-50 border-b border-green-100 flex items-center justify-between">
                    <div>
                      <p className="text-green-800 font-medium">
                        {commissionStats.releasableCount} commission(s) ready for release
                      </p>
                      <p className="text-green-600 text-sm">
                        Total: ${commissionStats.releasableAmount.toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={handleReleaseAllReady}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      Release All Ready
                    </button>
                  </div>
                )}
                {pendingCommissions.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No pending commissions</p>
                    <p className="text-sm mt-2">Commissions will appear here when referrals are activated</p>
                  </div>
                ) : (
                  <DataTable
                    columns={commissionColumns}
                    data={pendingCommissions}
                    loading={loading}
                    pageSize={25}
                    exportable
                    emptyMessage="No pending commissions"
                  />
                )}
              </>
            )}
            {activeTab === "completed" && (
              <DataTable
                columns={completedColumns}
                data={[...withdrawals.completed, ...withdrawals.failed]}
                loading={loading}
                pageSize={25}
                exportable
                emptyMessage="No withdrawal history"
              />
            )}
            {activeTab === "leaderboard" && (
              <DataTable
                columns={leaderboardColumns}
                data={referrals.filter((r) => r.referralCount > 0)}
                loading={loading}
                pageSize={25}
                exportable
                emptyMessage="No referrers yet"
              />
            )}
          </div>
        </div>
      </div>

      {/* Add Bonus Modal */}
      {showBonusModal && selectedReferrer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Add Bonus
              </h2>
              <button
                onClick={() => {
                  setShowBonusModal(false);
                  setSelectedReferrer(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Add a manual bonus to{" "}
              <strong>{selectedReferrer.userName}</strong>&apos;s account.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bonus Amount ($)
                </label>
                <input
                  type="number"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                  placeholder="10.00"
                  min="0"
                  step="0.01"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={bonusDescription}
                  onChange={(e) => setBonusDescription(e.target.value)}
                  placeholder="Performance bonus"
                  className="input-field"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowBonusModal(false);
                  setSelectedReferrer(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBonus}
                disabled={actionLoading || !bonusAmount}
                className="btn-primary"
              >
                {actionLoading ? "Adding..." : "Add Bonus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Details Modal */}
      {showDetailsModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Withdrawal Details
              </h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedWithdrawal(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Badge */}
            <div className="mb-6">
              <span
                className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${
                  selectedWithdrawal.status === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : selectedWithdrawal.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {selectedWithdrawal.status.charAt(0).toUpperCase() + selectedWithdrawal.status.slice(1)}
              </span>
            </div>

            {/* User Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">User Information</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900 font-medium">{selectedWithdrawal.referrerName}</span>
                </div>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{selectedWithdrawal.referrerEmail}</span>
                </div>
              </div>
            </div>

            {/* Amount & Method */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Withdrawal Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="text-2xl font-bold text-green-600">${selectedWithdrawal.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Method</p>
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                    selectedWithdrawal.method === "paypal" 
                      ? "bg-blue-100 text-blue-800" 
                      : selectedWithdrawal.method === "upi" 
                        ? "bg-purple-100 text-purple-800" 
                        : "bg-gray-100 text-gray-800"
                  }`}>
                    {getMethodLabel(selectedWithdrawal.method)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Details based on method */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Payment Details</h3>
              
              {selectedWithdrawal.method === "paypal" && (
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 text-blue-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">PayPal Email</p>
                      <p className="text-gray-900 font-mono">{selectedWithdrawal.details?.email || "-"}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedWithdrawal.method === "upi" && (
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Smartphone className="w-4 h-4 text-purple-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">UPI ID</p>
                      <p className="text-gray-900 font-mono">{selectedWithdrawal.details?.upiId || "-"}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedWithdrawal.method === "bank" && (
                <div className="space-y-3">
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Account Holder Name</p>
                      <p className="text-gray-900">{selectedWithdrawal.details?.accountName || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <CreditCard className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Account Number</p>
                      <p className="text-gray-900 font-mono">{selectedWithdrawal.details?.accountNumber || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Building className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Bank Name</p>
                      <p className="text-gray-900">{selectedWithdrawal.details?.bankName || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Hash className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Routing Number</p>
                      <p className="text-gray-900 font-mono">{selectedWithdrawal.details?.routingNumber || "-"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Timeline</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Requested</span>
                  </div>
                  <span className="text-sm text-gray-900">
                    {selectedWithdrawal.requestDate 
                      ? new Date(selectedWithdrawal.requestDate).toLocaleString() 
                      : "-"}
                  </span>
                </div>
                {selectedWithdrawal.completedDate && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Check className="w-4 h-4 text-green-500 mr-2" />
                      <span className="text-sm text-gray-600">Completed</span>
                    </div>
                    <span className="text-sm text-gray-900">
                      {new Date(selectedWithdrawal.completedDate).toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedWithdrawal.rejectReason && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-600 font-medium">Rejection Reason</p>
                    <p className="text-sm text-red-800">{selectedWithdrawal.rejectReason}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Withdrawal ID */}
            <div className="text-xs text-gray-400 text-center">
              ID: {selectedWithdrawal.id}
            </div>

            {/* Close Button */}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedWithdrawal(null);
                }}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commission Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Settings className="w-5 h-5 text-primary-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Commission Settings</h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settingsLoading ? (
              <div className="py-8 text-center text-gray-500">Loading settings...</div>
            ) : (
              <div className="space-y-5">
                {/* Monthly Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Plan Commission Rate
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={commissionSettings.monthlyRate}
                      onChange={(e) => setCommissionSettings(prev => ({
                        ...prev,
                        monthlyRate: parseFloat(e.target.value) || 0
                      }))}
                      className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Commission earned on monthly subscriptions</p>
                </div>

                {/* Yearly Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yearly Plan Commission Rate
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={commissionSettings.yearlyRate}
                      onChange={(e) => setCommissionSettings(prev => ({
                        ...prev,
                        yearlyRate: parseFloat(e.target.value) || 0
                      }))}
                      className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Commission earned on yearly subscriptions</p>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Other Settings</h3>
                  
                  {/* Minimum Withdrawal */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-600 mb-1">
                      Minimum Withdrawal Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={commissionSettings.minWithdrawal}
                        onChange={(e) => setCommissionSettings(prev => ({
                          ...prev,
                          minWithdrawal: parseInt(e.target.value) || 10
                        }))}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  {/* Pending Days */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Commission Pending Period
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        step="1"
                        value={commissionSettings.pendingDays}
                        onChange={(e) => setCommissionSettings(prev => ({
                          ...prev,
                          pendingDays: parseInt(e.target.value) || 7
                        }))}
                        className="w-full px-4 py-2 pr-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">days</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Days before commission becomes available</p>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Preview</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-700">
                      $10 monthly → <span className="font-bold text-green-600">${(10 * commissionSettings.monthlyRate / 100).toFixed(2)}</span> commission
                    </p>
                    <p className="text-gray-700">
                      $100 yearly → <span className="font-bold text-green-600">${(100 * commissionSettings.yearlyRate / 100).toFixed(2)}</span> commission
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveCommissionSettings}
                    disabled={settingsSaving}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {settingsSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
