"use client";

import { useEffect, useState } from "react";
import { AdminHeader, StatsCard, DataTable, Column } from "@/components/noob";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  DollarSign,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
} from "lucide-react";

interface Payment {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  planId: string;
  amount: number;
  currency: string;
  gateway: string;
  status: string;
  cycle: string;
  createdAt: string;
  flagged?: boolean;
}

interface PaymentStats {
  totalRevenue: number;
  revenueThisMonth: number;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  mrrValue: number;
  arrValue: number;
  revenueByPlan: { [key: string]: number };
  revenueByGateway: { [key: string]: number };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "successful" | "failed">(
    "all"
  );

  const loadPayments = async () => {
    setLoading(true);
    try {
      // Get all payments
      const paymentsRef = collection(db, "payments");
      const paymentsSnapshot = await getDocs(paymentsRef);

      // Get all users for lookup
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const usersMap: { [key: string]: any } = {};
      usersSnapshot.forEach((doc) => {
        usersMap[doc.id] = doc.data();
      });

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      let totalRevenue = 0;
      let revenueThisMonth = 0;
      let successfulPayments = 0;
      let failedPayments = 0;
      const revenueByPlan: { [key: string]: number } = {};
      const revenueByGateway: { [key: string]: number } = {};

      const paymentsList: Payment[] = paymentsSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const user = usersMap[data.userId];
        const amount = data.amount || 0;

        // Count stats for successful payments
        if (data.status === "succeeded") {
          successfulPayments++;
          totalRevenue += amount;

          // Revenue this month
          if (data.createdAt) {
            const paymentDate = new Date(data.createdAt);
            if (paymentDate >= monthStart) {
              revenueThisMonth += amount;
            }
          }

          // By plan
          const plan = data.planId || "unknown";
          revenueByPlan[plan] = (revenueByPlan[plan] || 0) + amount;

          // By gateway
          const gateway = data.gateway || "unknown";
          revenueByGateway[gateway] =
            (revenueByGateway[gateway] || 0) + amount;
        } else if (data.status === "failed") {
          failedPayments++;
        }

        return {
          id: docSnap.id,
          userId: data.userId || "",
          userName: user?.fullName || user?.displayName || "Unknown",
          userEmail: user?.email || "",
          planId: data.planId || "unknown",
          amount,
          currency: data.currency || "USD",
          gateway: data.gateway || "unknown",
          status: data.status || "unknown",
          cycle: data.cycle || "monthly",
          createdAt: data.createdAt || "",
          flagged: data.flagged || false,
        };
      });

