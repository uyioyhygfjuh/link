import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  doc,
} from "firebase/firestore";

// GET /api/noob/notifications - Get all notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitCount = parseInt(searchParams.get("limit") || "100");
    const type = searchParams.get("type") || "";

    const notificationsRef = collection(db, "notifications");
    let q = query(notificationsRef, orderBy("createdAt", "desc"), limit(limitCount));

    if (type) {
      q = query(
        notificationsRef,
        where("type", "==", type),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get stats
    const allNotificationsSnapshot = await getDocs(notificationsRef);
    const typeBreakdown: { [key: string]: number } = {};
    let readCount = 0;
    let unreadCount = 0;

    allNotificationsSnapshot.forEach((doc) => {
      const data = doc.data();
      const notifType = data.type || "unknown";
      typeBreakdown[notifType] = (typeBreakdown[notifType] || 0) + 1;

      if (data.read) readCount++;
      else unreadCount++;
    });

    return NextResponse.json({
      notifications,
      stats: {
        total: allNotificationsSnapshot.size,
        readCount,
        unreadCount,
        typeBreakdown,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// POST /api/noob/notifications - Send notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, type, title, message, targetAudience, userIds, userId } = body;

    if (action === "broadcast") {
      // Send to multiple users based on target audience
      const usersRef = collection(db, "users");
      let targetUsers: string[] = [];

      if (targetAudience === "all") {
        const snapshot = await getDocs(usersRef);
        targetUsers = snapshot.docs.map((doc) => doc.id);
      } else if (targetAudience === "trial") {
        const snapshot = await getDocs(
          query(usersRef, where("planStatus", "==", "Trial"))
        );
        targetUsers = snapshot.docs.map((doc) => doc.id);
      } else if (targetAudience === "active") {
        const snapshot = await getDocs(
          query(usersRef, where("planStatus", "==", "Active"))
        );
        targetUsers = snapshot.docs.map((doc) => doc.id);
      } else if (targetAudience === "admins") {
        const snapshot = await getDocs(
          query(usersRef, where("isAdmin", "==", true))
        );
        targetUsers = snapshot.docs.map((doc) => doc.id);
      } else if (targetAudience === "plan") {
        const plan = body.plan || "";
        const snapshot = await getDocs(usersRef);
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.plan && data.plan.toLowerCase().includes(plan.toLowerCase())) {
            targetUsers.push(doc.id);
          }
        });
      } else if (targetAudience === "specific" && userIds) {
        targetUsers = userIds;
      }

      // Create notifications for all target users
      const notificationsRef = collection(db, "notifications");
      let sentCount = 0;

      for (const targetUserId of targetUsers) {
        await addDoc(notificationsRef, {
          userId: targetUserId,
          type: type || "admin_broadcast",
          title: title,
          message: message,
          read: false,
          createdAt: new Date().toISOString(),
          source: "admin",
        });
        sentCount++;
      }

      return NextResponse.json({
        success: true,
        message: `Notification sent to ${sentCount} users`,
        sentCount,
      });
    }

    if (action === "send_single") {
      // Send to a specific user
      if (!userId) {
        return NextResponse.json(
          { error: "Missing userId" },
          { status: 400 }
        );
      }

      const notificationsRef = collection(db, "notifications");
      await addDoc(notificationsRef, {
        userId,
        type: type || "admin_message",
        title: title,
        message: message,
        read: false,
        createdAt: new Date().toISOString(),
        source: "admin",
      });

      return NextResponse.json({
        success: true,
        message: "Notification sent successfully",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}

// DELETE /api/noob/notifications - Cleanup old notifications
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "cleanup";
    const notificationId = searchParams.get("id");

    if (action === "single" && notificationId) {
      // Delete single notification
      await deleteDoc(doc(db, "notifications", notificationId));
      return NextResponse.json({
        success: true,
        message: "Notification deleted",
      });
    }

    if (action === "cleanup") {
      // Delete notifications older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const notificationsRef = collection(db, "notifications");
      const snapshot = await getDocs(notificationsRef);

      let deletedCount = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.createdAt) {
          const createdDate = new Date(data.createdAt);
          if (createdDate < thirtyDaysAgo) {
            await deleteDoc(docSnap.ref);
            deletedCount++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedCount} old notifications`,
        deletedCount,
      });
    }

    if (action === "all_read") {
      // Delete all read notifications
      const notificationsRef = collection(db, "notifications");
      const snapshot = await getDocs(
        query(notificationsRef, where("read", "==", true))
      );

      let deletedCount = 0;

      for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref);
        deletedCount++;
      }

      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedCount} read notifications`,
        deletedCount,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error deleting notifications:", error);
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 }
    );
  }
}
