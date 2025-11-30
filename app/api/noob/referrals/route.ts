import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { notifyWithdrawalCompleted, notifyWithdrawalRejected } from "@/lib/notifications";

// GET /api/noob/referrals - Get all referral data and withdrawals
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";

    const referralsRef = collection(db, "referrals");
    const snapshot = await getDocs(referralsRef);

    // Collect all users for name lookup
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);
    const usersMap: { [key: string]: any } = {};
    usersSnapshot.forEach((doc) => {
      usersMap[doc.id] = doc.data();
    });

    if (type === "withdrawals") {
      // Get all pending withdrawals
      const withdrawals: any[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const userId = doc.id;
        const user = usersMap[userId];

        (data.withdrawals || []).forEach((w: any) => {
          withdrawals.push({
            ...w,
            referrerId: userId,
            referrerName: user?.fullName || user?.displayName || "Unknown",
            referrerEmail: user?.email || "",
          });
        });
      });

      // Sort by request date descending
      withdrawals.sort((a, b) => {
        const dateA = new Date(a.requestDate).getTime();
        const dateB = new Date(b.requestDate).getTime();
        return dateB - dateA;
      });

      const pendingWithdrawals = withdrawals.filter(
        (w) => w.status === "pending"
      );
      const completedWithdrawals = withdrawals.filter(
        (w) => w.status === "completed"
      );
      const failedWithdrawals = withdrawals.filter(
        (w) => w.status === "failed"
      );

      return NextResponse.json({
        pending: pendingWithdrawals,
        completed: completedWithdrawals,
        failed: failedWithdrawals,
        all: withdrawals,
      });
    }
    
    // Get pending commissions
    if (type === "pending_commissions") {
      const pendingCommissions: any[] = [];
      const now = new Date();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const userId = docSnap.id;
        const user = usersMap[userId];

        (data.earnings || []).forEach((e: any) => {
          if (e.status === "pending") {
            const releaseDate = e.releaseDate ? new Date(e.releaseDate) : null;
            const isReleasable = releaseDate ? now >= releaseDate : false;
            
            pendingCommissions.push({
              ...e,
              referrerId: userId,
              referrerName: user?.fullName || user?.displayName || "Unknown",
              referrerEmail: user?.email || "",
              isReleasable, // Can be auto-released (7 days passed)
              daysUntilRelease: releaseDate 
                ? Math.max(0, Math.ceil((releaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                : 0,
            });
          }
        });
      });

      // Sort by date descending (newest first)
      pendingCommissions.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });

      // Calculate totals
      const totalPendingAmount = pendingCommissions.reduce((sum, c) => sum + c.commission, 0);
      const releasableAmount = pendingCommissions
        .filter(c => c.isReleasable)
        .reduce((sum, c) => sum + c.commission, 0);

      return NextResponse.json({
        pendingCommissions,
        totalPendingAmount,
        releasableAmount,
        totalCount: pendingCommissions.length,
        releasableCount: pendingCommissions.filter(c => c.isReleasable).length,
      });
    }

    // Get all referral data
    const referrals: any[] = [];
    let totalReferrals = 0;
    let totalEarnings = 0;
    let totalPaidOut = 0;
    let pendingBalance = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const userId = doc.id;
      const user = usersMap[userId];

      totalReferrals += data.referralCount || 0;
      totalEarnings += data.totalEarnings || 0;
      totalPaidOut += data.totalWithdrawn || 0;
      pendingBalance += data.pendingBalance || 0;

      referrals.push({
        id: userId,
        referralCode: data.referralCode,
        referralCount: data.referralCount || 0,
        totalEarnings: data.totalEarnings || 0,
        availableBalance: data.availableBalance || 0,
        pendingBalance: data.pendingBalance || 0,
        totalWithdrawn: data.totalWithdrawn || 0,
        referrals: data.referrals || [],
        earnings: data.earnings || [],
        withdrawals: data.withdrawals || [],
        userName: user?.fullName || user?.displayName || "Unknown",
        userEmail: user?.email || "",
      });
    });

    // Sort by referral count descending
    referrals.sort((a, b) => b.referralCount - a.referralCount);

    return NextResponse.json({
      referrals,
      totals: {
        totalReferrals,
        totalEarnings,
        totalPaidOut,
        pendingBalance,
        totalReferrers: referrals.filter((r) => r.referralCount > 0).length,
      },
    });
  } catch (error) {
    console.error("Error fetching referrals:", error);
    return NextResponse.json(
      { error: "Failed to fetch referrals" },
      { status: 500 }
    );
  }
}

