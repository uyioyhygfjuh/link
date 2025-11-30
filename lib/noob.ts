import { db } from "./firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";

// Admin User Interface
export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  photoURL?: string;
  isAdmin: boolean;
  createdAt: string;
  lastLogin?: string;
}

// Admin Action Log Interface
export interface AdminActionLog {
  id?: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: "user" | "subscription" | "referral" | "withdrawal" | "notification" | "system";
  targetId?: string;
  details: any;
  timestamp: string;
}

// Cache for admin status checks (reduces Firestore reads)
const adminCache = new Map<string, { isAdmin: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a user is an admin
 */
export const isAdmin = async (userId: string): Promise<boolean> => {
  try {
    // Check cache first
    const cached = adminCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.isAdmin;
    }

    const userDoc = await getDoc(doc(db, "users", userId));
    
    if (!userDoc.exists()) {
      adminCache.set(userId, { isAdmin: false, timestamp: Date.now() });
      return false;
    }

    const userData = userDoc.data();
    const adminStatus = userData.isAdmin === true;
    
    // Update cache
    adminCache.set(userId, { isAdmin: adminStatus, timestamp: Date.now() });
    
    return adminStatus;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
};

/**
 * Require admin access - throws error if not admin
 */
export const requireAdmin = async (userId: string): Promise<void> => {
  const adminStatus = await isAdmin(userId);
  if (!adminStatus) {
    throw new Error("Admin access required");
  }
};

/**
 * Get list of all admin users
 */
export const getAdminUsers = async (): Promise<AdminUser[]> => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("isAdmin", "==", true));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        fullName: data.fullName || data.displayName || "Unknown",
        email: data.email || "",
        photoURL: data.photoURL || "",
        isAdmin: true,
        createdAt: data.createdAt || "",
        lastLogin: data.lastLogin || "",
      };
    });
  } catch (error) {
    console.error("Error getting admin users:", error);
    return [];
  }
};

/**
 * Grant or revoke admin role
 */
export const setAdminRole = async (
  userId: string,
  makeAdmin: boolean,
  adminId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { success: false, message: "User not found" };
    }

    await updateDoc(userRef, {
      isAdmin: makeAdmin,
      updatedAt: new Date().toISOString(),
    });

    // Invalidate cache
    adminCache.delete(userId);

    // Log the action
    await logAdminAction(adminId, {
      action: makeAdmin ? "grant_admin" : "revoke_admin",
      targetType: "user",
      targetId: userId,
      details: {
        userId,
        email: userDoc.data().email,
        previousStatus: userDoc.data().isAdmin || false,
        newStatus: makeAdmin,
      },
    });

    return {
      success: true,
      message: `Admin role ${makeAdmin ? "granted" : "revoked"} successfully`,
    };
  } catch (error) {
    console.error("Error setting admin role:", error);
    return { success: false, message: "Failed to update admin role" };
  }
};

/**
 * Log admin actions for audit trail
 */
