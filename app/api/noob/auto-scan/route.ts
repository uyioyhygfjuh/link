import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  query,
  where,
  writeBatch,
  addDoc,
} from "firebase/firestore";
import { notifyAutoScanStarted, notifyAutoScanCompleted } from "@/lib/notifications";

// Default auto-scan settings
const DEFAULT_AUTO_SCAN_SETTINGS = {
  enabledPlans: [] as string[],
  planLimits: {} as Record<string, { 
    maxVideosPerScan: number | "unlimited";
    maxChannels: number | "unlimited";
    maxScansPerChannel: number | "unlimited";
    allowedFrequencies: string[];
  }>,
  lastGlobalScan: null as string | null,
  enabled: true,
};

// Default plan config for plans not explicitly configured
const DEFAULT_PLAN_CONFIG = {
  maxVideosPerScan: 50,
  maxChannels: 1,
  maxScansPerChannel: 10,
  allowedFrequencies: ["weekly"],
};

// Helper function to get auto-scan settings
async function getAutoScanSettings() {
  const settingsRef = doc(db, "settings", "autoScan");
  const settingsDoc = await getDoc(settingsRef);
  return settingsDoc.exists() ? settingsDoc.data() : DEFAULT_AUTO_SCAN_SETTINGS;
}

// Helper function to get user's plan and check if auto-scan is allowed
async function getUserPlanLimits(userId: string) {
  // Get user data
  const userRef = doc(db, "users", userId);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) {
    return { allowed: false, error: "User not found", limits: null, planId: null };
  }
  
  const userData = userDoc.data();
  const planId = userData.planId || "free";
  
  // Get auto-scan settings
  const settings = await getAutoScanSettings();
  
  // Check if plan is enabled for auto-scan
  const enabledPlans = settings.enabledPlans || [];
  if (!enabledPlans.includes(planId)) {
    return { 
      allowed: false, 
      error: `Auto-scan is not available for the ${userData.plan || planId} plan`, 
      limits: null,
      planId 
    };
  }
  
  // Get plan-specific limits
  const planLimits = settings.planLimits?.[planId] || DEFAULT_PLAN_CONFIG;
  
  return { allowed: true, limits: planLimits, planId, error: null };
}

