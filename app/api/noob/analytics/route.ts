import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";

// Dashboard Statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "overview";

    switch (type) {
      case "overview":
        return NextResponse.json(await getOverviewStats());
      case "revenue":
        return NextResponse.json(await getRevenueStats());
      case "users":
        return NextResponse.json(await getUserGrowthStats());
      case "referrals":
        return NextResponse.json(await getReferralStats());
      default:
        return NextResponse.json(await getOverviewStats());
    }
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

async function getOverviewStats() {
  // Get users stats
  const usersRef = collection(db, "users");
  const usersSnapshot = await getDocs(usersRef);

  let totalUsers = 0;
  const usersByPlan = { trial: 0, basic: 0, pro: 0, enterprise: 0 };
  let activeSubscriptions = 0;
  let newUsersThisMonth = 0;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  usersSnapshot.forEach((doc) => {
    const data = doc.data();
    totalUsers++;

    const plan = (data.plan || "Free Trial").toLowerCase();
    if (plan.includes("basic")) usersByPlan.basic++;
    else if (plan.includes("pro")) usersByPlan.pro++;
    else if (plan.includes("enterprise")) usersByPlan.enterprise++;
    else usersByPlan.trial++;

    if (data.planStatus === "Active") activeSubscriptions++;

    // Count new users
    if (data.createdAt) {
      const createdDate = new Date(data.createdAt);
      if (createdDate >= thirtyDaysAgo) newUsersThisMonth++;
    }
  });

  // Get payments/revenue stats
  const paymentsRef = collection(db, "payments");
  const paymentsSnapshot = await getDocs(
    query(paymentsRef, where("status", "==", "succeeded"))
  );

  let totalRevenue = 0;
  let revenueThisMonth = 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  paymentsSnapshot.forEach((doc) => {
    const data = doc.data();
    const amount = data.amount || 0;
    totalRevenue += amount;

    if (data.createdAt) {
      const paymentDate = new Date(data.createdAt);
      if (paymentDate >= monthStart) {
        revenueThisMonth += amount;
      }
    }
  });

  // Calculate MRR and ARR
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
        mrrValue += monthlyAmount * 0.8; // Yearly users pay 80% per month
      } else {
        mrrValue += monthlyAmount;
      }
    }
  });

  // Get pending withdrawals
  const referralsRef = collection(db, "referrals");
  const referralsSnapshot = await getDocs(referralsRef);

  let pendingWithdrawals = 0;
  let totalWithdrawalAmount = 0;
  let totalReferrers = 0;
  let totalReferrals = 0;

  referralsSnapshot.forEach((doc) => {
    const data = doc.data();
    totalReferrers++;
    totalReferrals += data.referralCount || 0;

    const withdrawals = data.withdrawals || [];
    withdrawals.forEach((w: any) => {
      if (w.status === "pending") {
        pendingWithdrawals++;
        totalWithdrawalAmount += w.amount || 0;
      }
    });
  });

  // Get channels count
  const channelsRef = collection(db, "channels");
  const channelsSnapshot = await getDocs(channelsRef);
  const totalChannels = channelsSnapshot.size;

  // Get scans stats
  const scansRef = collection(db, "scanSessions");
  const scansSnapshot = await getDocs(scansRef);
  const totalScans = scansSnapshot.size;

  let scansLast30Days = 0;
  scansSnapshot.forEach((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt || data.startedAt;
    if (createdAt) {
      const scanDate = new Date(createdAt);
      if (scanDate >= thirtyDaysAgo) scansLast30Days++;
    }
  });

  // Get trial expiring soon (within 3 days)
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  let trialsExpiringSoon = 0;

  usersSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.planStatus === "Trial" && data.trialEnd) {
      const trialEnd = new Date(data.trialEnd);
      if (trialEnd <= threeDaysFromNow && trialEnd >= new Date()) {
        trialsExpiringSoon++;
      }
    }
  });

  return {
    totalUsers,
    usersByPlan,
    activeSubscriptions,
    newUsersThisMonth,
    totalRevenue,
    revenueThisMonth,
    mrrValue: Math.round(mrrValue * 100) / 100,
    arrValue: Math.round(mrrValue * 12 * 100) / 100,
    pendingWithdrawals,
    totalWithdrawalAmount,
    totalChannels,
    totalScans,
    scansLast30Days,
    trialsExpiringSoon,
    totalReferrers,
    totalReferrals,
  };
}

