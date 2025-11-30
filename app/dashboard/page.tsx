"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { logOut } from "@/lib/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { notifyUserLogin } from "@/lib/notifications";
import Link from "next/link";
import Header from "@/components/Header";
import ReferralCard from "@/components/ReferralCard";
import {
  Shield,
  Youtube,
  Link as LinkIcon,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  BarChart3,
  Video,
  Calendar,
} from "lucide-react";

interface ChannelStats {
  totalChannels: number;
  totalVideos: number;
  totalLinks: number;
  workingLinks: number;
  warningLinks: number;
  brokenLinks: number;
}

interface VideoStats {
  totalSessions: number;
  totalVideos: number;
  totalLinks: number;
  workingLinks: number;
  warningLinks: number;
  brokenLinks: number;
}

interface WeeklyActivity {
  day: string;
  scans: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const loginNotificationSent = useRef(false);
  const [channelStats, setChannelStats] = useState<ChannelStats>({
    totalChannels: 0,
    totalVideos: 0,
    totalLinks: 0,
    workingLinks: 0,
    warningLinks: 0,
    brokenLinks: 0,
  });
  const [videoStats, setVideoStats] = useState<VideoStats>({
    totalSessions: 0,
    totalVideos: 0,
    totalLinks: 0,
    workingLinks: 0,
    warningLinks: 0,
    brokenLinks: 0,
  });
  const [channelWeeklyActivity, setChannelWeeklyActivity] = useState<
    WeeklyActivity[]
  >([]);
  const [videoWeeklyActivity, setVideoWeeklyActivity] = useState<
    WeeklyActivity[]
  >([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadDashboardData(currentUser.uid);

        // Send login notification (only once per session)
        if (!loginNotificationSent.current) {
          const userName = currentUser.displayName || "User";
          await notifyUserLogin(currentUser.uid, userName);
          loginNotificationSent.current = true;
        }

        setLoading(false);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadDashboardData = async (userId: string) => {
    try {
      // Load Channel Stats
      await loadChannelStats(userId);
      // Load Video Stats
      await loadVideoStats(userId);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const loadChannelStats = async (userId: string) => {
    try {
      // Get all channels for user
      const channelsRef = collection(db, "channels");
      const channelsQuery = query(channelsRef, where("userId", "==", userId));
      const channelsSnapshot = await getDocs(channelsQuery);

      console.log("Total channels found:", channelsSnapshot.size);

      let totalVideos = 0;
      let totalLinks = 0;
      let workingLinks = 0;
      let warningLinks = 0;
      let brokenLinks = 0;
      const weeklyScans: { [key: string]: number } = {
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
        Sun: 0,
      };

      // Process each channel - read from the channel document itself
      channelsSnapshot.forEach((channelDoc) => {
        const channelData = channelDoc.data();

        console.log(
          "Processing channel:",
          channelData.channelId || channelDoc.id,
        );
        console.log("Channel data:", channelData);

        // Get statistics from lastScanResults field
        if (channelData.lastScanResults) {
          const scanResults = channelData.lastScanResults;
          console.log("Last scan results:", scanResults);

          totalVideos += scanResults.scannedVideos || 0;
          totalLinks += scanResults.totalLinks || 0;
          workingLinks += scanResults.workingLinks || 0;
          warningLinks += scanResults.warningLinks || 0;
          brokenLinks += scanResults.brokenLinks || 0;

          // Track weekly activity
          if (scanResults.scannedAt) {
            const scanDate = new Date(scanResults.scannedAt);
            const dayOfWeek = scanDate.toLocaleDateString("en-US", {
              weekday: "short",
            });
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            if (
              scanDate >= oneWeekAgo &&
              weeklyScans[dayOfWeek] !== undefined
            ) {
              weeklyScans[dayOfWeek]++;
            }
          }
        } else {
          console.log(
            "No lastScanResults found for channel:",
            channelData.channelId || channelDoc.id,
          );
        }
      });

      console.log("Channel Stats Summary:", {
        totalChannels: channelsSnapshot.size,
        totalVideos,
        totalLinks,
        workingLinks,
        warningLinks,
        brokenLinks,
      });

      setChannelStats({
        totalChannels: channelsSnapshot.size,
        totalVideos,
        totalLinks,
        workingLinks,
        warningLinks,
        brokenLinks,
      });

      setChannelWeeklyActivity([
        { day: "Mon", scans: weeklyScans["Mon"] },
        { day: "Tue", scans: weeklyScans["Tue"] },
        { day: "Wed", scans: weeklyScans["Wed"] },
        { day: "Thu", scans: weeklyScans["Thu"] },
        { day: "Fri", scans: weeklyScans["Fri"] },
        { day: "Sat", scans: weeklyScans["Sat"] },
        { day: "Sun", scans: weeklyScans["Sun"] },
      ]);
    } catch (error) {
      console.error("Error loading channel stats:", error);
    }
  };

  const loadVideoStats = async (userId: string) => {
    try {
      // Get all scan sessions for user
      const sessionsRef = collection(db, "scanSessions");
      const sessionsQuery = query(sessionsRef, where("userId", "==", userId));
      const sessionsSnapshot = await getDocs(sessionsQuery);

      console.log("Total video scan sessions found:", sessionsSnapshot.size);

      let totalVideos = 0;
      let totalLinks = 0;
      let workingLinks = 0;
      let warningLinks = 0;
      let brokenLinks = 0;
      const weeklyScans: { [key: string]: number } = {
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
        Sun: 0,
      };

      sessionsSnapshot.forEach((sessionDoc) => {
        const sessionData = sessionDoc.data();

        console.log("Processing video session:", sessionDoc.id);
        console.log("Session data:", sessionData);

        if (sessionData.statistics) {
          console.log("Session statistics:", sessionData.statistics);
          totalVideos += sessionData.statistics.totalVideos || 0;
          totalLinks += sessionData.statistics.totalLinks || 0;
          workingLinks += sessionData.statistics.workingLinks || 0;
          warningLinks += sessionData.statistics.warningLinks || 0;
          brokenLinks += sessionData.statistics.brokenLinks || 0;
        }

        // Track weekly activity - check multiple possible timestamp fields
        const timestamp =
          sessionData.completedAt ||
          sessionData.scannedAt ||
          sessionData.createdAt ||
          sessionData.startedAt;

        if (timestamp) {
          const scanDate = new Date(timestamp);
          const dayOfWeek = scanDate.toLocaleDateString("en-US", {
            weekday: "short",
          });
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

          console.log(
            `Session date: ${scanDate.toISOString()}, Day: ${dayOfWeek}, Within last week: ${scanDate >= oneWeekAgo}`,
          );

          if (scanDate >= oneWeekAgo && weeklyScans[dayOfWeek] !== undefined) {
            weeklyScans[dayOfWeek]++;
            console.log(
              `Added to ${dayOfWeek}, new count: ${weeklyScans[dayOfWeek]}`,
            );
          }
        } else {
          console.log("No timestamp found for session:", sessionDoc.id);
        }
      });

      console.log("Video Stats Summary:", {
        totalSessions: sessionsSnapshot.size,
        totalVideos,
        totalLinks,
        workingLinks,
        warningLinks,
        brokenLinks,
      });

      console.log("Weekly video scans:", weeklyScans);

      setVideoStats({
        totalSessions: sessionsSnapshot.size,
        totalVideos,
        totalLinks,
        workingLinks,
        warningLinks,
        brokenLinks,
      });

      setVideoWeeklyActivity([
        { day: "Mon", scans: weeklyScans["Mon"] },
        { day: "Tue", scans: weeklyScans["Tue"] },
        { day: "Wed", scans: weeklyScans["Wed"] },
        { day: "Thu", scans: weeklyScans["Thu"] },
        { day: "Fri", scans: weeklyScans["Fri"] },
        { day: "Sat", scans: weeklyScans["Sat"] },
        { day: "Sun", scans: weeklyScans["Sun"] },
      ]);
    } catch (error) {
      console.error("Error loading video stats:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-primary-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const maxChannelScans = Math.max(
    ...channelWeeklyActivity.map((d) => d.scans),
    1,
  );
  const maxVideoScans = Math.max(...videoWeeklyActivity.map((d) => d.scans), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Unified Header */}
      <Header user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">
            Monitor your YouTube channel and video link analytics
          </p>
        </div>

        {/* CHANNELS SECTION */}
        <div className="mb-12">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Youtube className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Channels Overview
              </h2>
              <p className="text-sm text-gray-600">
                Monitor your connected YouTube channels
              </p>
            </div>
          </div>

          {/* Channel Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <Youtube className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {channelStats.totalChannels}
                </p>
                <p className="text-xs text-gray-600">Connected Channels</p>
              </div>
            </div>

            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <Video className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {channelStats.totalVideos}
                </p>
                <p className="text-xs text-gray-600">Scanned Videos</p>
              </div>
            </div>

            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <LinkIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {channelStats.totalLinks}
                </p>
                <p className="text-xs text-gray-600">Total Links</p>
              </div>
            </div>

            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {channelStats.workingLinks}
                </p>
                <p className="text-xs text-gray-600">Working Links</p>
              </div>
            </div>

            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {channelStats.warningLinks}
                </p>
                <p className="text-xs text-gray-600">Warning Links</p>
              </div>
            </div>

            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {channelStats.brokenLinks}
                </p>
                <p className="text-xs text-gray-600">Broken Links</p>
              </div>
            </div>
          </div>

          {/* Channel Weekly Activity Graph */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Weekly Channel Scan Activity
              </h3>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {channelWeeklyActivity.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-600 w-12">
                    {item.day}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-red-500 to-red-600 h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                      style={{
                        width: `${item.scans > 0 ? (item.scans / maxChannelScans) * 100 : 0}%`,
                        minWidth: item.scans > 0 ? "40px" : "0",
                      }}
                    >
                      {item.scans > 0 && (
                        <span className="text-xs font-semibold text-white">
                          {item.scans}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Total scans this week:{" "}
                <span className="font-semibold text-gray-900">
                  {channelWeeklyActivity.reduce((sum, d) => sum + d.scans, 0)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* VIDEOS SECTION */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Video className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Videos Overview
              </h2>
              <p className="text-sm text-gray-600">
                Monitor your video scan sessions
              </p>
            </div>
          </div>

          {/* Video Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <Calendar className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {videoStats.totalSessions}
                </p>
                <p className="text-xs text-gray-600">Scan Sessions</p>
              </div>
            </div>

            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <Video className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {videoStats.totalVideos}
                </p>
                <p className="text-xs text-gray-600">Videos Scanned</p>
              </div>
            </div>

            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <LinkIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {videoStats.totalLinks}
                </p>
                <p className="text-xs text-gray-600">Links Found</p>
              </div>
            </div>

            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {videoStats.workingLinks}
                </p>
                <p className="text-xs text-gray-600">Working Links</p>
              </div>
            </div>

            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {videoStats.warningLinks}
                </p>
                <p className="text-xs text-gray-600">Warning Links</p>
              </div>
            </div>

            <div className="card hover:shadow-lg transition-shadow duration-300">
              <div className="text-center">
                <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {videoStats.brokenLinks}
                </p>
                <p className="text-xs text-gray-600">Broken Links</p>
              </div>
            </div>
          </div>

          {/* Video Weekly Activity Graph */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Weekly Video Scan Activity
              </h3>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {videoWeeklyActivity.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-600 w-12">
                    {item.day}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                      style={{
                        width: `${item.scans > 0 ? (item.scans / maxVideoScans) * 100 : 0}%`,
                        minWidth: item.scans > 0 ? "40px" : "0",
                      }}
                    >
                      {item.scans > 0 && (
                        <span className="text-xs font-semibold text-white">
                          {item.scans}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Total scans this week:{" "}
                <span className="font-semibold text-gray-900">
                  {videoWeeklyActivity.reduce((sum, d) => sum + d.scans, 0)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/channels"
            className="card hover:shadow-lg transition-all duration-300 group cursor-pointer"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <Youtube className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                  Scan Channel
                </h3>
                <p className="text-sm text-gray-600">
                  Scan a YouTube channel for broken links
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
            </div>
          </Link>

          <Link
            href="/Video"
            className="card hover:shadow-lg transition-all duration-300 group cursor-pointer"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Video className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                  Scan Videos
                </h3>
                <p className="text-sm text-gray-600">
                  Scan multiple video URLs for links
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
            </div>
          </Link>
        </div>

        {/* Referral Section */}
        {user && (
          <div className="mt-6">
            <ReferralCard user={user} />
          </div>
        )}
      </div>
    </div>
  );
}
