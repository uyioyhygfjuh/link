import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";

// GET /api/noob/subscriptions - Get all subscriptions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";

    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const activeSubscriptions: any[] = [];
    const trialUsers: any[] = [];
    const trialsExpiringSoon: any[] = [];
    const allUsers: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const user = {
        id: doc.id,
        fullName: data.fullName || data.displayName || "Unknown",
        email: data.email || "",
        plan: data.plan || "Free Trial",
        planStatus: data.planStatus || "Trial",
        planId: data.planId || "",
        trialStart: data.trialStart || "",
        trialEnd: data.trialEnd || "",
        renewalDate: data.renewalDate || "",
        subscriptionPeriod: data.subscriptionPeriod || "monthly",
        createdAt: data.createdAt || "",
      };

      allUsers.push(user);

      if (data.planStatus === "Active") {
        activeSubscriptions.push(user);
      }

      if (data.planStatus === "Trial") {
        trialUsers.push(user);

        // Check if trial expiring soon
        if (data.trialEnd) {
          const trialEnd = new Date(data.trialEnd);
          if (trialEnd <= threeDaysFromNow && trialEnd >= now) {
            trialsExpiringSoon.push({
              ...user,
              daysRemaining: Math.ceil(
                (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              ),
            });
          }
        }
      }
    });

    // Sort by relevant dates
    activeSubscriptions.sort((a, b) => {
      const dateA = new Date(a.renewalDate || 0).getTime();
      const dateB = new Date(b.renewalDate || 0).getTime();
      return dateA - dateB;
    });

    trialsExpiringSoon.sort((a, b) => a.daysRemaining - b.daysRemaining);

    trialUsers.sort((a, b) => {
      const dateA = new Date(a.trialEnd || 0).getTime();
      const dateB = new Date(b.trialEnd || 0).getTime();
      return dateA - dateB;
    });

    // Calculate stats
    const planDistribution = {
      trial: trialUsers.length,
      basic: activeSubscriptions.filter((u) =>
        u.plan.toLowerCase().includes("basic")
      ).length,
      pro: activeSubscriptions.filter((u) =>
        u.plan.toLowerCase().includes("pro")
      ).length,
      enterprise: activeSubscriptions.filter((u) =>
        u.plan.toLowerCase().includes("enterprise")
      ).length,
    };

    return NextResponse.json({
      activeSubscriptions,
      trialUsers,
      trialsExpiringSoon,
      allUsers,
      stats: {
        totalActive: activeSubscriptions.length,
        totalTrial: trialUsers.length,
        totalTrialsExpiringSoon: trialsExpiringSoon.length,
        planDistribution,
      },
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

// POST /api/noob/subscriptions - Handle subscription actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, data: actionData } = body;

    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();

    if (action === "upgrade") {
      const { newPlan, period } = actionData;

      // Calculate renewal date
      const renewalMs =
        period === "yearly"
          ? 365 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;
      const renewalDate = new Date(Date.now() + renewalMs);

      await updateDoc(userRef, {
        plan: newPlan,
        planId: newPlan.toLowerCase(),
        planStatus: "Active",
        subscriptionPeriod: period,
        renewalDate: renewalDate.toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `User upgraded to ${newPlan} (${period})`,
      });
    }

    if (action === "downgrade") {
      const { newPlan } = actionData;

      await updateDoc(userRef, {
        plan: newPlan,
        planId: newPlan.toLowerCase(),
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `User downgraded to ${newPlan}`,
      });
    }

    if (action === "cancel") {
      await updateDoc(userRef, {
        planStatus: "Cancelled",
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: "Subscription cancelled",
      });
    }

    if (action === "extend") {
      const { days } = actionData;

      if (userData.planStatus === "Trial") {
        // Extend trial
        const currentTrialEnd = userData.trialEnd
          ? new Date(userData.trialEnd)
          : new Date();
        const newTrialEnd = new Date(
          currentTrialEnd.getTime() + days * 24 * 60 * 60 * 1000
        );

        await updateDoc(userRef, {
          trialEnd: newTrialEnd.toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          message: `Trial extended by ${days} days`,
        });
      } else {
        // Extend subscription
        const currentRenewal = userData.renewalDate
          ? new Date(userData.renewalDate)
          : new Date();
        const newRenewal = new Date(
          currentRenewal.getTime() + days * 24 * 60 * 60 * 1000
        );

        await updateDoc(userRef, {
          renewalDate: newRenewal.toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          message: `Subscription extended by ${days} days`,
        });
      }
    }

    if (action === "bulk_extend_trials") {
      const { userIds, days } = actionData;

      for (const uid of userIds) {
        const uRef = doc(db, "users", uid);
        const uDoc = await getDoc(uRef);

        if (uDoc.exists()) {
          const uData = uDoc.data();
          if (uData.planStatus === "Trial") {
            const currentTrialEnd = uData.trialEnd
              ? new Date(uData.trialEnd)
              : new Date();
            const newTrialEnd = new Date(
              currentTrialEnd.getTime() + days * 24 * 60 * 60 * 1000
            );

            await updateDoc(uRef, {
              trialEnd: newTrialEnd.toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Extended trials for ${userIds.length} users by ${days} days`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing subscription action:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