// POST /api/noob/referrals - Handle referral actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, referrerId, withdrawalId, reason } = body;

    const referralRef = doc(db, "referrals", referrerId);
    const referralDoc = await getDoc(referralRef);

    if (!referralDoc.exists()) {
      return NextResponse.json(
        { error: "Referral data not found" },
        { status: 404 }
      );
    }

    const data = referralDoc.data();
    
    // Handle commission-related actions first (don't need withdrawal check)
    if (action === "release_commission" || action === "confirm_earnings") {
      const { earningId } = body;
      const earnings = data.earnings || [];
      const earningIndex = earnings.findIndex((e: any) => e.id === earningId);

      if (earningIndex === -1) {
        return NextResponse.json(
          { error: "Earning not found" },
          { status: 404 }
        );
      }

      const earning = earnings[earningIndex];
      if (earning.status !== "pending") {
        return NextResponse.json(
          { error: "Earning already processed" },
          { status: 400 }
        );
      }

      earnings[earningIndex] = {
        ...earning,
        status: "completed",
        releasedDate: new Date().toISOString(),
        releasedBy: "admin",
      };

      await updateDoc(referralRef, {
        earnings,
        availableBalance: increment(earning.commission),
        pendingBalance: increment(-earning.commission),
        updatedAt: new Date().toISOString(),
      });

      // Notify user that their commission is now available
      const notificationsRef = collection(db, "notifications");
      const { addDoc } = await import("firebase/firestore");
      await addDoc(notificationsRef, {
        userId: referrerId,
        title: "Commission Released! 💰",
        message: `Your referral commission of $${earning.commission.toFixed(2)} is now available for withdrawal.`,
        type: "success",
        read: false,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Commission of $${earning.commission.toFixed(2)} released and moved to available balance`,
      });
    }
    
    // Handle release all ready commissions
    if (action === "release_all_ready") {
      const earnings = data.earnings || [];
      const now = new Date();
      let releasedCount = 0;
      let releasedAmount = 0;
      
      const updatedEarnings = earnings.map((e: any) => {
        if (e.status === "pending" && e.releaseDate) {
          const releaseDate = new Date(e.releaseDate);
          if (now >= releaseDate) {
            releasedCount++;
            releasedAmount += e.commission;
            return {
              ...e,
              status: "completed",
              releasedDate: new Date().toISOString(),
              releasedBy: "auto",
            };
          }
        }
        return e;
      });
      
      if (releasedCount > 0) {
        await updateDoc(referralRef, {
          earnings: updatedEarnings,
          availableBalance: increment(releasedAmount),
          pendingBalance: increment(-releasedAmount),
          updatedAt: new Date().toISOString(),
        });
        
        // Notify user
        const notificationsRef = collection(db, "notifications");
        const { addDoc } = await import("firebase/firestore");
        await addDoc(notificationsRef, {
          userId: referrerId,
          title: "Commissions Released! 💰",
          message: `${releasedCount} referral commission(s) totaling $${releasedAmount.toFixed(2)} are now available for withdrawal.`,
          type: "success",
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        success: true,
        message: `Released ${releasedCount} commission(s) totaling $${releasedAmount.toFixed(2)}`,
        releasedCount,
        releasedAmount,
      });
    }
    
    // Handle add bonus
    if (action === "add_bonus") {
      const { amount, description } = body;

      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: "Invalid bonus amount" },
          { status: 400 }
        );
      }

      const bonusEarning = {
        id: `bonus_${referrerId}_${Date.now()}`,
        userId: "admin",
        userName: "Admin Bonus",
        amount: 0,
        commission: amount,
        subscriptionType: "bonus",
        date: new Date().toISOString(),
        status: "completed",
        description: description || "Manual bonus from admin",
      };

      const currentEarnings = data.earnings || [];

      await updateDoc(referralRef, {
        earnings: [...currentEarnings, bonusEarning],
        totalEarnings: increment(amount),
        availableBalance: increment(amount),
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Bonus of $${amount} added successfully`,
      });
    }
    
    // For withdrawal-related actions, check for withdrawal
    const withdrawals = data.withdrawals || [];
    const withdrawalIndex = withdrawals.findIndex(
      (w: any) => w.id === withdrawalId
    );
    
    if (withdrawalIndex === -1) {
      return NextResponse.json(
        { error: "Withdrawal not found" },
        { status: 404 }
      );
    }

    const withdrawal = withdrawals[withdrawalIndex];

    if (action === "approve") {
      // Mark withdrawal as approved (still pending processing)
      withdrawals[withdrawalIndex] = {
        ...withdrawal,
        status: "approved",
        approvedDate: new Date().toISOString(),
      };

      await updateDoc(referralRef, {
        withdrawals,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: "Withdrawal approved",
      });
    }

    if (action === "complete") {
      // Mark withdrawal as completed
      withdrawals[withdrawalIndex] = {
        ...withdrawal,
        status: "completed",
        completedDate: new Date().toISOString(),
      };

      await updateDoc(referralRef, {
        withdrawals,
        totalWithdrawn: increment(withdrawal.amount),
        updatedAt: new Date().toISOString(),
      });

      // Send notification to user about withdrawal completion
      await notifyWithdrawalCompleted(
        referrerId,
        withdrawal.amount,
        withdrawal.method,
        withdrawalId
      );

      return NextResponse.json({
        success: true,
        message: "Withdrawal marked as completed",
      });
    }

    if (action === "reject") {
      // Reject withdrawal and return funds to available balance
      const rejectReason = reason || "Rejected by admin";
      withdrawals[withdrawalIndex] = {
        ...withdrawal,
        status: "failed",
        rejectedDate: new Date().toISOString(),
        rejectReason: rejectReason,
      };

      await updateDoc(referralRef, {
        withdrawals,
        availableBalance: increment(withdrawal.amount),
        updatedAt: new Date().toISOString(),
      });

      // Send notification to user about withdrawal rejection
      await notifyWithdrawalRejected(
        referrerId,
        withdrawal.amount,
        withdrawal.method,
        withdrawalId,
        rejectReason
      );

      return NextResponse.json({
        success: true,
        message: "Withdrawal rejected and funds returned",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing referral action:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
