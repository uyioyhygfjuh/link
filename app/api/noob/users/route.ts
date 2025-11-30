import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";

// GET /api/noob/users - Get all users with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "25");
    const plan = searchParams.get("plan") || "all";
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";
    const adminOnly = searchParams.get("adminOnly") === "true";

    // Fetch all plans to create a lookup map
    const plansRef = collection(db, "plans");
    const plansSnapshot = await getDocs(plansRef);
    const plansMap: { [key: string]: string } = {};
    plansSnapshot.docs.forEach((planDoc) => {
      const planData = planDoc.data();
      plansMap[planDoc.id] = planData.name || planDoc.id;
    });

    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    const now = new Date();

    let users = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const planId = data.planId || "";
      
      // Get plan name from plans collection, fallback to stored plan name
      let planName = data.plan || "Free Trial";
      if (planId && plansMap[planId]) {
        planName = plansMap[planId];
      }
      
      // Use explicitly set status - respect admin changes
      const storedStatus = data.planStatus || "Trial";
      let calculatedStatus = storedStatus;
      const trialEndStr = data.trialEnd || "";
      const renewalDateStr = data.renewalDate || "";
      
      // Only auto-calculate if status is "Trial" and trial has ended
      if (storedStatus === "Trial" && trialEndStr) {
        const trialEndDate = new Date(trialEndStr);
        if (now > trialEndDate) {
          // Trial has ended
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
          calculatedStatus = "Expired";
        }
      }
      
      // Preserve explicitly set statuses (Active, Canceled, Expired)
      if (storedStatus === "Active" || storedStatus === "Canceled" || storedStatus === "cancelled" || storedStatus === "Expired") {
        if (storedStatus !== "Active" || calculatedStatus === "Active") {
          calculatedStatus = storedStatus === "cancelled" ? "Canceled" : storedStatus;
        }
      }
      
      // Calculate renewal date if not set
      let renewalDate = renewalDateStr;
      if (!renewalDate && data.createdAt && planId && planId !== "free" && calculatedStatus === "Active") {
        const startDate = new Date(data.planStartDate || data.createdAt);
        const nextRenewal = new Date(startDate);
        const period = data.subscriptionPeriod || "monthly";
        
        while (nextRenewal <= now) {
          if (period === "yearly") {
            nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
          } else {
            nextRenewal.setMonth(nextRenewal.getMonth() + 1);
          }
        }
        renewalDate = nextRenewal.toISOString();
      }
      
      return {
        id: docSnap.id,
        fullName: data.fullName || data.displayName || "Unknown",
        email: data.email || "",
        photoURL: data.photoURL || "",
        plan: planName,
        planStatus: calculatedStatus,
        planId: planId,
        trialStart: data.trialStart || "",
        trialEnd: data.trialEnd || "",
        renewalDate: renewalDate,
        isAdmin: data.isAdmin || false,
        emailAlerts: data.emailAlerts || false,
        weeklyReports: data.weeklyReports || false,
        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || "",
        lastLogin: data.lastLogin || "",
      };
    });

    // Apply filters
    if (plan !== "all") {
      users = users.filter((u) =>
        u.plan.toLowerCase().includes(plan.toLowerCase())
      );
    }
    if (status !== "all") {
      users = users.filter(
        (u) => u.planStatus.toLowerCase() === status.toLowerCase()
      );
    }
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.fullName.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
      );
    }
    if (adminOnly) {
      users = users.filter((u) => u.isAdmin);
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

    return NextResponse.json({
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// PATCH /api/noob/users - Update a user
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, updates, adminId } = body;

    if (!userId || !updates) {
      return NextResponse.json(
        { error: "Missing userId or updates" },
        { status: 400 }
      );
    }

    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Filter allowed updates
    const allowedFields = [
      "plan",
      "planStatus",
      "planId",
      "trialEnd",
      "renewalDate",
      "isAdmin",
      "emailAlerts",
      "weeklyReports",
    ];

    const filteredUpdates: { [key: string]: any } = {};
    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    filteredUpdates.updatedAt = new Date().toISOString();

    await updateDoc(userRef, filteredUpdates);

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/noob/users - Delete a user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

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
