import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";

// POST - Run auto-scan for all eligible channels
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];
  
  const log = (message: string) => {
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${message}`);
    console.log(`[AUTO-SCAN] ${message}`);
  };

  try {
    log("🚀 Starting auto-scan process...");

    // Get auto-scan settings
    const settingsRef = doc(db, "settings", "autoScan");
    const settingsDoc = await getDoc(settingsRef);

    if (!settingsDoc.exists()) {
      log("⚠️ Auto-scan settings not found");
      return NextResponse.json({
        success: false,
        error: "Auto-scan settings not configured",
        logs,
      });
    }

    const settings = settingsDoc.data();

    if (!settings.enabled) {
      log("⚠️ Auto-scan is disabled globally");
      return NextResponse.json({
        success: false,
        error: "Auto-scan is disabled",
        logs,
      });
    }

    const enabledPlans = settings.enabledPlans || [];
    const planLimits = settings.planLimits || {};

    if (enabledPlans.length === 0) {
      log("⚠️ No plans have auto-scan enabled");
      return NextResponse.json({
        success: false,
        error: "No plans configured for auto-scan",
        logs,
      });
    }

    log(`📋 Enabled plans: ${enabledPlans.join(", ")}`);

    // Get all channels with auto-scan enabled
    const channelsRef = collection(db, "channels");
    const autoScanChannelsQuery = query(
      channelsRef,
      where("autoScanEnabled", "==", true)
    );
    const channelsSnapshot = await getDocs(autoScanChannelsQuery);

    if (channelsSnapshot.empty) {
      log("⚠️ No channels have auto-scan enabled");
      return NextResponse.json({
        success: true,
        message: "No channels to scan",
        scannedChannels: 0,
        logs,
      });
    }

    log(`📺 Found ${channelsSnapshot.size} channels with auto-scan enabled`);

    // Get all users for plan checking
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);
    const usersMap: Record<string, any> = {};
    usersSnapshot.forEach((doc) => {
      usersMap[doc.id] = { id: doc.id, ...doc.data() };
    });

    // Track scans per user
    const userScanCount: Record<string, number> = {};
    let totalScanned = 0;
    let totalSkipped = 0;
    const scanResults: any[] = [];

    for (const channelDoc of channelsSnapshot.docs) {
      const channelData = channelDoc.data();
      const channel = { id: channelDoc.id, ...channelData } as any;
      const userId = channelData.userId;
      const user = usersMap[userId];

      if (!user) {
        log(`⚠️ Skipping channel ${channel.channelId}: User not found`);
        totalSkipped++;
        continue;
      }

      const userPlanId = user.planId || "";
      
      // Check if user's plan has auto-scan enabled
      if (!enabledPlans.includes(userPlanId)) {
        log(`⚠️ Skipping channel ${channel.channelId}: Plan "${user.plan}" not eligible`);
        totalSkipped++;
        continue;
      }

      // Check user's channel limit
      const limits = planLimits[userPlanId] || { maxChannels: 5, videosPerChannel: 50 };
      userScanCount[userId] = (userScanCount[userId] || 0) + 1;

      if (userScanCount[userId] > limits.maxChannels) {
        log(`⚠️ Skipping channel ${channel.channelId}: User exceeded channel limit (${limits.maxChannels})`);
        totalSkipped++;
        continue;
      }

      const videosToScan = channel.autoScanVideos || limits.videosPerChannel;

      log(`🔍 Scanning channel: ${channel.name || channel.channelId} (${videosToScan} videos)`);

      try {
        // Call the scan API
        const scanResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/scan-channel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channelId: channel.channelId,
              videoCount: videosToScan,
              userId: userId,
              channelName: channel.name || channel.channelId,
              isAutoScan: true,
            }),
          }
        );

        const scanData = await scanResponse.json();

        if (scanData.error) {
          log(`❌ Error scanning ${channel.channelId}: ${scanData.error}`);
          scanResults.push({
            channelId: channel.channelId,
            channelName: channel.name,
            userId,
            status: "error",
            error: scanData.error,
          });
        } else {
          log(`✅ Completed scan for ${channel.channelId}: ${scanData.statistics?.totalVideos || 0} videos, ${scanData.statistics?.brokenLinks || 0} broken links`);
          scanResults.push({
            channelId: channel.channelId,
            channelName: channel.name,
            userId,
            status: "success",
            statistics: scanData.statistics,
          });
          totalScanned++;

          // Update channel's last auto-scan time
          await updateDoc(channelDoc.ref, {
            lastAutoScan: new Date().toISOString(),
          });
        }
      } catch (scanError: any) {
        log(`❌ Exception scanning ${channel.channelId}: ${scanError.message}`);
        scanResults.push({
          channelId: channel.channelId,
          channelName: channel.name,
          userId,
          status: "error",
          error: scanError.message,
        });
      }

      // Add delay between scans to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const duration = (Date.now() - startTime) / 1000;
    log(`🏁 Auto-scan completed in ${duration.toFixed(2)}s`);
    log(`📊 Summary: ${totalScanned} scanned, ${totalSkipped} skipped`);

    // Save scan log
    const logsRef = collection(db, "autoScanLogs");
    await addDoc(logsRef, {
      createdAt: new Date().toISOString(),
      duration,
      totalChannels: channelsSnapshot.size,
      scannedChannels: totalScanned,
      skippedChannels: totalSkipped,
      results: scanResults,
      logs,
    });

    // Update last global scan time
    await updateDoc(settingsRef, {
      lastGlobalScan: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Auto-scan completed: ${totalScanned} channels scanned`,
      duration: `${duration.toFixed(2)}s`,
      totalChannels: channelsSnapshot.size,
      scannedChannels: totalScanned,
      skippedChannels: totalSkipped,
      results: scanResults,
      logs,
    });
  } catch (error: any) {
    log(`❌ Auto-scan failed: ${error.message}`);
    console.error("Auto-scan error:", error);

    // Save error log
    try {
      const logsRef = collection(db, "autoScanLogs");
      await addDoc(logsRef, {
        createdAt: new Date().toISOString(),
        status: "error",
        error: error.message,
        logs,
      });
    } catch (logError) {
      console.error("Failed to save error log:", logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        logs,
      },
      { status: 500 }
    );
  }
}

// GET - Get auto-scan run status and logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Get recent auto-scan logs
    const logsRef = collection(db, "autoScanLogs");
    const logsSnapshot = await getDocs(logsRef);

    const logs = logsSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);

    // Get last scan time from settings
    const settingsRef = doc(db, "settings", "autoScan");
    const settingsDoc = await getDoc(settingsRef);
    const lastGlobalScan = settingsDoc.exists() 
      ? settingsDoc.data().lastGlobalScan 
      : null;

    return NextResponse.json({
      success: true,
      lastGlobalScan,
      logs,
    });
  } catch (error: any) {
    console.error("Error fetching auto-scan logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch auto-scan logs" },
      { status: 500 }
    );
  }
}
