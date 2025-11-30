import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  increment,
  arrayUnion,
} from "firebase/firestore";

// Helper function to create a notification
async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info"
) {
  try {
    const notificationsRef = collection(db, "notifications");
    await addDoc(notificationsRef, {
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    });
    console.log(`✅ Notification sent to ${userId}: ${title}`);
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

// Default commission rates (fallback if settings not found)
const DEFAULT_MONTHLY_RATE = 15; // 15%
const DEFAULT_YEARLY_RATE = 20;  // 20%

// Helper function to get commission rates from Firestore settings
async function getCommissionRates(): Promise<{ monthlyRate: number; yearlyRate: number }> {
  try {
    const settingsRef = doc(db, "settings", "referral");
    const settingsDoc = await getDoc(settingsRef);
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return {
        monthlyRate: data.referralCommission?.monthlyRate ?? DEFAULT_MONTHLY_RATE,
        yearlyRate: data.referralCommission?.yearlyRate ?? DEFAULT_YEARLY_RATE,
      };
    }
  } catch (error) {
    console.error("Error fetching commission rates:", error);
  }
  
  return { monthlyRate: DEFAULT_MONTHLY_RATE, yearlyRate: DEFAULT_YEARLY_RATE };
}

// Helper function to calculate commission based on subscription type
// Uses dynamic rates from Firestore settings
async function calculateCommission(amount: number, subscriptionType: "monthly" | "yearly"): Promise<number> {
  const rates = await getCommissionRates();
  const rate = subscriptionType === "yearly" ? rates.yearlyRate / 100 : rates.monthlyRate / 100;
  return Number((amount * rate).toFixed(2));
}

// Helper function to process referral commission when a user's plan is activated
async function processReferralCommission(
  userId: string,
  planName: string,
  planId: string,
  subscriptionPeriod: "monthly" | "yearly" = "monthly"
) {
  try {
    console.log(`🔄 Processing referral commission for user ${userId}, plan: ${planName}`);
    
    // Get user's referral data to find who referred them
    const userReferralRef = doc(db, "referrals", userId);
    const userReferralDoc = await getDoc(userReferralRef);
    
    if (!userReferralDoc.exists()) {
      console.log("❌ No referral data found for user");
      return { success: false, reason: "No referral data" };
    }
    
    const userReferralData = userReferralDoc.data();
    const referrerId = userReferralData.referredBy;
    
    // Check if commission was already processed for this plan
    const commissionProcessed = userReferralData.commissionProcessedForPlan === planId;
    if (commissionProcessed) {
      console.log("⚠️ Commission already processed for this plan");
      return { success: false, reason: "Commission already processed" };
    }
    
    if (!referrerId) {
      console.log("❌ User was not referred by anyone");
      return { success: false, reason: "No referrer" };
    }
    
    console.log(`✅ Found referrer: ${referrerId}`);
    
    // Get plan price to calculate commission
    const planRef = doc(db, "plans", planId);
    const planDoc = await getDoc(planRef);
    
    if (!planDoc.exists()) {
      console.log("❌ Plan not found:", planId);
      return { success: false, reason: "Plan not found" };
    }
    
    const planData = planDoc.data();
    // Get the correct price based on subscription period
    const planPrice = subscriptionPeriod === "yearly" 
      ? (planData.yearlyPrice || planData.price || 0)
      : (planData.monthlyPrice || planData.price || 0);
    
    if (planPrice <= 0) {
      console.log("❌ Plan has no price:", planPrice);
      return { success: false, reason: "Plan has no price" };
    }
    
    console.log(`💰 Plan price: $${planPrice}, Period: ${subscriptionPeriod}`);
    
    // Calculate commission using dynamic rates from settings
    const commission = await calculateCommission(planPrice, subscriptionPeriod);
    
    if (commission <= 0) {
      console.log("❌ Commission is zero");
      return { success: false, reason: "Commission is zero" };
    }
    
    console.log(`💵 Commission calculated: $${commission}`);
    
    // Get referrer's referral data
    const referrerRefDoc = doc(db, "referrals", referrerId);
    const referrerReferral = await getDoc(referrerRefDoc);
    
    if (!referrerReferral.exists()) {
      console.log("❌ Referrer referral data not found");
      return { success: false, reason: "Referrer referral data not found" };
    }
    
    // Get referred user's name
    const userRef = doc(db, "users", userId);
    const userDocData = await getDoc(userRef);
    const userName = userDocData.exists() 
      ? userDocData.data().fullName || "A user" 
      : "A user";
    
    // Create earning record (matches lib/referral.ts structure)
    // Commission starts as "pending" and will be released after 7 days or by admin
    const earningId = `${referrerId}_${userId}_${Date.now()}`;
    const releaseDate = new Date();
    releaseDate.setDate(releaseDate.getDate() + 7); // 7 days pending period
    
    const earning = {
      id: earningId,
      referredUserId: userId,
      userName: userName,
      amount: planPrice,
      commission: commission,
      subscriptionType: subscriptionPeriod,
      planName: planName,
      date: new Date().toISOString(),
      releaseDate: releaseDate.toISOString(), // When commission becomes available
      status: "pending" as const, // Starts as pending, released after 7 days
    };
    
    // Update referrer's referral document with the earning
    // Add to pendingBalance initially, will move to availableBalance when released
    await updateDoc(referrerRefDoc, {
      earnings: arrayUnion(earning),
      totalEarnings: increment(commission),
      pendingBalance: increment(commission), // Goes to pending first
      updatedAt: new Date().toISOString(),
    });
    
    // Update the referred user's status in referrer's referrals array
    const referrerData = referrerReferral.data();
    const referrals = referrerData.referrals || [];
    const updatedReferrals = referrals.map((ref: any) => {
      if (ref.userId === userId) {
        return {
          ...ref,
          status: "active",
          subscription: {
            plan: planName,
            type: subscriptionPeriod,
            amount: planPrice,
            startDate: new Date().toISOString(),
          },
        };
      }
      return ref;
    });
    
    await updateDoc(referrerRefDoc, {
      referrals: updatedReferrals,
    });
    
    // Mark commission as processed for this user and plan to prevent duplicates
    await updateDoc(userReferralRef, {
      commissionProcessedForPlan: planId,
      commissionProcessedAt: new Date().toISOString(),
    });
    
    console.log(`✅ Referral earnings recorded for referrer ${referrerId}`);
    
    // Notify referrer about the commission (pending for 7 days)
    await createNotification(
      referrerId,
      "Referral Commission Earned! 🎉",
      `Great news! ${userName} upgraded to ${planName}. You earned $${commission.toFixed(2)} in referral commission! The amount will be available in 7 days.`,
      "success"
    );
    
    // Get referrer's name for logging
    const referrerUserRef = doc(db, "users", referrerId);
    const referrerUserDoc = await getDoc(referrerUserRef);
    const referrerName = referrerUserDoc.exists() 
      ? referrerUserDoc.data().fullName || "User" 
      : "User";
    
    console.log(`🎉 Referral commission of $${commission.toFixed(2)} credited to ${referrerName} (${referrerId})`);
    
    return { success: true, commission, referrerId, referrerName };
  } catch (error) {
    console.error("❌ Error processing referral commission:", error);
    return { success: false, reason: "Error processing commission", error };
  }
}

// GET /api/noob/users/[id] - Get specific user details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;

    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data = userDoc.data();
    
    // Fetch the actual plan name from plans collection if planId exists
    let planName = data.plan || "Free Trial";
    const planId = data.planId || "";
    
    if (planId) {
      try {
        const planRef = doc(db, "plans", planId);
        const planDoc = await getDoc(planRef);
        if (planDoc.exists()) {
          const planData = planDoc.data();
          planName = planData.name || planName;
        }
      } catch (planError) {
        console.error("Error fetching plan:", planError);
      }
    }
    
    // Use explicitly set status from Firestore - respect admin changes
    const now = new Date();
    const storedStatus = data.planStatus || "Trial";
    let calculatedStatus = storedStatus;
    
    const trialEndStr = data.trialEnd || "";
    const renewalDateStr = data.renewalDate || "";
    
    // Only auto-calculate if status is "Trial" and trial has ended
    // Respect explicitly set Active, Canceled, Expired statuses
    if (storedStatus === "Trial" && trialEndStr) {
      const trialEndDate = new Date(trialEndStr);
      if (now > trialEndDate) {
        // Trial has ended, check if they have a paid plan
        if (planId && planId !== "free") {
          calculatedStatus = "Active";
        } else {
          calculatedStatus = "Expired";
        }
      }
    }
    
    // Only check renewal expiry for Active subscriptions
    if (storedStatus === "Active" && renewalDateStr) {
      const renewalDate = new Date(renewalDateStr);
      if (now > renewalDate) {
        // Past renewal date - mark as expired
        calculatedStatus = "Expired";
      }
    }
    
    // Always preserve these explicitly set statuses
    if (storedStatus === "Active" || storedStatus === "Canceled" || storedStatus === "cancelled" || storedStatus === "Expired") {
      // Only override Active if past renewal date (checked above)
      if (storedStatus !== "Active" || calculatedStatus === "Active") {
        calculatedStatus = storedStatus === "cancelled" ? "Canceled" : storedStatus;
      }
    }
    
    // Calculate renewal date if not set (based on subscription period)
    let renewalDate = renewalDateStr;
    if (!renewalDate && data.createdAt && planId && planId !== "free" && calculatedStatus === "Active") {
      const startDate = new Date(data.planStartDate || data.createdAt);
      const nextRenewal = new Date(startDate);
      const period = data.subscriptionPeriod || "monthly";
      
      // Move to next renewal date after now
      while (nextRenewal <= now) {
        if (period === "yearly") {
          nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
        } else {
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        }
      }
      renewalDate = nextRenewal.toISOString();
    }

    const user = {
      id: userDoc.id,
      fullName: data.fullName || data.displayName || "Unknown",
      email: data.email || "",
      photoURL: data.photoURL || "",
      plan: planName,
      planStatus: calculatedStatus,
      planId: planId,
      subscriptionPeriod: data.subscriptionPeriod || "monthly",
      subscriptionId: data.subscriptionId || "",
      trialStart: data.trialStart || "",
      trialEnd: data.trialEnd || "",
      renewalDate: renewalDate,
      isAdmin: data.isAdmin || false,
      emailAlerts: data.emailAlerts || false,
      weeklyReports: data.weeklyReports || false,
      scansUsed: data.scansUsed || 0,
      videosScannedToday: data.videosScannedToday || 0,
      lastScanDate: data.lastScanDate || "",
      createdAt: data.createdAt || "",
      updatedAt: data.updatedAt || "",
      lastLogin: data.lastLogin || "",
    };

    // Get referral data
    const referralDoc = await getDoc(doc(db, "referrals", userId));
    const referralData = referralDoc.exists() ? referralDoc.data() : null;

    // Get channels count
    const channelsRef = collection(db, "channels");
    const channelsQuery = query(channelsRef, where("userId", "==", userId));
    const channelsSnapshot = await getDocs(channelsQuery);
    const channelsCount = channelsSnapshot.size;

    // Get scan sessions count
    const sessionsRef = collection(db, "scanSessions");
    const sessionsQuery = query(sessionsRef, where("userId", "==", userId));
    const sessionsSnapshot = await getDocs(sessionsQuery);
    const sessionsCount = sessionsSnapshot.size;

    // Get payments
    const paymentsRef = collection(db, "payments");
    const paymentsQuery = query(paymentsRef, where("userId", "==", userId));
    const paymentsSnapshot = await getDocs(paymentsQuery);
    const payments = paymentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      user,
      referral: referralData
        ? {
            referralCode: referralData.referralCode,
            referredBy: referralData.referredBy,
            referredByName: referralData.referredByName,
            referralCount: referralData.referralCount || 0,
            totalEarnings: referralData.totalEarnings || 0,
            availableBalance: referralData.availableBalance || 0,
            pendingBalance: referralData.pendingBalance || 0,
            totalWithdrawn: referralData.totalWithdrawn || 0,
          }
        : null,
      stats: {
        channelsCount,
        sessionsCount,
        paymentsCount: payments.length,
      },
      payments,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PATCH /api/noob/users/[id] - Update specific user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const body = await request.json();
    const { updates, action } = body;

    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Handle special actions
    if (action === "extend_trial") {
      const daysToExtend = updates.daysToExtend || 7;
      const userData = userDoc.data();
      const currentTrialEnd = userData.trialEnd
        ? new Date(userData.trialEnd)
        : new Date();
      const newTrialEnd = new Date(
        currentTrialEnd.getTime() + daysToExtend * 24 * 60 * 60 * 1000
      );

      await updateDoc(userRef, {
        trialEnd: newTrialEnd.toISOString(),
        planStatus: "Trial",
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Trial extended by ${daysToExtend} days`,
        newTrialEnd: newTrialEnd.toISOString(),
      });
    }

    if (action === "reset_usage") {
      await updateDoc(userRef, {
        scansUsed: 0,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: "Usage limits reset successfully",
      });
    }

    if (action === "toggle_admin") {
      const userData = userDoc.data();
      const newAdminStatus = !userData.isAdmin;

      await updateDoc(userRef, {
        isAdmin: newAdminStatus,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Admin role ${newAdminStatus ? "granted" : "revoked"}`,
        isAdmin: newAdminStatus,
      });
    }

    // Regular update - Admin has full permission to edit any field
    const allowedFields = [
      // User profile
      "fullName",
      "displayName",
      "email",
      "photoURL",
      // Plan & Subscription
      "plan",
      "planStatus",
      "planId",
      "subscriptionPeriod",
      "subscriptionId",
      "trialStart",
      "trialEnd",
      "renewalDate",
      // Permissions
      "isAdmin",
      // Usage limits
      "scansUsed",
      "videosScannedToday",
      "lastScanDate",
      // Settings
      "emailAlerts",
      "weeklyReports",
      // Referral
      "referredBy",
    ];

    const filteredUpdates: { [key: string]: any } = {};
    Object.keys(updates || {}).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    filteredUpdates.updatedAt = new Date().toISOString();

    // Get current user data to detect changes
    const userData = userDoc.data();
    const oldPlan = userData.plan || "Free Trial";
    const oldPlanId = userData.planId || "";
    const oldStatus = userData.planStatus || "Trial";
    
    const newPlan = filteredUpdates.plan || oldPlan;
    const newPlanId = filteredUpdates.planId || oldPlanId;
    const newStatus = filteredUpdates.planStatus || oldStatus;
    const subscriptionPeriod = (filteredUpdates.subscriptionPeriod || userData.subscriptionPeriod || "monthly") as "monthly" | "yearly";
    
    // Detect plan change
    const planChanged = (filteredUpdates.plan && filteredUpdates.plan !== oldPlan) || 
                        (filteredUpdates.planId && filteredUpdates.planId !== oldPlanId);
    const statusChanged = filteredUpdates.planStatus && filteredUpdates.planStatus !== oldStatus;
    
    // Detect if user is being activated (status changed to Active OR plan changed to paid)
    const isBeingActivated = (statusChanged && newStatus === "Active") || 
                             (planChanged && newPlanId && newPlanId !== "free");

    await updateDoc(userRef, filteredUpdates);

    // Send notification to user if plan or status changed
    if (planChanged) {
      await createNotification(
        userId,
        "Plan Updated",
        `Your plan has been changed to ${newPlan}. If you have any questions, please contact support.`,
        "info"
      );
    }
    
    // Process referral commission when user is activated with a paid plan
    // This happens when:
    // 1. Admin changes status from Trial to Active
    // 2. Admin upgrades user's plan to a paid plan
    if (isBeingActivated && newPlanId && newPlanId !== "free") {
      console.log(`🎯 User ${userId} is being activated with plan ${newPlan} (${newPlanId})`);
      const commissionResult = await processReferralCommission(userId, newPlan, newPlanId, subscriptionPeriod);
      console.log("Commission processing result:", commissionResult);
    }
    
    if (statusChanged) {
      let statusMessage = "";
      let notificationType: "info" | "success" | "warning" | "error" = "info";
      
      switch (newStatus) {
        case "Active":
          statusMessage = "Your subscription is now active! Enjoy full access to all features.";
          notificationType = "success";
          break;
        case "Trial":
          statusMessage = "Your account is now in trial mode. Explore all features!";
          notificationType = "info";
          break;
        case "Canceled":
          statusMessage = "Your subscription has been canceled. You can still access features until the end of your billing period.";
          notificationType = "warning";
          break;
        case "Expired":
          statusMessage = "Your subscription has expired. Please renew to continue accessing premium features.";
          notificationType = "warning";
          break;
        default:
          statusMessage = `Your subscription status has been updated to ${newStatus}.`;
      }
      
      await createNotification(
        userId,
        "Subscription Status Updated",
        statusMessage,
        notificationType
      );
    }

    // Also update referral data if needed
    if (updates.referralCode || updates.referralCount !== undefined || 
        updates.totalEarnings !== undefined || updates.availableBalance !== undefined ||
        updates.pendingBalance !== undefined || updates.totalWithdrawn !== undefined) {
      const referralRef = doc(db, "referrals", userId);
      const referralDocData = await getDoc(referralRef);
      
      if (referralDocData.exists()) {
        const referralUpdates: { [key: string]: any } = {};
        if (updates.referralCode) referralUpdates.referralCode = updates.referralCode;
        if (updates.referralCount !== undefined) referralUpdates.referralCount = updates.referralCount;
        if (updates.totalEarnings !== undefined) referralUpdates.totalEarnings = updates.totalEarnings;
        if (updates.availableBalance !== undefined) referralUpdates.availableBalance = updates.availableBalance;
        if (updates.pendingBalance !== undefined) referralUpdates.pendingBalance = updates.pendingBalance;
        if (updates.totalWithdrawn !== undefined) referralUpdates.totalWithdrawn = updates.totalWithdrawn;
        referralUpdates.updatedAt = new Date().toISOString();
        
        await updateDoc(referralRef, referralUpdates);
      }
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      planChanged,
      statusChanged,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/noob/users/[id] - Delete specific user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;

    // Delete user document
    await deleteDoc(doc(db, "users", userId));

    // Delete related documents
    // Delete referral data
    try {
      await deleteDoc(doc(db, "referrals", userId));
    } catch (e) {
      console.log("No referral data to delete");
    }

    // Delete channels
    const channelsRef = collection(db, "channels");
    const channelsQuery = query(channelsRef, where("userId", "==", userId));
    const channelsSnapshot = await getDocs(channelsQuery);
    for (const channelDoc of channelsSnapshot.docs) {
      await deleteDoc(channelDoc.ref);
    }

    // Delete scan sessions
    const sessionsRef = collection(db, "scanSessions");
    const sessionsQuery = query(sessionsRef, where("userId", "==", userId));
    const sessionsSnapshot = await getDocs(sessionsQuery);
    for (const sessionDoc of sessionsSnapshot.docs) {
      await deleteDoc(sessionDoc.ref);
    }

    // Delete notifications
    const notificationsRef = collection(db, "notifications");
    const notificationsQuery = query(
      notificationsRef,
      where("userId", "==", userId)
    );
    const notificationsSnapshot = await getDocs(notificationsQuery);
    for (const notificationDoc of notificationsSnapshot.docs) {
      await deleteDoc(notificationDoc.ref);
    }

    return NextResponse.json({
      success: true,
      message: "User and related data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
