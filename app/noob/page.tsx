"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminHeader, StatsCard } from "@/components/noob";
import {
  Users,
  CreditCard,
  DollarSign,
  Youtube,
  Scan,
  Gift,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  usersByPlan: {
    trial: number;
    basic: number;
    pro: number;
    enterprise: number;
  };
  activeSubscriptions: number;
  newUsersThisMonth: number;
  totalRevenue: number;
  revenueThisMonth: number;
  mrrValue: number;
  arrValue: number;
  pendingWithdrawals: number;
  totalWithdrawalAmount: number;
  totalChannels: number;
  totalScans: number;
  scansLast30Days: number;
  trialsExpiringSoon: number;
  totalReferrers: number;
  totalReferrals: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/noob/analytics?type=overview");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Dashboard"
        subtitle="Overview of your LinkGuard platform"
        onRefresh={loadStats}
        loading={loading}
      />

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Alert Banner for Pending Items */}
            {(stats.pendingWithdrawals > 0 || stats.trialsExpiringSoon > 0) && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-800">
                      Attention Required
                    </h3>
                    <div className="mt-1 text-sm text-amber-700 space-y-1">
                      {stats.pendingWithdrawals > 0 && (
                        <p>
                          {stats.pendingWithdrawals} pending withdrawal
                          {stats.pendingWithdrawals > 1 ? "s" : ""} (
                          {formatCurrency(stats.totalWithdrawalAmount)})
                        </p>
                      )}
                      {stats.trialsExpiringSoon > 0 && (
                        <p>
                          {stats.trialsExpiringSoon} trial
                          {stats.trialsExpiringSoon > 1 ? "s" : ""} expiring
                          within 3 days
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Stats */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Users Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                  title="Total Users"
                  value={stats.totalUsers}
                  icon={<Users className="w-6 h-6" />}
                  color="blue"
                  subtitle={`+${stats.newUsersThisMonth} this month`}
                />
                <StatsCard
                  title="Trial Users"
                  value={stats.usersByPlan.trial}
                  icon={<Clock className="w-6 h-6" />}
                  color="yellow"
                  subtitle={`${stats.trialsExpiringSoon} expiring soon`}
                />
                <StatsCard
                  title="Active Subscriptions"
                  value={stats.activeSubscriptions}
                  icon={<CreditCard className="w-6 h-6" />}
                  color="green"
                />
                <StatsCard
                  title="Plan Distribution"
                  value={`${stats.usersByPlan.basic}/${stats.usersByPlan.pro}/${stats.usersByPlan.enterprise}`}
                  icon={<TrendingUp className="w-6 h-6" />}
                  color="purple"
                  subtitle="Basic / Pro / Enterprise"
                />
              </div>
            </div>

            {/* Revenue Stats */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Revenue & Payments
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                  title="Total Revenue"
                  value={formatCurrency(stats.totalRevenue)}
                  icon={<DollarSign className="w-6 h-6" />}
                  color="green"
                />
                <StatsCard
                  title="Revenue This Month"
                  value={formatCurrency(stats.revenueThisMonth)}
                  icon={<DollarSign className="w-6 h-6" />}
                  color="green"
                />
                <StatsCard
                  title="MRR"
                  value={formatCurrency(stats.mrrValue)}
                  icon={<TrendingUp className="w-6 h-6" />}
                  color="blue"
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
            </div>

            {/* Platform Stats */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Platform Activity
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                  title="Total Channels"
                  value={stats.totalChannels}
                  icon={<Youtube className="w-6 h-6" />}
                  color="red"
                />
                <StatsCard
                  title="Total Scans"
                  value={stats.totalScans}
                  icon={<Scan className="w-6 h-6" />}
                  color="blue"
                  subtitle={`${stats.scansLast30Days} in last 30 days`}
                />
                <StatsCard
                  title="Total Referrals"
                  value={stats.totalReferrals}
                  icon={<Gift className="w-6 h-6" />}
                  color="purple"
                  subtitle={`${stats.totalReferrers} referrers`}
                />
                <StatsCard
                  title="Pending Withdrawals"
                  value={stats.pendingWithdrawals}
                  icon={<DollarSign className="w-6 h-6" />}
                  color={stats.pendingWithdrawals > 0 ? "yellow" : "gray"}
                  subtitle={formatCurrency(stats.totalWithdrawalAmount)}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link
                  href="/noob/users"
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Manage Users</p>
                        <p className="text-sm text-gray-500">
                          View and edit users
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                  </div>
                </Link>

                <Link
                  href="/noob/referrals"
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Gift className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          Process Withdrawals
                        </p>
                        <p className="text-sm text-gray-500">
                          {stats.pendingWithdrawals} pending
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                  </div>
                </Link>

                <Link
                  href="/noob/subscriptions"
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          Expiring Trials
                        </p>
                        <p className="text-sm text-gray-500">
                          {stats.trialsExpiringSoon} expiring soon
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                  </div>
                </Link>

                <Link
                  href="/noob/notifications"
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          Send Notification
                        </p>
                        <p className="text-sm text-gray-500">
                          Broadcast to users
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                  </div>
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Failed to load dashboard data</p>
            <button
              onClick={loadStats}
              className="mt-4 btn-primary"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