      // Sort by date descending
      paymentsList.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime() || 0;
        const dateB = new Date(b.createdAt).getTime() || 0;
        return dateB - dateA;
      });

      // Calculate MRR and ARR based on active subscriptions
      let mrrValue = 0;
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.planStatus === "Active") {
          const plan = (data.plan || "").toLowerCase();
          let monthlyAmount = 0;
          if (plan.includes("basic")) monthlyAmount = 19;
          else if (plan.includes("pro")) monthlyAmount = 29;
          else if (plan.includes("enterprise")) monthlyAmount = 49;

          if (data.subscriptionPeriod === "yearly") {
            mrrValue += monthlyAmount * 0.8;
          } else {
            mrrValue += monthlyAmount;
          }
        }
      });

      setPayments(paymentsList);
      setStats({
        totalRevenue,
        revenueThisMonth,
        totalPayments: paymentsList.length,
        successfulPayments,
        failedPayments,
        mrrValue: Math.round(mrrValue * 100) / 100,
        arrValue: Math.round(mrrValue * 12 * 100) / 100,
        revenueByPlan,
        revenueByGateway,
      });
    } catch (error) {
      console.error("Error loading payments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const formatCurrency = (value: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  };

  const filteredPayments =
    activeTab === "all"
      ? payments
      : activeTab === "successful"
        ? payments.filter((p) => p.status === "succeeded")
        : payments.filter((p) => p.status === "failed");

  const columns: Column<Payment>[] = [
    {
      key: "userName",
      header: "User",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{row.userEmail}</p>
        </div>
      ),
    },
    {
      key: "planId",
      header: "Plan",
      sortable: true,
      render: (value, row) => (
        <div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
              value === "enterprise"
                ? "bg-purple-100 text-purple-800"
                : value === "pro"
                  ? "bg-blue-100 text-blue-800"
                  : value === "basic"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
            }`}
          >
            {value}
          </span>
          <p className="text-xs text-gray-500 mt-1 capitalize">{row.cycle}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (value, row) => (
        <span className="font-medium text-gray-900">
          {formatCurrency(value, row.currency)}
        </span>
      ),
    },
    {
      key: "gateway",
      header: "Gateway",
      sortable: true,
      render: (value) => (
        <span className="capitalize">
          {value === "lemonsqueezy" ? "Lemon Squeezy" : value}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-1">
          {value === "succeeded" ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : value === "failed" ? (
            <XCircle className="w-4 h-4 text-red-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          )}
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              value === "succeeded"
                ? "bg-green-100 text-green-800"
                : value === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {value}
          </span>
          {row.flagged && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
              Flagged
            </span>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Date",
      sortable: true,
      render: (value) =>
        value ? new Date(value).toLocaleString() : "-",
    },
  ];

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Payments"
        subtitle="Track payment history and revenue"
        onRefresh={loadPayments}
        loading={loading}
      />

      <div className="p-6">
        {/* Stats */}
        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <StatsCard
                title="Total Revenue"
                value={formatCurrency(stats.totalRevenue)}
                icon={<DollarSign className="w-6 h-6" />}
                color="green"
              />
              <StatsCard
                title="This Month"
                value={formatCurrency(stats.revenueThisMonth)}
                icon={<Calendar className="w-6 h-6" />}
                color="blue"
              />
              <StatsCard
                title="MRR"
                value={formatCurrency(stats.mrrValue)}
                icon={<TrendingUp className="w-6 h-6" />}
                color="purple"
                subtitle="Monthly Recurring Revenue"
              />
              <StatsCard
                title="ARR"
                value={formatCurrency(stats.arrValue)}
                icon={<TrendingUp className="w-6 h-6" />}
                color="purple"
                subtitle="Annual Recurring Revenue"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <StatsCard
                title="Total Payments"
                value={stats.totalPayments}
                icon={<CreditCard className="w-6 h-6" />}
                color="gray"
              />
              <StatsCard
                title="Successful"
                value={stats.successfulPayments}
                icon={<CheckCircle className="w-6 h-6" />}
                color="green"
                subtitle={`${
                  stats.totalPayments > 0
                    ? Math.round(
                        (stats.successfulPayments / stats.totalPayments) * 100
                      )
                    : 0
                }% success rate`}
              />
              <StatsCard
                title="Failed"
                value={stats.failedPayments}
                icon={<XCircle className="w-6 h-6" />}
                color={stats.failedPayments > 0 ? "red" : "gray"}
              />
            </div>

            {/* Revenue Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Revenue by Plan
                </h3>
                <div className="space-y-3">
                  {Object.entries(stats.revenueByPlan).map(([plan, amount]) => (
                    <div
                      key={plan}
                      className="flex items-center justify-between"
                    >
                      <span className="capitalize text-gray-600">{plan}</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Revenue by Gateway
                </h3>
                <div className="space-y-3">
                  {Object.entries(stats.revenueByGateway).map(
                    ([gateway, amount]) => (
                      <div
                        key={gateway}
                        className="flex items-center justify-between"
                      >
                        <span className="capitalize text-gray-600">
                          {gateway === "lemonsqueezy"
                            ? "Lemon Squeezy"
                            : gateway}
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "all"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                All Payments ({payments.length})
              </button>
              <button
                onClick={() => setActiveTab("successful")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "successful"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Successful ({stats?.successfulPayments || 0})
              </button>
              <button
                onClick={() => setActiveTab("failed")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "failed"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Failed ({stats?.failedPayments || 0})
                {(stats?.failedPayments || 0) > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                    !
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="p-0">
            <DataTable
              columns={columns}
              data={filteredPayments}
              loading={loading}
              searchable
              searchPlaceholder="Search by user or payment ID..."
              pageSize={25}
              exportable
              emptyMessage="No payments found"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
