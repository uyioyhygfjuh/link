"use client";

import { useEffect, useState } from "react";
import { AdminHeader, StatsCard } from "@/components/noob";
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Gift,
  Calendar,
  Download,
} from "lucide-react";

interface RevenueData {
  totalRevenue: number;
  dailyRevenue: { date: string; revenue: number }[];
  revenueByPlan: { [key: string]: number };
  revenueByGateway: { [key: string]: number };
}

interface UserGrowthData {
  totalUsers: number;
  dailySignups: { date: string; signups: number }[];
  usersByPlan: { [key: string]: number };
}

interface ReferralData {
  totalReferrals: number;
  totalEarnings: number;
  totalPaidOut: number;
  pendingEarnings: number;
  topReferrers: { id: string; count: number; earnings: number }[];
}

export default function AnalyticsPage() {
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [userGrowthData, setUserGrowthData] = useState<UserGrowthData | null>(null);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [revenueRes, usersRes, referralsRes] = await Promise.all([
        fetch("/api/noob/analytics?type=revenue"),
        fetch("/api/noob/analytics?type=users"),
        fetch("/api/noob/analytics?type=referrals"),
      ]);

      const [revenue, users, referrals] = await Promise.all([
        revenueRes.json(),
        usersRes.json(),
        referralsRes.json(),
      ]);

      setRevenueData(revenue);
      setUserGrowthData(users);
      setReferralData(referrals);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const exportData = (type: string) => {
    let data: any[] = [];
    let filename = "";

    if (type === "revenue" && revenueData) {
      data = revenueData.dailyRevenue.map((d) => ({
        Date: d.date,
        Revenue: d.revenue,
      }));
      filename = "revenue-report";
    } else if (type === "users" && userGrowthData) {
      data = userGrowthData.dailySignups.map((d) => ({
        Date: d.date,
        Signups: d.signups,
      }));
      filename = "user-growth-report";
    }

    if (data.length === 0) return;

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxRevenue = revenueData
    ? Math.max(...revenueData.dailyRevenue.map((d) => d.revenue), 1)
    : 1;

  const maxSignups = userGrowthData
    ? Math.max(...userGrowthData.dailySignups.map((d) => d.signups), 1)
    : 1;

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Analytics"
        subtitle="System-wide analytics and insights"
        onRefresh={loadAnalytics}
        loading={loading}
      />

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-64 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-48 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Revenue Analytics */}
            {revenueData && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Revenue Analytics
                  </h2>
                  <button
                    onClick={() => exportData("revenue")}
                    className="flex items-center space-x-2 text-sm text-gray-600 hover:text-primary-600"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <StatsCard
                    title="Total Revenue"
                    value={formatCurrency(revenueData.totalRevenue)}
                    icon={<DollarSign className="w-6 h-6" />}
                    color="green"
                  />
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">
                      Revenue by Plan
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(revenueData.revenueByPlan).map(
                        ([plan, amount]) => (
                          <div
                            key={plan}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="capitalize text-gray-600">
                              {plan}
                            </span>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(amount)}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">
                      Revenue by Gateway
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(revenueData.revenueByGateway).map(
                        ([gateway, amount]) => (
                          <div
                            key={gateway}
                            className="flex items-center justify-between text-sm"
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

                {/* Revenue Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">
                    Daily Revenue (Last 30 Days)
                  </h3>
                  <div className="h-48 flex items-end space-x-1">
                    {revenueData.dailyRevenue.map((day, i) => (
                      <div
                        key={i}
                        className="flex-1 group relative"
                        title={`${day.date}: ${formatCurrency(day.revenue)}`}
                      >
                        <div
                          className="bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-pointer"
                          style={{
                            height: `${(day.revenue / maxRevenue) * 100}%`,
                            minHeight: day.revenue > 0 ? "4px" : "0",
                          }}
                        ></div>
                        <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                          {day.date}: {formatCurrency(day.revenue)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{revenueData.dailyRevenue[0]?.date}</span>
                    <span>
                      {
                        revenueData.dailyRevenue[
                          revenueData.dailyRevenue.length - 1
                        ]?.date
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* User Growth Analytics */}
            {userGrowthData && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    User Growth
                  </h2>
                  <button
                    onClick={() => exportData("users")}
                    className="flex items-center space-x-2 text-sm text-gray-600 hover:text-primary-600"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <StatsCard
                    title="Total Users"
                    value={userGrowthData.totalUsers}
                    icon={<Users className="w-6 h-6" />}
                    color="blue"
                  />
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">
                      Users by Plan
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(userGrowthData.usersByPlan).map(
                        ([plan, count]) => (
                          <div
                            key={plan}
                            className="flex items-center space-x-2 bg-gray-50 rounded-lg px-4 py-2"
                          >
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                                plan === "enterprise"
                                  ? "bg-purple-100 text-purple-800"
                                  : plan === "pro"
                                    ? "bg-blue-100 text-blue-800"
                                    : plan === "basic"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {plan}
                            </span>
                            <span className="font-medium text-gray-900">
                              {count}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Signups Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">
                    Daily Signups (Last 30 Days)
                  </h3>
                  <div className="h-48 flex items-end space-x-1">
                    {userGrowthData.dailySignups.map((day, i) => (
                      <div
                        key={i}
                        className="flex-1 group relative"
                        title={`${day.date}: ${day.signups} signups`}
                      >
                        <div
                          className="bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                          style={{
                            height: `${(day.signups / maxSignups) * 100}%`,
                            minHeight: day.signups > 0 ? "4px" : "0",
                          }}
                        ></div>
                        <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                          {day.date}: {day.signups} signups
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{userGrowthData.dailySignups[0]?.date}</span>
                    <span>
                      {
                        userGrowthData.dailySignups[
                          userGrowthData.dailySignups.length - 1
                        ]?.date
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Referral Analytics */}
            {referralData && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Referral Program Performance
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <StatsCard
                    title="Total Referrals"
                    value={referralData.totalReferrals}
                    icon={<Users className="w-6 h-6" />}
                    color="purple"
                  />
                  <StatsCard
                    title="Total Earnings"
                    value={formatCurrency(referralData.totalEarnings)}
                    icon={<Gift className="w-6 h-6" />}
                    color="green"
                  />
                  <StatsCard
                    title="Paid Out"
                    value={formatCurrency(referralData.totalPaidOut)}
                    icon={<DollarSign className="w-6 h-6" />}
                    color="blue"
                  />
                  <StatsCard
                    title="Pending"
                    value={formatCurrency(referralData.pendingEarnings)}
                    icon={<Calendar className="w-6 h-6" />}
                    color={referralData.pendingEarnings > 0 ? "yellow" : "gray"}
                  />
                </div>

                {/* Top Referrers */}
                {referralData.topReferrers.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-4">
                      Top Referrers
                    </h3>
                    <div className="space-y-3">
                      {referralData.topReferrers.slice(0, 10).map((referrer, i) => (
                        <div
                          key={referrer.id}
                          className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                        >
                          <div className="flex items-center space-x-3">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                i === 0
                                  ? "bg-yellow-100 text-yellow-800"
                                  : i === 1
                                    ? "bg-gray-200 text-gray-800"
                                    : i === 2
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {i + 1}
                            </span>
                            <span className="text-gray-600 text-sm">
                              {referrer.id.substring(0, 8)}...
                            </span>
                          </div>
                          <div className="flex items-center space-x-6">
                            <span className="text-sm text-gray-600">
                              {referrer.count} referrals
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(referrer.earnings)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