// Helper function to count user's channels with auto-scan enabled
async function countUserAutoScanChannels(userId: string): Promise<number> {
  const channelsRef = collection(db, "channels");
  const q = query(channelsRef, where("userId", "==", userId), where("autoScanEnabled", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.size;
}

// GET - Fetch auto-scan settings or users with auto-scan status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "settings";

    if (type === "settings") {
      // Get auto-scan settings
      const settingsRef = doc(db, "settings", "autoScan");
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        return NextResponse.json({
          success: true,
          settings: settingsDoc.data(),
        });
      }

      // Return defaults if not set
      return NextResponse.json({
        success: true,
        settings: DEFAULT_AUTO_SCAN_SETTINGS,
      });
    }

    if (type === "users") {
      // Get all users with their auto-scan status
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      // Get channels for each user
      const channelsRef = collection(db, "channels");
      const channelsSnapshot = await getDocs(channelsRef);

      // Create a map of user channels
      const userChannelsMap: Record<string, any[]> = {};
      channelsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const channel = { id: docSnap.id, ...data };
        const userId = data.userId;
        if (userId) {
          if (!userChannelsMap[userId]) {
            userChannelsMap[userId] = [];
          }
          userChannelsMap[userId].push(channel);
        }
      });

      // Get auto-scan settings once for all users
      const settings = await getAutoScanSettings();
      const enabledPlans = settings.enabledPlans || [];

      const users = usersSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const channels = userChannelsMap[docSnap.id] || [];
        const autoScanEnabled = channels.some((ch: any) => ch.autoScanEnabled);
        const autoScanChannels = channels.filter((ch: any) => ch.autoScanEnabled);

        // Get next auto-scan time based on frequency
        const getNextScanTime = (ch: any) => {
          if (!ch.autoScanEnabled || !ch.autoScanFrequency) return null;
          const lastScan = ch.lastAutoScan ? new Date(ch.lastAutoScan) : new Date();
          const freq = ch.autoScanFrequency;
          if (freq === "daily") lastScan.setDate(lastScan.getDate() + 1);
          else if (freq === "weekly") lastScan.setDate(lastScan.getDate() + 7);
          else if (freq === "monthly") lastScan.setMonth(lastScan.getMonth() + 1);
          return lastScan.toISOString();
        };

        // Get plan limits for this user
        const planId = data.planId || "free";
        const planLimits = settings.planLimits?.[planId] || DEFAULT_PLAN_CONFIG;
        const autoScanAllowed = enabledPlans.includes(planId);

        return {
          id: docSnap.id,
          fullName: data.fullName || data.displayName || "Unknown",
          email: data.email,
          plan: data.plan || "Free Trial",
          planId: planId,
          planStatus: data.planStatus || "Trial",
          createdAt: data.createdAt || null,
          channelCount: channels.length,
          autoScanEnabled,
          autoScanChannelCount: autoScanChannels.length,
          autoScanFrequency: data.autoScanFrequency || "weekly",
          nextAutoScan: autoScanChannels.length > 0 ? getNextScanTime(autoScanChannels[0]) : null,
          // Plan limits info
          autoScanAllowed,
          planLimits: autoScanAllowed ? {
            maxVideosPerScan: planLimits.maxVideosPerScan,
            maxChannels: planLimits.maxChannels,
            maxScansPerChannel: planLimits.maxScansPerChannel,
            allowedFrequencies: planLimits.allowedFrequencies,
          } : null,
          channels: channels.map((ch: any) => ({
            id: ch.id,
            name: ch.name || ch.channelName,
            channelId: ch.channelId,
            autoScanEnabled: ch.autoScanEnabled || false,
            autoScanFrequency: ch.autoScanFrequency || "weekly",
            lastAutoScan: ch.lastAutoScan || null,
            nextAutoScan: getNextScanTime(ch),
            autoScanVideos: ch.autoScanVideos || 50,
          })),
        };
      });

      // Filter to only include users whose plan is enabled for auto-scan
      const eligibleUsers = users.filter((u) => u.autoScanAllowed);

      // Sort by auto-scan enabled status
      eligibleUsers.sort((a, b) => {
        if (a.autoScanEnabled && !b.autoScanEnabled) return -1;
        if (!a.autoScanEnabled && b.autoScanEnabled) return 1;
        return b.channelCount - a.channelCount;
      });

      // Get scan logs for accurate stats
      const logsRef = collection(db, "autoScanLogs");
      const logsSnapshot = await getDocs(logsRef);
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      let scansToday = 0;
      let scansThisWeek = 0;
      let scansThisMonth = 0;
      
      logsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const scanDate = data.triggeredAt ? new Date(data.triggeredAt) : null;
        if (scanDate) {
          if (scanDate >= todayStart) scansToday++;
          if (scanDate >= weekStart) scansThisWeek++;
          if (scanDate >= monthStart) scansThisMonth++;
        }
      });

      // Count users per enabled plan
      const planUserCounts: Record<string, number> = {};
      enabledPlans.forEach((planId: string) => {
        planUserCounts[planId] = eligibleUsers.filter((u) => u.planId === planId).length;
      });

      return NextResponse.json({
        success: true,
        users: eligibleUsers,
        enabledPlans,
        planUserCounts,
        stats: {
          totalUsers: eligibleUsers.length,
          usersWithAutoScan: eligibleUsers.filter((u) => u.autoScanEnabled).length,
          totalAutoScanChannels: eligibleUsers.reduce((acc, u) => acc + u.autoScanChannelCount, 0),
          scansToday,
          scansThisWeek,
          scansThisMonth,
        },
      });
    }

    if (type === "logs") {
      // Get auto-scan logs
      const logsRef = collection(db, "autoScanLogs");
      const logsSnapshot = await getDocs(logsRef);

      const logs = logsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort by date descending
      logs.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return NextResponse.json({
        success: true,
        logs: logs.slice(0, 100), // Last 100 logs
      });
    }

    if (type === "activeScans") {
      // Get channels with active scans (scanStatus === 'scanning')
      const channelsRef = collection(db, "channels");
      const channelsSnapshot = await getDocs(channelsRef);
      
      const activeScans: any[] = [];
      
      channelsSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.scanStatus === 'scanning') {
          activeScans.push({
            channelId: docSnap.id,
            firestoreId: docSnap.id,
            channelName: data.channelName || data.name || 'Unknown',
            userId: data.userId,
            scanStartedAt: data.scanStartedAt,
            scanProgress: data.scanProgress || 0,
            videosToScan: data.videosBeingScanned || data.autoScanVideos || 50,
          });
        }
      });

      return NextResponse.json({
        success: true,
        activeScans,
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching auto-scan data:", error);
    return NextResponse.json(
      { error: "Failed to fetch auto-scan data" },
      { status: 500 }
    );
  }
}

