"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/noob";
import Link from "next/link";
import {
  Zap,
  Users,
  Settings,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Youtube,
  Crown,
  Building2,
  Radio,
  Download,
  Filter,
  TrendingUp,
  Activity,
  Eye,
  EyeOff,
  Check,
  X,
  Bell,
  FileText,
} from "lucide-react";

interface ChannelData {
  id: string;
  name: string;
  channelId: string;
  autoScanEnabled: boolean;
  autoScanFrequency: string;
  lastAutoScan: string | null;
  nextAutoScan: string | null;
  autoScanVideos: number;
}

interface UserData {
  id: string;
  fullName: string;
  email: string;
  plan: string;
  planId: string;
  planStatus: string;
  createdAt: string | null;
  channelCount: number;
  autoScanEnabled: boolean;
  autoScanChannelCount: number;
  autoScanFrequency: string;
  nextAutoScan: string | null;
  channels: ChannelData[];
  autoScanAllowed?: boolean;
  planLimits?: {
    maxVideosPerScan: number | 'unlimited';
    maxChannels: number | 'unlimited';
    maxScansPerChannel: number | 'unlimited';
    allowedFrequencies: string[];
  } | null;
}

interface Stats {
  totalUsers: number;
  usersWithAutoScan: number;
  totalAutoScanChannels: number;
  scansToday: number;
  scansThisWeek: number;
  scansThisMonth: number;
  dailyScheduled: number;
  weeklyScheduled: number;
  monthlyScheduled: number;
}

