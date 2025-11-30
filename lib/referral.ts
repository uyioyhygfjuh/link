import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
} from "firebase/firestore";
import { notifyWithdrawalRequested } from "./notifications";

export interface ReferralData {
  referralCode: string;
  referredBy: string | null;
  referredByName: string | null;
  referralCount: number;
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  totalWithdrawn: number;
  referrals: Array<{
    userId: string;
    userName: string;
    email: string;
    signupDate: string;
    status: "active" | "inactive";
    subscription?: {
      plan: string;
      type: "monthly" | "yearly";
      amount: number;
      startDate: string;
    };
  }>;
  earnings: Array<{
    id: string;
    userId?: string;
    referredUserId?: string;
    userName: string;
    amount: number;
    commission: number;
    subscriptionType: "monthly" | "yearly" | "bonus";
    planName?: string;
    date: string;
    releaseDate?: string;
    releasedDate?: string;
    releasedBy?: string;
    status: "pending" | "completed";
    description?: string;
  }>;
  withdrawals: Array<{
    id: string;
    amount: number;
    method: "paypal" | "bank" | "upi";
    details: any;
    status: "pending" | "completed" | "failed";
    requestDate: string;
    completedDate?: string;
  }>;
}

/**
 * Generate a unique referral code for a user
 * Format: First 3 letters of name + 4 random chars + last 2 of email
 */
export const generateReferralCode = (name: string, email: string): string => {
  const namePart = name.replace(/\s+/g, "").substring(0, 3).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  const emailPart = email
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-2)
    .toUpperCase();

  return `${namePart}${randomPart}${emailPart}`;
};

/**
 * Create referral data for a new user
 */