async function getRevenueStats() {
  const paymentsRef = collection(db, "payments");
  const paymentsSnapshot = await getDocs(
    query(paymentsRef, where("status", "==", "succeeded"))
  );

  const dailyRevenue: { [key: string]: number } = {};
  const revenueByPlan: { [key: string]: number } = {};
  const revenueByGateway: { [key: string]: number } = {};
  let totalRevenue = 0;

  paymentsSnapshot.forEach((doc) => {
    const data = doc.data();
    const amount = data.amount || 0;
    totalRevenue += amount;

    // Daily breakdown
    if (data.createdAt) {
      const date = new Date(data.createdAt).toISOString().split("T")[0];
      dailyRevenue[date] = (dailyRevenue[date] || 0) + amount;
    }

    // By plan
    const plan = data.planId || "unknown";
    revenueByPlan[plan] = (revenueByPlan[plan] || 0) + amount;

    // By gateway
    const gateway = data.gateway || "unknown";
    revenueByGateway[gateway] = (revenueByGateway[gateway] || 0) + amount;
  });

  // Get last 30 days
  const last30Days = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    last30Days.push({
      date: dateStr,
      revenue: dailyRevenue[dateStr] || 0,
    });
  }

  return {
    totalRevenue,
    dailyRevenue: last30Days,
    revenueByPlan,
    revenueByGateway,
  };
}

async function getUserGrowthStats() {
  const usersRef = collection(db, "users");
  const usersSnapshot = await getDocs(usersRef);

  const dailySignups: { [key: string]: number } = {};
  const usersByPlan: { [key: string]: number } = {};

  usersSnapshot.forEach((doc) => {
    const data = doc.data();

    // Daily signups
    if (data.createdAt) {
      const date = new Date(data.createdAt).toISOString().split("T")[0];
      dailySignups[date] = (dailySignups[date] || 0) + 1;
    }

    // By plan
    const plan = (data.plan || "Free Trial").toLowerCase();
    if (plan.includes("basic")) {
      usersByPlan["basic"] = (usersByPlan["basic"] || 0) + 1;
    } else if (plan.includes("pro")) {
      usersByPlan["pro"] = (usersByPlan["pro"] || 0) + 1;
    } else if (plan.includes("enterprise")) {
      usersByPlan["enterprise"] = (usersByPlan["enterprise"] || 0) + 1;
    } else {
      usersByPlan["trial"] = (usersByPlan["trial"] || 0) + 1;
    }
  });

  // Get last 30 days
  const last30Days = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    last30Days.push({
      date: dateStr,
      signups: dailySignups[dateStr] || 0,
    });
  }

  return {
    totalUsers: usersSnapshot.size,
    dailySignups: last30Days,
    usersByPlan,
  };
}

async function getReferralStats() {
  const referralsRef = collection(db, "referrals");
  const referralsSnapshot = await getDocs(referralsRef);

  let totalReferrals = 0;
  let totalEarnings = 0;
  let totalPaidOut = 0;
  let pendingEarnings = 0;
  const topReferrers: {
    id: string;
    count: number;
    earnings: number;
    name?: string;
  }[] = [];

  referralsSnapshot.forEach((doc) => {
    const data = doc.data();
    totalReferrals += data.referralCount || 0;
    totalEarnings += data.totalEarnings || 0;
    totalPaidOut += data.totalWithdrawn || 0;
    pendingEarnings += data.pendingBalance || 0;

    if (data.referralCount > 0) {
      topReferrers.push({
        id: doc.id,
        count: data.referralCount || 0,
        earnings: data.totalEarnings || 0,
      });
    }
  });

  // Sort and get top 20
  topReferrers.sort((a, b) => b.count - a.count);
  const top20 = topReferrers.slice(0, 20);

  return {
    totalReferrals,
    totalEarnings,
    totalPaidOut,
    pendingEarnings,
    topReferrers: top20,
  };
}