export default function AutoScanUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [enabledPlans, setEnabledPlans] = useState<string[]>([]);
  const [planUserCounts, setPlanUserCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    usersWithAutoScan: 0,
    totalAutoScanChannels: 0,
    scansToday: 0,
    scansThisWeek: 0,
    scansThisMonth: 0,
    dailyScheduled: 0,
    weeklyScheduled: 0,
    monthlyScheduled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState("all");
  const [expandedUsers, setExpandedUsers] = useState<string[]>([]);
  const [showLiveScanning, setShowLiveScanning] = useState(true);
  const [activeScans, setActiveScans] = useState<any[]>([]);
  const [scanningChannels, setScanningChannels] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/noob/auto-scan?type=users");
      const data = await response.json();
      if (data.success) {
        // Only show users with eligible plans (already filtered by API)
        setUsers(data.users || []);
        
        // Set enabled plans and user counts from API
        setEnabledPlans(data.enabledPlans || []);
        setPlanUserCounts(data.planUserCounts || {});
        
        // Calculate schedule stats from users
        const allUsers = data.users || [];
        const autoScanUsers = allUsers.filter((u: UserData) => u.autoScanEnabled);
        const dailyScheduled = autoScanUsers.filter((u: UserData) => u.autoScanFrequency === "daily").length;
        const weeklyScheduled = autoScanUsers.filter((u: UserData) => u.autoScanFrequency === "weekly").length;
        const monthlyScheduled = autoScanUsers.filter((u: UserData) => u.autoScanFrequency === "monthly").length;

        setStats({
          totalUsers: data.stats?.totalUsers || allUsers.length,
          usersWithAutoScan: data.stats?.usersWithAutoScan || autoScanUsers.length,
          totalAutoScanChannels: data.stats?.totalAutoScanChannels || 0,
          scansToday: data.stats?.scansToday || 0,
          scansThisWeek: data.stats?.scansThisWeek || 0,
          scansThisMonth: data.stats?.scansThisMonth || 0,
          dailyScheduled,
          weeklyScheduled,
          monthlyScheduled,
        });
      }
    } catch (error) {
      console.error("Error loading auto-scan users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load active scans from database (persisted scan status)
  const loadActiveScans = async () => {
    try {
      const response = await fetch("/api/noob/auto-scan?type=activeScans");
      const data = await response.json();
      if (data.success && data.activeScans) {
        setActiveScans(data.activeScans);
        setScanningChannels(data.activeScans.map((s: any) => s.channelId));
      }
    } catch (error) {
      console.error("Error loading active scans:", error);
    }
  };

  useEffect(() => {
    loadData();
    loadActiveScans();
    
    // Poll for active scans every 5 seconds to keep UI in sync
    const pollInterval = setInterval(() => {
      loadActiveScans();
    }, 5000);
    
    return () => clearInterval(pollInterval);
  }, []);

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !search ||
      user.fullName.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());

    const matchesPlan =
      planFilter === "all" ||
      user.plan.toLowerCase().includes(planFilter.toLowerCase()) ||
      user.planId?.toLowerCase().includes(planFilter.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "enabled" && user.autoScanEnabled) ||
      (statusFilter === "disabled" && !user.autoScanEnabled);

    const matchesSchedule =
      scheduleFilter === "all" ||
      (user.autoScanEnabled && user.autoScanFrequency === scheduleFilter);

    // Check if user has any channel with completed scans
    const hasCompletedScans = user.channels?.some((ch: any) => ch.lastAutoScan);
    
    const matchesCompletion =
      completionFilter === "all" ||
      (completionFilter === "completed" && hasCompletedScans) ||
      (completionFilter === "pending" && !hasCompletedScans);

    return matchesSearch && matchesPlan && matchesStatus && matchesSchedule && matchesCompletion;
  });

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Select all enabled users
  const selectAllEnabled = () => {
    const enabledUserIds = filteredUsers
      .filter(u => u.autoScanEnabled)
      .map(u => u.id);
    setSelectedUserIds(enabledUserIds);
  };

  // Toggle user expansion
  const toggleUserExpansion = (userId: string) => {
    setExpandedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Enable/disable auto-scan for single user
  const toggleUserAutoScan = async (userId: string, enabled: boolean) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/noob/auto-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggleUserAutoScan",
          userId,
          enabled,
        }),
      });

      const data = await response.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "Failed to update auto-scan");
      }
    } catch (error) {
      console.error("Error toggling auto-scan:", error);
      alert("Failed to update auto-scan");
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk enable/disable auto-scan
  const bulkToggleAutoScan = async (enabled: boolean) => {
    if (selectedUserIds.length === 0) {
      alert("Please select at least one user");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch("/api/noob/auto-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggleBulkAutoScan",
          userIds: selectedUserIds,
          enabled,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setSelectedUserIds([]);
        loadData();
      } else {
        alert(data.error || "Failed to update auto-scan");
      }
    } catch (error) {
      console.error("Error bulk toggling auto-scan:", error);
      alert("Failed to update auto-scan");
    } finally {
      setActionLoading(false);
    }
  };

  // Update channel auto-scan settings
  const updateChannelAutoScan = async (
    channelId: string,
    autoScanEnabled: boolean,
    autoScanVideos?: number,
    autoScanFrequency?: string
  ) => {
    try {
      const response = await fetch("/api/noob/auto-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateChannelAutoScan",
          channelId,
          autoScanEnabled,
          autoScanVideos,
          autoScanFrequency,
        }),
      });

      const data = await response.json();
      if (data.success) {
        loadData();
      }
    } catch (error) {
      console.error("Error updating channel:", error);
    }
  };

  // Toggle channel selection for batch scan
  const toggleChannelSelection = (channelId: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  // Clear channel selection
  const clearChannelSelection = () => {
    setSelectedChannelIds([]);
  };

  // Trigger single channel scan
  const triggerSingleScan = async (channelId: string) => {
    // Find channel name from users data
    let channelName = "Channel";
    for (const user of users) {
      const ch = user.channels.find(c => c.id === channelId);
      if (ch) {
        channelName = ch.name;
        break;
      }
    }

    // Add to scanning and active scans immediately
    setScanningChannels((prev) => [...prev, channelId]);
    setActiveScans((prev) => [
      ...prev.filter(s => s.channelId !== channelId),
      {
        channelId,
        channelName,
        jobId: null,
        progress: 10,
        startedAt: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch("/api/noob/auto-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "triggerSingleScan",
          firestoreId: channelId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Update active scan with job ID
        setActiveScans((prev) => 
          prev.map(s => s.channelId === channelId 
            ? { ...s, channelName: data.channelName, jobId: data.jobId, progress: 50 }
            : s
          )
        );
        
        // Keep showing progress for a while, then mark as complete
        setTimeout(() => {
          setActiveScans((prev) => 
            prev.map(s => s.channelId === channelId 
              ? { ...s, progress: 100 }
              : s
            )
          );
          // Remove from scanning after completion
          setTimeout(() => {
            setScanningChannels((prev) => prev.filter((id) => id !== channelId));
            loadData();
          }, 2000);
        }, 5000);
        
      } else {
        alert(data.error || "Failed to start scan");
        setScanningChannels((prev) => prev.filter((id) => id !== channelId));
        setActiveScans((prev) => prev.filter(s => s.channelId !== channelId));
      }
    } catch (error) {
      console.error("Error triggering scan:", error);
      alert("Failed to start scan");
      setScanningChannels((prev) => prev.filter((id) => id !== channelId));
      setActiveScans((prev) => prev.filter(s => s.channelId !== channelId));
    }
  };

  // Trigger batch scan for selected channels
  const triggerBatchScan = async () => {
    if (selectedChannelIds.length === 0) {
      alert("Please select at least one channel");
      return;
    }

    setActionLoading(true);
    setScanningChannels(selectedChannelIds);
    
    try {
      const response = await fetch("/api/noob/auto-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "triggerImmediateScan",
          channelIds: selectedChannelIds,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Add to active scans
        if (data.results && data.results.length > 0) {
          setActiveScans((prev) => [
            ...prev,
            ...data.results.map((r: any) => ({
              channelId: r.channelId,
              channelName: r.channelName,
              jobId: r.jobId,
              progress: 0,
              startedAt: new Date().toISOString(),
            })),
          ]);
        }
        alert(data.message);
        setSelectedChannelIds([]);
        loadData();
      } else {
        alert(data.error || "Failed to start batch scan");
      }
    } catch (error) {
      console.error("Error triggering batch scan:", error);
      alert("Failed to start batch scan");
    } finally {
      setActionLoading(false);
      setScanningChannels([]);
    }
  };

  // Format date helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Export users data
  const handleExport = () => {
    const csvData = filteredUsers.map(u => ({
      Name: u.fullName,
      Email: u.email,
      Plan: u.plan,
      Channels: u.channelCount,
      AutoScanEnabled: u.autoScanEnabled ? "Yes" : "No",
      Frequency: u.autoScanFrequency || "N/A",
    }));
    
    const headers = Object.keys(csvData[0] || {}).join(",");
    const rows = csvData.map(row => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auto-scan-users.csv";
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <AdminHeader
        title="Auto-Scan Management"
        subtitle="Manage automatic scanning for users and channels"
        onRefresh={loadData}
        loading={loading}
      />

      <div className="p-6 space-y-6">
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Users with Access</p>
                <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {enabledPlans.length > 0 
                    ? enabledPlans.map(p => `${planUserCounts[p] || 0} ${p.charAt(0).toUpperCase() + p.slice(1)}`).join(', ')
                    : 'No plans enabled'}
                </p>
              </div>
              <div className="p-3 bg-blue-600 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Auto-Scans</p>
                <p className="text-3xl font-bold text-white">{stats.usersWithAutoScan}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.totalAutoScanChannels} channels configured
                </p>
              </div>
              <div className="p-3 bg-green-600 rounded-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Scans Today</p>
                <p className="text-3xl font-bold text-white">{stats.scansToday}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.scansThisWeek} this week
                </p>
              </div>
              <div className="p-3 bg-purple-600 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Monthly Scans</p>
                <p className="text-3xl font-bold text-white">{stats.scansThisMonth}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Total auto-scans this month
                </p>
              </div>
              <div className="p-3 bg-pink-600 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Plan User Cards - Dynamic based on enabled plans */}
        {enabledPlans.length > 0 ? (
          <div className={`grid grid-cols-1 ${enabledPlans.length === 1 ? 'md:grid-cols-1' : enabledPlans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
            {enabledPlans.map((planId) => {
              const planColors: Record<string, { bg: string; text: string; icon: string }> = {
                basic: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: 'yellow' },
                pro: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: 'orange' },
                enterprise: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: 'purple' },
                free: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: 'gray' },
              };
              const colors = planColors[planId.toLowerCase()] || { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: 'blue' };
              const planName = planId.charAt(0).toUpperCase() + planId.slice(1);
              const userCount = planUserCounts[planId] || 0;
              
              return (
                <div key={planId} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 ${colors.bg} rounded-lg`}>
                        {planId.toLowerCase() === 'enterprise' ? (
                          <Building2 className={`w-5 h-5 ${colors.text}`} />
                        ) : planId.toLowerCase() === 'pro' ? (
                          <Crown className={`w-5 h-5 ${colors.text}`} />
                        ) : (
                          <Zap className={`w-5 h-5 ${colors.text}`} />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{planName} Users</p>
                        <p className="text-xs text-gray-400">
                          Users on {planName} plan with auto-scan access enabled
                        </p>
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${colors.text}`}>{userCount}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
            <p className="text-white font-medium">No Plans Enabled for Auto-Scan</p>
            <p className="text-gray-400 text-sm mt-1">
              Go to <a href="/noob/auto-scan/settings" className="text-blue-400 hover:underline">Auto-Scan Settings</a> to enable plans
            </p>
          </div>
        )}

        {/* Live Scanning Overview */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center space-x-2">
              <Radio className="w-5 h-5 text-red-500 animate-pulse" />
              <span className="text-white font-semibold">Live Scanning Overview</span>
            </div>
            <button
              onClick={() => setShowLiveScanning(!showLiveScanning)}
              className="text-gray-400 hover:text-white text-sm"
            >
              {showLiveScanning ? "Hide" : "Show"}
            </button>
          </div>
          
          {showLiveScanning && (
            <div className="p-6">
              {activeScans.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <div className="w-16 h-16 rounded-full border-4 border-gray-700 border-t-gray-500 mb-4 animate-spin" style={{ animationDuration: '3s' }} />
                  <p className="text-gray-400 font-medium">No active scans running</p>
                  <p className="text-sm text-gray-500">Start a scan to see live progress here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Show scanning channels */}
                  {activeScans.map((scan) => (
                    <div key={scan.channelId} className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-white animate-spin" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{scan.channelName || 'Scanning...'}</p>
                            <p className="text-xs text-gray-400">
                              Started {scan.scanStartedAt ? formatDate(scan.scanStartedAt) : 'just now'}
                              {scan.videosToScan && ` • ${scan.videosToScan} videos`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="px-3 py-1 bg-blue-600/30 text-blue-400 rounded-full text-sm font-medium animate-pulse">
                            In Progress
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all animate-pulse"
                          style={{ width: `${scan.scanProgress || 30}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Scanning videos and checking links...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter Section */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4">
          {/* Schedule Filter */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              Filter by Schedule
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setScheduleFilter("all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors ${
                  scheduleFilter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>All Schedules</span>
              </button>
              <button
                onClick={() => setScheduleFilter("daily")}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors ${
                  scheduleFilter === "daily"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Daily</span>
                <span className="bg-gray-600 px-2 py-0.5 rounded text-xs">{stats.dailyScheduled}</span>
              </button>
              <button
                onClick={() => setScheduleFilter("weekly")}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors ${
                  scheduleFilter === "weekly"
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Weekly</span>
                <span className="bg-gray-600 px-2 py-0.5 rounded text-xs">{stats.weeklyScheduled}</span>
              </button>
              <button
                onClick={() => setScheduleFilter("monthly")}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors ${
                  scheduleFilter === "monthly"
                    ? "bg-orange-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Monthly</span>
                <span className="bg-gray-600 px-2 py-0.5 rounded text-xs">{stats.monthlyScheduled}</span>
              </button>
            </div>
          </div>

          {/* Completion Filter */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center">
              <CheckCircle className="w-3 h-3 mr-1" />
              Filter by Completion Status
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCompletionFilter("all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors ${
                  completionFilter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>All Users</span>
                <span className="bg-gray-600 px-2 py-0.5 rounded text-xs">{stats.totalUsers}</span>
              </button>
              <button
                onClick={() => setCompletionFilter("completed")}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors ${
                  completionFilter === "completed"
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Has Scans</span>
                <span className="bg-gray-600 px-2 py-0.5 rounded text-xs">
                  {users.filter(u => u.channels?.some((ch: any) => ch.lastAutoScan)).length}
                </span>
              </button>
              <button
                onClick={() => setCompletionFilter("pending")}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors ${
                  completionFilter === "pending"
                    ? "bg-orange-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>No Scans Yet</span>
                <span className="bg-gray-600 px-2 py-0.5 rounded text-xs">
                  {users.filter(u => !u.channels?.some((ch: any) => ch.lastAutoScan)).length}
                </span>
              </button>
            </div>
          </div>

          {/* Search and Filters Row */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="all">All Plans</option>
              {enabledPlans.map((planId) => (
                <option key={planId} value={planId}>
                  {planId.charAt(0).toUpperCase() + planId.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="all">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
            <select
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value)}
              className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="all">All Schedules</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select
              value={completionFilter}
              onChange={(e) => setCompletionFilter(e.target.value)}
              className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="all">All Completion</option>
              <option value="completed">Has Completed Scans</option>
              <option value="pending">No Completed Scans</option>
            </select>
            <div className="flex items-center space-x-4 ml-auto">
              <span className="text-sm text-gray-400">
                {filteredUsers.length} of {users.length} users
              </span>
              <div className="relative">
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Channel Selection Bar - Shows when channels are selected */}
        {selectedChannelIds.length > 0 && (
          <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium">
                {selectedChannelIds.length} channel{selectedChannelIds.length !== 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={clearChannelSelection}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                Clear Selection
              </button>
              <button
                onClick={triggerBatchScan}
                disabled={actionLoading}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
              >
                <Zap className="w-4 h-4" />
                <span>Start Batch Scan</span>
              </button>
            </div>
          </div>
        )}

        {/* Users & Channels Section */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-white font-semibold">Users & Channels</h3>
            <button
              onClick={selectAllEnabled}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm flex items-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Select All Enabled</span>
            </button>
          </div>

          {/* Bulk User Actions */}
          {selectedUserIds.length > 0 && (
            <div className="bg-blue-900/30 border-b border-blue-500/30 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-400" />
                <span className="text-blue-300 font-medium">
                  {selectedUserIds.length} user{selectedUserIds.length !== 1 ? "s" : ""} selected
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => bulkToggleAutoScan(true)}
                  disabled={actionLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                >
                  <Power className="w-4 h-4" />
                  <span>Enable</span>
                </button>
                <button
                  onClick={() => bulkToggleAutoScan(false)}
                  disabled={actionLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
                >
                  <PowerOff className="w-4 h-4" />
                  <span>Disable</span>
                </button>
                <button
                  onClick={() => setSelectedUserIds([])}
                  className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Users List */}
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-xl font-semibold text-white mb-2">No Users Found</p>
              <p className="text-gray-400">
                No users with Pro or Enterprise plans have been found.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {filteredUsers.map((user) => (
                <div key={user.id}>
                  <div className="p-4 flex items-center space-x-4 hover:bg-gray-700/30 transition-colors">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
                    />

                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-white truncate">{user.fullName}</p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          user.plan.toLowerCase().includes("enterprise")
                            ? "bg-purple-500/20 text-purple-400"
                            : user.plan.toLowerCase().includes("pro")
                            ? "bg-orange-500/20 text-orange-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}>
                          {user.plan}
                        </span>
                        {user.autoScanEnabled && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-400">
                            Access Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 flex items-center mt-0.5">
                        <span className="mr-1">✉</span> {user.email}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{user.channelCount}</p>
                        <p className="text-xs text-gray-500">Channels</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-xl font-bold ${
                          user.planLimits?.maxChannels !== 'unlimited' && 
                          user.autoScanChannelCount > (user.planLimits?.maxChannels || 0)
                            ? 'text-red-400'
                            : 'text-purple-400'
                        }`}>
                          {user.autoScanChannelCount}
                          {user.planLimits && (
                            <span className="text-sm text-gray-500">
                              /{user.planLimits.maxChannels === 'unlimited' ? '∞' : user.planLimits.maxChannels}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">Active Scans</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <p className="text-sm font-medium text-gray-300">
                          {user.channels.length > 0 && user.channels[0].lastAutoScan 
                            ? formatDate(user.channels[0].lastAutoScan).split(',')[0] 
                            : "Never"}
                        </p>
                        <p className="text-xs text-gray-500">Last Auto-Scan</p>
                      </div>
                    </div>

                    {/* Status Toggle */}
                    <button
                      onClick={() => toggleUserAutoScan(user.id, !user.autoScanEnabled)}
                      disabled={actionLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        user.autoScanEnabled ? "bg-green-600" : "bg-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          user.autoScanEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>

                    {/* Expand Button */}
                    {user.channelCount > 0 && (
                      <button
                        onClick={() => toggleUserExpansion(user.id)}
                        className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        {expandedUsers.includes(user.id) ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded Channels */}
                  {expandedUsers.includes(user.id) && user.channels.length > 0 && (
                    <div className="bg-gray-900/50 px-4 py-4 border-t border-gray-700">
                      {/* User Details Header */}
                      <div className="ml-14 mb-4 grid grid-cols-4 gap-4 text-xs">
                        <div>
                          <p className="text-gray-500 uppercase tracking-wider mb-1">Member Since</p>
                          <p className="text-white">{formatDate(user.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 uppercase tracking-wider mb-1">Plan Status</p>
                          <p className="text-green-400">{user.planStatus}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 uppercase tracking-wider mb-1">Next Scan</p>
                          <p className="text-blue-400">{formatDate(user.nextAutoScan)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 uppercase tracking-wider mb-1">Total Configured</p>
                          <p className="text-white">{user.autoScanChannelCount} channels</p>
                        </div>
                      </div>

                      {/* Channel Table Header */}
                      <div className="ml-14 grid grid-cols-12 gap-2 text-xs text-gray-500 uppercase tracking-wider mb-2 px-3">
                        <div className="col-span-4">Channel</div>
                        <div className="col-span-2">Schedule</div>
                        <div className="col-span-2">Next Scan</div>
                        <div className="col-span-2">Last Scan</div>
                        <div className="col-span-2 text-right">Actions</div>
                      </div>

                      {/* Channel Rows */}
                      <div className="ml-14 space-y-2">
                        {user.channels.map((channel) => (
                          <div
                            key={channel.id}
                            className={`bg-gray-800 rounded-lg p-3 grid grid-cols-12 gap-2 items-center border ${
                              selectedChannelIds.includes(channel.id) 
                                ? "border-purple-500/50 bg-purple-900/20" 
                                : "border-transparent"
                            }`}
                          >
                            {/* Channel Info */}
                            <div className="col-span-4 flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={selectedChannelIds.includes(channel.id)}
                                onChange={() => toggleChannelSelection(channel.id)}
                                className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 cursor-pointer"
                              />
                              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                                <Youtube className="w-4 h-4 text-white" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-white text-sm truncate">{channel.name}</p>
                                <p className="text-xs text-gray-500">
                                  {user.planLimits?.maxVideosPerScan === 'unlimited' 
                                    ? 'Unlimited' 
                                    : `${user.planLimits?.maxVideosPerScan || channel.autoScanVideos || 50} videos`}
                                </p>
                              </div>
                            </div>

                            {/* Schedule */}
                            <div className="col-span-2">
                              <select
                                value={channel.autoScanFrequency}
                                onChange={(e) => updateChannelAutoScan(channel.id, channel.autoScanEnabled, undefined, e.target.value)}
                                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </div>

                            {/* Next Scan */}
                            <div className="col-span-2">
                              <p className="text-sm text-blue-400">{formatDate(channel.nextAutoScan)}</p>
                            </div>

                            {/* Last Scan */}
                            <div className="col-span-2">
                              <p className="text-sm text-gray-400">{formatDate(channel.lastAutoScan)}</p>
                            </div>

                            {/* Actions */}
                            <div className="col-span-2 flex items-center justify-end space-x-2">
                              <button
                                onClick={() => triggerSingleScan(channel.id)}
                                disabled={scanningChannels.includes(channel.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors ${
                                  scanningChannels.includes(channel.id)
                                    ? "bg-blue-600/50 text-blue-300 cursor-wait"
                                    : "bg-green-600 text-white hover:bg-green-700"
                                }`}
                              >
                                {scanningChannels.includes(channel.id) ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Scanning</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap className="w-3 h-3" />
                                    <span>Scan</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => updateChannelAutoScan(channel.id, !channel.autoScanEnabled)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors ${
                                  channel.autoScanEnabled
                                    ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                                    : "bg-gray-700 text-gray-400"
                                }`}
                              >
                                <Power className="w-3 h-3" />
                                <span>{channel.autoScanEnabled ? "On" : "Off"}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto-Scan Feature Access Info */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-white font-semibold mb-4">Auto-Scan Feature Access</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Crown className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-white font-medium">Pro Plan</p>
                <p className="text-sm text-gray-400">
                  Daily, weekly, and monthly auto-scans. Up to 5 channels.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Building2 className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-white font-medium">Enterprise Plan</p>
                <p className="text-sm text-gray-400">
                  Unlimited auto-scans with priority processing and advanced scheduling.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Bell className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium">Auto-Scan Benefits</p>
                <p className="text-sm text-gray-400">
                  Automated monitoring, email notifications, and scheduled reports.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Link */}
        <div className="flex justify-end">
          <Link
            href="/noob/auto-scan/settings"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Configure Auto-Scan Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