export const logAdminAction = async (
  adminId: string,
  action: Omit<AdminActionLog, "id" | "adminId" | "adminEmail" | "timestamp">
): Promise<void> => {
  try {
    // Get admin email
    const adminDoc = await getDoc(doc(db, "users", adminId));
    const adminEmail = adminDoc.exists() ? adminDoc.data().email : "unknown";

    await addDoc(collection(db, "adminLogs"), {
      adminId,
      adminEmail,
      ...action,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error logging admin action:", error);
  }
};

/**
 * Get admin action logs
 */
export const getAdminLogs = async (
  limitCount: number = 100,
  filterAdminId?: string
): Promise<AdminActionLog[]> => {
  try {
    const logsRef = collection(db, "adminLogs");
    let q = query(logsRef, orderBy("timestamp", "desc"), limit(limitCount));

    if (filterAdminId) {
      q = query(
        logsRef,
        where("adminId", "==", filterAdminId),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AdminActionLog[];
  } catch (error) {
    console.error("Error getting admin logs:", error);
    return [];
  }
};

/**
 * Clear admin cache (useful after role changes)
 */
export const clearAdminCache = (userId?: string): void => {
  if (userId) {
    adminCache.delete(userId);
  } else {
    adminCache.clear();
  }
};

// Dashboard Statistics Interfaces
export interface DashboardStats {
  totalUsers: number;
  usersByPlan: {
    trial: number;
    basic: number;
    pro: number;
    enterprise: number;
  };
  activeSubscriptions: number;
  totalRevenue: number;
  mrrValue: number;
  arrValue: number;
  pendingWithdrawals: number;
  totalWithdrawalAmount: number;
  totalChannels: number;
  totalScans: number;
  scansLast30Days: number;
}

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    // Get users stats
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);
    
    let totalUsers = 0;
    const usersByPlan = { trial: 0, basic: 0, pro: 0, enterprise: 0 };
    let activeSubscriptions = 0;

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      totalUsers++;
      
      const plan = (data.plan || "Free Trial").toLowerCase();
      if (plan.includes("basic")) usersByPlan.basic++;
      else if (plan.includes("pro")) usersByPlan.pro++;
      else if (plan.includes("enterprise")) usersByPlan.enterprise++;
      else usersByPlan.trial++;

      if (data.planStatus === "Active") activeSubscriptions++;
    });

    // Get payments/revenue stats
    const paymentsRef = collection(db, "payments");
    const paymentsSnapshot = await getDocs(query(paymentsRef, where("status", "==", "succeeded")));
    
    let totalRevenue = 0;
    let mrrValue = 0;
    let arrValue = 0;

    paymentsSnapshot.forEach((doc) => {
      const data = doc.data();
      const amount = data.amount || 0;
      totalRevenue += amount;
      
      if (data.cycle === "monthly") mrrValue += amount;
      else if (data.cycle === "yearly") arrValue += amount;
    });

    // Get pending withdrawals
    const referralsRef = collection(db, "referrals");
    const referralsSnapshot = await getDocs(referralsRef);
    
    let pendingWithdrawals = 0;
    let totalWithdrawalAmount = 0;

    referralsSnapshot.forEach((doc) => {
      const data = doc.data();
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

    // Get scans from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let scansLast30Days = 0;
    scansSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt || data.startedAt;
      if (createdAt) {
        const scanDate = new Date(createdAt);
        if (scanDate >= thirtyDaysAgo) scansLast30Days++;
      }
    });

    return {
      totalUsers,
      usersByPlan,
      activeSubscriptions,
      totalRevenue,
      mrrValue,
      arrValue,
      pendingWithdrawals,
      totalWithdrawalAmount,
      totalChannels,
      totalScans,
      scansLast30Days,
    };
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    return {
      totalUsers: 0,
      usersByPlan: { trial: 0, basic: 0, pro: 0, enterprise: 0 },
      activeSubscriptions: 0,
      totalRevenue: 0,
      mrrValue: 0,
      arrValue: 0,
      pendingWithdrawals: 0,
      totalWithdrawalAmount: 0,
      totalChannels: 0,
      totalScans: 0,
      scansLast30Days: 0,
    };
  }
};

// User Management
export interface AdminUserDetails {
  id: string;
  fullName: string;
  email: string;
  photoURL?: string;
  plan: string;
  planStatus: string;
  planId?: string;
  trialStart?: string;
  trialEnd?: string;
  renewalDate?: string;
  isAdmin: boolean;
  emailAlerts: boolean;
  weeklyReports: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
}

/**
 * Get all users with pagination
 */