export const createReferralData = async (
  userId: string,
  referralCode: string,
  referredByCode: string | null = null,
): Promise<void> => {
  try {
    let referredBy: string | null = null;
    let referredByName: string | null = null;

    // If user signed up with a referral code, find the referrer
    if (referredByCode) {
      const referrerData = await findUserByReferralCode(referredByCode);
      if (referrerData) {
        referredBy = referrerData.userId;
        referredByName = referrerData.name;

        // Update referrer's referral count
        await updateReferrerStats(referrerData.userId, userId);
      }
    }

    // Create referral document for the new user
    await setDoc(doc(db, "referrals", userId), {
      referralCode: referralCode,
      referredBy: referredBy,
      referredByName: referredByName,
      referralCount: 0,
      totalEarnings: 0,
      availableBalance: 0,
      pendingBalance: 0,
      totalWithdrawn: 0,
      referrals: [],
      earnings: [],
      withdrawals: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating referral data:", error);
    throw error;
  }
};

/**
 * Find user by referral code
 */
export const findUserByReferralCode = async (
  referralCode: string,
): Promise<{ userId: string; name: string; email: string } | null> => {
  try {
    const referralsRef = collection(db, "referrals");
    const q = query(
      referralsRef,
      where("referralCode", "==", referralCode.toUpperCase()),
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const referralDoc = querySnapshot.docs[0];
    const userId = referralDoc.id;

    // Get user data
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    return {
      userId: userId,
      name: userData.fullName || userData.displayName || "Unknown",
      email: userData.email || "",
    };
  } catch (error) {
    console.error("Error finding user by referral code:", error);
    return null;
  }
};

/**
 * Update referrer's statistics when someone signs up with their code
 */
export const updateReferrerStats = async (
  referrerId: string,
  newUserId: string,
): Promise<void> => {
  try {
    // Get new user's data
    const newUserDoc = await getDoc(doc(db, "users", newUserId));
    if (!newUserDoc.exists()) {
      return;
    }

    const newUserData = newUserDoc.data();
    const referralRef = doc(db, "referrals", referrerId);
    const referralDoc = await getDoc(referralRef);

    if (referralDoc.exists()) {
      const referralData = referralDoc.data();
      const updatedReferrals = [
        ...(referralData.referrals || []),
        {
          userId: newUserId,
          userName:
            newUserData.fullName || newUserData.displayName || "Unknown",
          email: newUserData.email || "",
          signupDate: new Date().toISOString(),
          status: "active",
        },
      ];

      await updateDoc(referralRef, {
        referralCount: increment(1),
        referrals: updatedReferrals,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error updating referrer stats:", error);
    throw error;
  }
};

/**
 * Get referral data for a user
 */
export const getReferralData = async (
  userId: string,
): Promise<ReferralData | null> => {
  try {
    const referralDoc = await getDoc(doc(db, "referrals", userId));

    if (!referralDoc.exists()) {
      return null;
    }

    const data = referralDoc.data();
    return {
      referralCode: data.referralCode || "",
      referredBy: data.referredBy || null,
      referredByName: data.referredByName || null,
      referralCount: data.referralCount || 0,
      totalEarnings: data.totalEarnings || 0,
      availableBalance: data.availableBalance || 0,
      pendingBalance: data.pendingBalance || 0,
      totalWithdrawn: data.totalWithdrawn || 0,
      referrals: data.referrals || [],
      earnings: data.earnings || [],
      withdrawals: data.withdrawals || [],
    };
  } catch (error) {
    console.error("Error getting referral data:", error);
    return null;
  }
};

/**
 * Calculate commission based on subscription type
 * 15% for monthly, 20% for yearly
 */
export const calculateCommission = (
  amount: number,
  subscriptionType: "monthly" | "yearly",
): number => {
  const rate = subscriptionType === "yearly" ? 0.2 : 0.15;
  return Number((amount * rate).toFixed(2));
};

/**
 * Record earnings when a referred user subscribes
 */
export const recordEarnings = async (
  referrerId: string,
  referredUserId: string,
  subscriptionAmount: number,
  subscriptionType: "monthly" | "yearly",
  planName: string,
): Promise<void> => {
  try {
    const commission = calculateCommission(
      subscriptionAmount,
      subscriptionType,
    );

    // Get referred user's name
    const userDoc = await getDoc(doc(db, "users", referredUserId));
    const userName = userDoc.exists()
      ? userDoc.data().fullName || "Unknown User"
      : "Unknown User";

    const earningId = `${referrerId}_${referredUserId}_${Date.now()}`;

    const earning = {
      id: earningId,
      userId: referredUserId,
      userName: userName,
      amount: subscriptionAmount,
      commission: commission,
      subscriptionType: subscriptionType,
      date: new Date().toISOString(),
      status: "pending" as const,
    };

    const referralRef = doc(db, "referrals", referrerId);

    // Update referral document
    await updateDoc(referralRef, {
      earnings: arrayUnion(earning),
      totalEarnings: increment(commission),
      pendingBalance: increment(commission),
      updatedAt: new Date().toISOString(),
    });

    // Update the referral entry with subscription info
    const referralDoc = await getDoc(referralRef);
    if (referralDoc.exists()) {
      const data = referralDoc.data();
      const referrals = data.referrals || [];

      const updatedReferrals = referrals.map((ref: any) => {
        if (ref.userId === referredUserId) {
          return {
            ...ref,
            subscription: {
              plan: planName,
              type: subscriptionType,
              amount: subscriptionAmount,
              startDate: new Date().toISOString(),
            },
          };
        }
        return ref;
      });

      await updateDoc(referralRef, {
        referrals: updatedReferrals,
      });
    }
  } catch (error) {
    console.error("Error recording earnings:", error);
    throw error;
  }
};

/**
 * Move earnings from pending to available after confirmation period
 */
export const confirmEarnings = async (
  referrerId: string,
  earningId: string,
): Promise<void> => {
  try {
    const referralRef = doc(db, "referrals", referrerId);
    const referralDoc = await getDoc(referralRef);

    if (referralDoc.exists()) {
      const data = referralDoc.data();
      const earnings = data.earnings || [];

      const updatedEarnings = earnings.map((earning: any) => {
        if (earning.id === earningId && earning.status === "pending") {
          return { ...earning, status: "completed" };
        }
        return earning;
      });

      const earning = earnings.find((e: any) => e.id === earningId);
      if (earning && earning.status === "pending") {
        await updateDoc(referralRef, {
          earnings: updatedEarnings,
          availableBalance: increment(earning.commission),
          pendingBalance: increment(-earning.commission),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error("Error confirming earnings:", error);
    throw error;
  }
};

/**
 * Get minimum withdrawal amount from settings
 */
const getMinWithdrawalAmount = async (): Promise<number> => {
  try {
    const settingsRef = doc(db, "settings", "referral");
    const settingsDoc = await getDoc(settingsRef);
    if (settingsDoc.exists()) {
      return settingsDoc.data()?.referralCommission?.minWithdrawal ?? 10;
    }
  } catch (error) {
    console.error("Error fetching min withdrawal amount:", error);
  }
  return 10; // Default fallback
};

/**
 * Request withdrawal
 */
export const requestWithdrawal = async (
  referrerId: string,
  amount: number,
  method: "paypal" | "bank" | "upi",
  details: any,
): Promise<{ success: boolean; message: string }> => {
  try {
    const referralRef = doc(db, "referrals", referrerId);
    const referralDoc = await getDoc(referralRef);

    if (!referralDoc.exists()) {
      return { success: false, message: "Referral data not found" };
    }

    const data = referralDoc.data();
    const availableBalance = data.availableBalance || 0;

    if (amount > availableBalance) {
      return { success: false, message: "Insufficient available balance" };
    }

    // Get minimum withdrawal amount from settings
    const minWithdrawal = await getMinWithdrawalAmount();
    if (amount < minWithdrawal) {
      return {
        success: false,
        message: `Minimum withdrawal amount is $${minWithdrawal}`,
      };
    }

    const withdrawalId = `withdrawal_${referrerId}_${Date.now()}`;

    const withdrawal = {
      id: withdrawalId,
      amount: amount,
      method: method,
      details: details,
      status: "pending" as const,
      requestDate: new Date().toISOString(),
    };

    await updateDoc(referralRef, {
      withdrawals: arrayUnion(withdrawal),
      availableBalance: increment(-amount),
      updatedAt: new Date().toISOString(),
    });

    // Send notification to user about withdrawal request
    await notifyWithdrawalRequested(referrerId, amount, method, withdrawalId);

    return {
      success: true,
      message: "Withdrawal request submitted successfully",
    };
  } catch (error) {
    console.error("Error requesting withdrawal:", error);
    return {
      success: false,
      message: "Failed to process withdrawal request",
    };
  }
};

/**
 * Complete withdrawal (admin function)
 */
export const completeWithdrawal = async (
  referrerId: string,
  withdrawalId: string,
): Promise<void> => {
  try {
    const referralRef = doc(db, "referrals", referrerId);
    const referralDoc = await getDoc(referralRef);

    if (referralDoc.exists()) {
      const data = referralDoc.data();
      const withdrawals = data.withdrawals || [];

      const updatedWithdrawals = withdrawals.map((withdrawal: any) => {
        if (withdrawal.id === withdrawalId && withdrawal.status === "pending") {
          return {
            ...withdrawal,
            status: "completed",
            completedDate: new Date().toISOString(),
          };
        }
        return withdrawal;
      });

      const withdrawal = withdrawals.find((w: any) => w.id === withdrawalId);
      if (withdrawal && withdrawal.status === "pending") {
        await updateDoc(referralRef, {
          withdrawals: updatedWithdrawals,
          totalWithdrawn: increment(withdrawal.amount),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error("Error completing withdrawal:", error);
    throw error;
  }
};

/**
 * Get earnings summary
 */
export const getEarningsSummary = (referralData: ReferralData) => {
  const monthlyEarnings = referralData.earnings
    .filter((e) => e.subscriptionType === "monthly")
    .reduce((sum, e) => sum + e.commission, 0);

  const yearlyEarnings = referralData.earnings
    .filter((e) => e.subscriptionType === "yearly")
    .reduce((sum, e) => sum + e.commission, 0);

  const pendingEarnings = referralData.earnings
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + e.commission, 0);

  const completedEarnings = referralData.earnings
    .filter((e) => e.status === "completed")
    .reduce((sum, e) => sum + e.commission, 0);

  return {
    totalEarnings: referralData.totalEarnings,
    availableBalance: referralData.availableBalance,
    pendingBalance: referralData.pendingBalance,
    totalWithdrawn: referralData.totalWithdrawn,
    monthlyEarnings,
    yearlyEarnings,
    pendingEarnings,
    completedEarnings,
    totalReferrals: referralData.referralCount,
    subscribedReferrals: referralData.referrals.filter((r) => r.subscription)
      .length,
  };
};

/**
 * Validate referral code format
 */
export const validateReferralCode = (code: string): boolean => {
  // Check if code matches expected format (letters and numbers, 5-12 chars)
  const regex = /^[A-Z0-9]{5,12}$/;
  return regex.test(code.toUpperCase());
};

/**
 * Generate referral link for a user
 */
export const generateReferralLink = (
  referralCode: string,
  baseUrl?: string,
): string => {
  const base =
    baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/signup?ref=${referralCode}`;
};

/**
 * Award bonus to referrer (for future implementation)
 */
export const awardReferralBonus = async (
  referrerId: string,
  bonusAmount: number,
): Promise<void> => {
  try {
    const referralRef = doc(db, "referrals", referrerId);
    await updateDoc(referralRef, {
      totalEarnings: increment(bonusAmount),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error awarding referral bonus:", error);
    throw error;
  }
};