// POST - Update auto-scan settings or toggle user auto-scan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "updateSettings") {
      // Update global auto-scan settings
      const { settings } = body;
      const settingsRef = doc(db, "settings", "autoScan");

      await setDoc(settingsRef, {
        ...settings,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      console.log("✅ Auto-scan settings updated:", settings);

      return NextResponse.json({
        success: true,
        message: "Auto-scan settings updated successfully",
      });
    }

    if (action === "toggleUserAutoScan") {
      // Toggle auto-scan for a specific user's channels
      const { userId, enabled, channelIds, bypassLimits } = body;

      if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
      }

      // Only enforce limits if enabling auto-scan (not when disabling)
      let maxChannelsToEnable = Infinity;
      let planLimits: any = null;
      
      if (enabled && !bypassLimits) {
        // Check user's plan limits
        const { allowed, error, limits, planId } = await getUserPlanLimits(userId);
        
        if (!allowed) {
          return NextResponse.json({ 
            error: error || "Auto-scan not available for this plan",
            planId 
          }, { status: 403 });
        }
        
        planLimits = limits;
        
        // Calculate how many more channels can be enabled
        if (limits && limits.maxChannels !== "unlimited") {
          const currentAutoScanCount = await countUserAutoScanChannels(userId);
          maxChannelsToEnable = Math.max(0, (limits.maxChannels as number) - currentAutoScanCount);
          
          if (maxChannelsToEnable === 0) {
            return NextResponse.json({ 
              error: `Maximum auto-scan channels (${limits.maxChannels}) already reached for this plan`,
              currentCount: currentAutoScanCount,
              maxAllowed: limits.maxChannels
            }, { status: 403 });
          }
        }
      }

      const batch = writeBatch(db);

      // Get user's channels
      const channelsRef = collection(db, "channels");
      const userChannelsQuery = query(channelsRef, where("userId", "==", userId));
      const channelsSnapshot = await getDocs(userChannelsQuery);

      let updatedCount = 0;
      let skippedCount = 0;
      
      channelsSnapshot.forEach((channelDoc) => {
        const channelData = channelDoc.data();
        
        // If specific channel IDs provided, only update those
        if (channelIds && channelIds.length > 0) {
          if (channelIds.includes(channelDoc.id)) {
            // Check if we can enable more channels
            if (enabled && !channelData.autoScanEnabled && updatedCount >= maxChannelsToEnable) {
              skippedCount++;
              return;
            }
            
            const updateData: any = { autoScanEnabled: enabled };
            
            // Set default frequency based on plan if enabling
            if (enabled && planLimits?.allowedFrequencies?.length > 0) {
              updateData.autoScanFrequency = channelData.autoScanFrequency || planLimits.allowedFrequencies[0];
            }
            
            batch.update(channelDoc.ref, updateData);
            updatedCount++;
          }
        } else {
          // Check if we can enable more channels
          if (enabled && !channelData.autoScanEnabled && updatedCount >= maxChannelsToEnable) {
            skippedCount++;
            return;
          }
          
          const updateData: any = { autoScanEnabled: enabled };
          
          // Set default frequency based on plan if enabling
          if (enabled && planLimits?.allowedFrequencies?.length > 0) {
            updateData.autoScanFrequency = channelData.autoScanFrequency || planLimits.allowedFrequencies[0];
          }
          
          batch.update(channelDoc.ref, updateData);
          updatedCount++;
        }
      });

      await batch.commit();

      console.log(`✅ Auto-scan ${enabled ? "enabled" : "disabled"} for ${updatedCount} channels of user ${userId}`);
      if (skippedCount > 0) {
        console.log(`⚠️ Skipped ${skippedCount} channels due to plan limits`);
      }

      return NextResponse.json({
        success: true,
        message: `Auto-scan ${enabled ? "enabled" : "disabled"} for ${updatedCount} channel(s)${skippedCount > 0 ? ` (${skippedCount} skipped due to plan limits)` : ""}`,
        updatedCount,
        skippedCount,
        planLimits: planLimits ? {
          maxChannels: planLimits.maxChannels,
          maxVideosPerScan: planLimits.maxVideosPerScan,
          allowedFrequencies: planLimits.allowedFrequencies
        } : null
      });
    }

    if (action === "toggleBulkAutoScan") {
      // Toggle auto-scan for multiple users at once
      const { userIds, enabled } = body;

      if (!userIds || userIds.length === 0) {
        return NextResponse.json({ error: "No users selected" }, { status: 400 });
      }

      const batch = writeBatch(db);
      let totalUpdated = 0;

      for (const userId of userIds) {
        const channelsRef = collection(db, "channels");
        const userChannelsQuery = query(channelsRef, where("userId", "==", userId));
        const channelsSnapshot = await getDocs(userChannelsQuery);

        channelsSnapshot.forEach((channelDoc) => {
          batch.update(channelDoc.ref, { autoScanEnabled: enabled });
          totalUpdated++;
        });
      }

      await batch.commit();

      console.log(`✅ Bulk auto-scan ${enabled ? "enabled" : "disabled"} for ${totalUpdated} channels across ${userIds.length} users`);

      return NextResponse.json({
        success: true,
        message: `Auto-scan ${enabled ? "enabled" : "disabled"} for ${totalUpdated} channels across ${userIds.length} users`,
        updatedUsers: userIds.length,
        updatedChannels: totalUpdated,
      });
    }

    if (action === "updateChannelAutoScan") {
      // Update auto-scan settings for a specific channel
      const { channelId, autoScanEnabled, autoScanVideos, autoScanFrequency, bypassLimits } = body;

      if (!channelId) {
        return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
      }

      // Get channel details to find the user
      const channelRef = doc(db, "channels", channelId);
      const channelDoc = await getDoc(channelRef);
      
      if (!channelDoc.exists()) {
        return NextResponse.json({ error: "Channel not found" }, { status: 404 });
      }
      
      const channelData = channelDoc.data();
      const userId = channelData.userId;
      
      // Only enforce limits if enabling auto-scan (not when disabling)
      // Admin can bypass limits with bypassLimits flag
      if (autoScanEnabled && !bypassLimits) {
        // Check user's plan limits
        const { allowed, error, limits, planId } = await getUserPlanLimits(userId);
        
        if (!allowed) {
          return NextResponse.json({ 
            error: error || "Auto-scan not available for this plan",
            planId 
          }, { status: 403 });
        }
        
        if (limits) {
          // Check max channels limit (only if this channel doesn't already have auto-scan enabled)
          if (!channelData.autoScanEnabled) {
            const currentAutoScanCount = await countUserAutoScanChannels(userId);
            const maxChannels = limits.maxChannels;
            
            if (maxChannels !== "unlimited" && currentAutoScanCount >= maxChannels) {
              return NextResponse.json({ 
                error: `Maximum auto-scan channels (${maxChannels}) reached for this plan`,
                currentCount: currentAutoScanCount,
                maxAllowed: maxChannels
              }, { status: 403 });
            }
          }
          
          // Validate frequency
          const allowedFrequencies = limits.allowedFrequencies || ["weekly"];
          if (autoScanFrequency && !allowedFrequencies.includes(autoScanFrequency)) {
            return NextResponse.json({ 
              error: `Frequency "${autoScanFrequency}" is not allowed for this plan. Allowed: ${allowedFrequencies.join(", ")}`,
              allowedFrequencies
            }, { status: 403 });
          }
          
          // Enforce max videos per scan
          const maxVideos = limits.maxVideosPerScan;
          let enforcedVideoCount = autoScanVideos;
          if (autoScanVideos !== undefined && maxVideos !== "unlimited") {
            enforcedVideoCount = Math.min(autoScanVideos, maxVideos as number);
          }
        }
      }

      const updateData: any = {
        autoScanEnabled: autoScanEnabled ?? false,
        updatedAt: new Date().toISOString(),
      };
      
      // Enforce video limit if set
      if (autoScanVideos !== undefined) {
        const { limits } = await getUserPlanLimits(userId);
        if (limits && limits.maxVideosPerScan !== "unlimited") {
          updateData.autoScanVideos = Math.min(autoScanVideos, limits.maxVideosPerScan as number);
        } else {
          updateData.autoScanVideos = autoScanVideos;
        }
      }
      
      if (autoScanFrequency !== undefined) updateData.autoScanFrequency = autoScanFrequency;
      
      await updateDoc(channelRef, updateData);

      return NextResponse.json({
        success: true,
        message: "Channel auto-scan settings updated",
        enforced: updateData,
      });
    }

    if (action === "triggerImmediateScan") {
      // Trigger immediate scan for selected channels
      const { channelIds } = body;

      if (!channelIds || channelIds.length === 0) {
        return NextResponse.json({ error: "No channels selected" }, { status: 400 });
      }

      const results: any[] = [];
      const errors: any[] = [];

      for (const channelId of channelIds) {
        try {
          // Get channel details
          const channelRef = doc(db, "channels", channelId);
          const channelDoc = await getDoc(channelRef);
          
          if (!channelDoc.exists()) {
            errors.push({ channelId, error: "Channel not found" });
            continue;
          }

          const channelData = channelDoc.data();
          let videosToScan = channelData.autoScanVideos || 50;
          const channelName = channelData.channelName || channelData.name || "Unknown Channel";

          // Enforce plan limits on video count
          if (channelData.userId) {
            const { limits } = await getUserPlanLimits(channelData.userId);
            if (limits && limits.maxVideosPerScan !== "unlimited") {
              videosToScan = Math.min(videosToScan, limits.maxVideosPerScan as number);
            }
          }

          // Mark channel as scanning (persisted in DB for session recovery)
          await updateDoc(channelRef, {
            scanStatus: 'scanning',
            scanStartedAt: new Date().toISOString(),
            videosBeingScanned: videosToScan,
            scanProgress: 0,
          });

          // Send notification that scan has started
          if (channelData.userId) {
            await notifyAutoScanStarted(
              channelData.userId,
              channelName,
              channelData.channelId,
              videosToScan
            );
          }

          // Get the origin from the request headers
          const host = request.headers.get("host") || "localhost:3000";
          const protocol = host.includes("localhost") ? "http" : "https";
          const baseUrl = `${protocol}://${host}`;
          
          console.log(`🔄 Batch scan - Channel: ${channelName}`);
          console.log(`   - Firestore Doc ID: ${channelId}`);
          console.log(`   - Videos to scan (enforced): ${videosToScan}`);
          console.log(`📤 Sending to: ${baseUrl}/api/scan-channel`);
          
          const scanResponse = await fetch(`${baseUrl}/api/scan-channel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channelId: channelData.channelId,
              firestoreDocId: channelId,
              videoCount: videosToScan,
              userId: channelData.userId,
              channelName: channelName,
              isAutoScan: true,
            }),
          });

          const scanResult = await scanResponse.json();

          if (scanResult.success) {
            // Update last auto-scan timestamp and clear scanning status
            await updateDoc(channelRef, {
              lastAutoScan: new Date().toISOString(),
              lastAutoScanStatus: "completed",
              scanStatus: 'idle',
              scanProgress: 100,
              scanCompletedAt: new Date().toISOString(),
            });

            // Send notification that scan has completed
            if (channelData.userId) {
              await notifyAutoScanCompleted(
                channelData.userId,
                channelName,
                channelData.channelId,
                scanResult.scannedVideos || videosToScan,
                scanResult.brokenLinks || 0,
                scanResult.totalLinks || 0
              );
            }

            results.push({
              channelId,
              channelName: channelName,
              status: "completed",
              scannedVideos: scanResult.scannedVideos,
              brokenLinks: scanResult.brokenLinks,
            });
          } else {
            // Clear scanning status on failure
            await updateDoc(channelRef, {
              scanStatus: 'failed',
              lastAutoScanStatus: "failed",
              scanError: scanResult.error || "Scan failed",
            });
            
            errors.push({
              channelId,
              channelName: channelName,
              error: scanResult.error || "Scan failed to start",
            });
          }
        } catch (error: any) {
          console.error(`Error scanning channel ${channelId}:`, error);
          // Try to clear scan status on error
          try {
            const channelRef = doc(db, "channels", channelId);
            await updateDoc(channelRef, {
              scanStatus: 'failed',
              scanError: error.message,
            });
          } catch (e) {
            // Ignore cleanup errors
          }
          errors.push({ channelId, error: error.message });
        }
      }

      // Log the batch scan
      const logsRef = collection(db, "autoScanLogs");
      await addDoc(logsRef, {
        type: "batch_scan",
        triggeredAt: new Date().toISOString(),
        channelsScanned: results.length,
        channelsFailed: errors.length,
        results,
        errors,
        triggeredBy: "admin",
      });

      return NextResponse.json({
        success: true,
        message: `Started scan for ${results.length} channel(s)${errors.length > 0 ? `, ${errors.length} failed` : ""}`,
        results,
        errors,
      });
    }

    if (action === "triggerSingleScan") {
      // Trigger immediate scan for a single channel
      const { channelId, firestoreId } = body;
      const docId = firestoreId || channelId;

      if (!docId) {
        return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
      }

      try {
        // Get channel details
        const channelRef = doc(db, "channels", docId);
        const channelDoc = await getDoc(channelRef);
        
        if (!channelDoc.exists()) {
          return NextResponse.json({ error: "Channel not found" }, { status: 404 });
        }

        const channelData = channelDoc.data();
        let videosToScan = channelData.autoScanVideos || 50;

        const channelName = channelData.channelName || channelData.name || "Unknown Channel";
        
        // Enforce plan limits on video count
        if (channelData.userId) {
          const { limits } = await getUserPlanLimits(channelData.userId);
          if (limits && limits.maxVideosPerScan !== "unlimited") {
            videosToScan = Math.min(videosToScan, limits.maxVideosPerScan as number);
            console.log(`📋 Plan limit enforced: max ${limits.maxVideosPerScan} videos per scan`);
          }
        }
        
        console.log(`🔄 Starting auto-scan for channel: ${channelName}`);
        console.log(`   - Firestore Doc ID: ${docId}`);
        console.log(`   - YouTube Channel ID: ${channelData.channelId}`);
        console.log(`   - User ID: ${channelData.userId}`);
        console.log(`   - Videos to scan: ${videosToScan}`);

        // Mark channel as scanning (persisted in DB for session recovery)
        await updateDoc(channelRef, {
          scanStatus: 'scanning',
          scanStartedAt: new Date().toISOString(),
          videosBeingScanned: videosToScan,
          scanProgress: 0,
        });

        // Send notification that scan has started
        if (channelData.userId) {
          await notifyAutoScanStarted(
            channelData.userId,
            channelName,
            channelData.channelId,
            videosToScan
          );
          console.log(`📢 Sent "scan started" notification to user ${channelData.userId}`);
        }

        // Get the origin from the request headers
        const host = request.headers.get("host") || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const baseUrl = `${protocol}://${host}`;
        
        console.log(`📤 Sending scan request to: ${baseUrl}/api/scan-channel`);
        
        const scanResponse = await fetch(`${baseUrl}/api/scan-channel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: channelData.channelId,
            firestoreDocId: docId,
            videoCount: videosToScan,
            userId: channelData.userId,
            channelName: channelName,
            isAutoScan: true,
          }),
        });
        
        const scanResult = await scanResponse.json();
        console.log(`📡 Scan result:`, scanResult);

        if (scanResult.success) {
          // Update last auto-scan timestamp and clear scanning status
          await updateDoc(channelRef, {
            lastAutoScan: new Date().toISOString(),
            lastAutoScanStatus: "completed",
            scanStatus: 'idle',
            scanProgress: 100,
            scanCompletedAt: new Date().toISOString(),
          });

          // Send notification that scan has completed
          if (channelData.userId) {
            await notifyAutoScanCompleted(
              channelData.userId,
              channelName,
              channelData.channelId,
              scanResult.scannedVideos || videosToScan,
              scanResult.brokenLinks || 0,
              scanResult.totalLinks || 0
            );
            console.log(`📢 Sent "scan completed" notification to user ${channelData.userId}`);
          }

          return NextResponse.json({
            success: true,
            message: `Scan completed for ${channelName}`,
            jobId: scanResult.jobId,
            channelName: channelName,
            firestoreDocId: docId,
            scannedVideos: scanResult.scannedVideos,
            brokenLinks: scanResult.brokenLinks,
            totalLinks: scanResult.totalLinks,
          });
        } else {
          // Clear scanning status on failure
          await updateDoc(channelRef, {
            scanStatus: 'failed',
            lastAutoScanStatus: "failed",
            scanError: scanResult.error || "Scan failed",
          });
          
          console.error(`❌ Scan failed:`, scanResult.error);
          return NextResponse.json({
            success: false,
            error: scanResult.error || "Scan failed to start",
          });
        }
      } catch (error: any) {
        console.error(`❌ Error scanning channel ${docId}:`, error);
        // Try to clear scan status on error
        try {
          const channelRef = doc(db, "channels", docId);
          await updateDoc(channelRef, {
            scanStatus: 'failed',
            scanError: error.message,
          });
        } catch (e) {
          // Ignore cleanup errors
        }
        return NextResponse.json({
          success: false,
          error: error.message || "Scan failed",
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating auto-scan:", error);
    return NextResponse.json(
      { error: "Failed to update auto-scan settings" },
      { status: 500 }
    );
  }
}