export const getAllUsers = async (
  page: number = 1,
  pageSize: number = 25,
  filters?: {
    plan?: string;
    status?: string;
    search?: string;
    isAdmin?: boolean;
  }
): Promise<{ users: AdminUserDetails[]; total: number }> => {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    let users: AdminUserDetails[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        fullName: data.fullName || data.displayName || "Unknown",
        email: data.email || "",
        photoURL: data.photoURL || "",
        plan: data.plan || "Free Trial",
        planStatus: data.planStatus || "Trial",
        planId: data.planId || "",
        trialStart: data.trialStart || "",
        trialEnd: data.trialEnd || "",
        renewalDate: data.renewalDate || "",
        isAdmin: data.isAdmin || false,
        emailAlerts: data.emailAlerts || false,
        weeklyReports: data.weeklyReports || false,
        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || "",
        lastLogin: data.lastLogin || "",
      };
    });

    // Apply filters
    if (filters) {
      if (filters.plan && filters.plan !== "all") {
        users = users.filter((u) =>
          u.plan.toLowerCase().includes(filters.plan!.toLowerCase())
        );
      }
      if (filters.status && filters.status !== "all") {
        users = users.filter(
          (u) => u.planStatus.toLowerCase() === filters.status!.toLowerCase()
        );
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        users = users.filter(
          (u) =>
            u.fullName.toLowerCase().includes(search) ||
            u.email.toLowerCase().includes(search)
        );
      }
      if (filters.isAdmin !== undefined) {
        users = users.filter((u) => u.isAdmin === filters.isAdmin);
      }
    }

    // Sort by createdAt descending
    users.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime() || 0;
      const dateB = new Date(b.createdAt).getTime() || 0;
      return dateB - dateA;
    });

    const total = users.length;

    // Apply pagination
    const startIndex = (page - 1) * pageSize;
    users = users.slice(startIndex, startIndex + pageSize);

    return { users, total };
  } catch (error) {
    console.error("Error getting all users:", error);
    return { users: [], total: 0 };
  }
};

/**
 * Get single user details
 */
export const getUserDetails = async (
  userId: string
): Promise<AdminUserDetails | null> => {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));

    if (!userDoc.exists()) {
      return null;
    }

    const data = userDoc.data();
    return {
      id: userDoc.id,
      fullName: data.fullName || data.displayName || "Unknown",
      email: data.email || "",
      photoURL: data.photoURL || "",
      plan: data.plan || "Free Trial",
      planStatus: data.planStatus || "Trial",
      planId: data.planId || "",
      trialStart: data.trialStart || "",
      trialEnd: data.trialEnd || "",
      renewalDate: data.renewalDate || "",
      isAdmin: data.isAdmin || false,
      emailAlerts: data.emailAlerts || false,
      weeklyReports: data.weeklyReports || false,
      createdAt: data.createdAt || "",
      updatedAt: data.updatedAt || "",
      lastLogin: data.lastLogin || "",
    };
  } catch (error) {
    console.error("Error getting user details:", error);
    return null;
  }
};

/**
 * Update user data (admin action)
 */
export const updateUserAsAdmin = async (
  userId: string,
  updates: Partial<AdminUserDetails>,
  adminId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { success: false, message: "User not found" };
    }

    const allowedUpdates: { [key: string]: any } = {};
    const fieldsToUpdate = [
      "plan",
      "planStatus",
      "planId",
      "trialEnd",
      "renewalDate",
      "isAdmin",
      "emailAlerts",
      "weeklyReports",
    ];

    fieldsToUpdate.forEach((field) => {
      if (field in updates) {
        allowedUpdates[field] = (updates as any)[field];
      }
    });

    allowedUpdates.updatedAt = new Date().toISOString();

    await updateDoc(userRef, allowedUpdates);

    // Log the action
    await logAdminAction(adminId, {
      action: "update_user",
      targetType: "user",
      targetId: userId,
      details: {
        previousData: userDoc.data(),
        updates: allowedUpdates,
      },
    });

    return { success: true, message: "User updated successfully" };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, message: "Failed to update user" };
  }
};

/**
 * Extend user's trial period
 */
export const extendUserTrial = async (
  userId: string,
  daysToExtend: number,
  adminId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { success: false, message: "User not found" };
    }

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

    // Log the action
    await logAdminAction(adminId, {
      action: "extend_trial",
      targetType: "user",
      targetId: userId,
      details: {
        previousTrialEnd: userData.trialEnd,
        newTrialEnd: newTrialEnd.toISOString(),
        daysExtended: daysToExtend,
      },
    });

    return {
      success: true,
      message: `Trial extended by ${daysToExtend} days`,
    };
  } catch (error) {
    console.error("Error extending trial:", error);
    return { success: false, message: "Failed to extend trial" };
  }
};
