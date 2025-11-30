"use client";

import { useEffect, useState } from "react";
import { AdminHeader, StatsCard, DataTable, Column } from "@/components/noob";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import {
  Scan,
  Video,
  Link as LinkIcon,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  Calendar,
  TrendingUp,
} from "lucide-react";

interface ScanSession {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userPlan?: string;
  scanType: "channel" | "video" | "bulk";
  channelName?: string;
  status: string;
  totalVideos: number;
  totalLinks: number;
  workingLinks: number;
  warningLinks: number;
  brokenLinks: number;
  createdAt: string;
  completedAt?: string;
  duration?: number;
}

interface ScanStats {
  totalScans: number;
  scansLast30Days: number;
  averageVideosPerScan: number;
  averageLinksPerVideo: number;
  successRate: number;
  totalBrokenLinksFound: number;
}

export default function ScansPage() {
  const [scans, setScans] = useState<ScanSession[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadScans = async () => {
    setLoading(true);
    try {
      // Get all scan sessions
      const scansRef = collection(db, "scanSessions");
      const scansSnapshot = await getDocs(scansRef);

      // Get all users for lookup
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const usersMap: { [key: string]: any } = {};
      usersSnapshot.forEach((doc) => {
        usersMap[doc.id] = doc.data();
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let scansLast30Days = 0;
      let totalVideos = 0;
      let totalLinks = 0;
      let totalBrokenLinks = 0;
      let completedScans = 0;

      const scansList: ScanSession[] = scansSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const user = usersMap[data.userId];
        const statistics = data.statistics || {};

        // Count stats
        const videos = statistics.totalVideos || data.totalVideos || 0;
        const links = statistics.totalLinks || data.totalLinks || 0;
        const broken = statistics.brokenLinks || data.brokenLinks || 0;

        totalVideos += videos;
        totalLinks += links;
        totalBrokenLinks += broken;

        if (data.status === "completed") completedScans++;

        // Check if within last 30 days
        const createdAt = data.createdAt || data.startedAt;
        if (createdAt) {
          const scanDate = new Date(createdAt);
          if (scanDate >= thirtyDaysAgo) scansLast30Days++;
        }

        // Calculate duration
        let duration = 0;
        if (data.completedAt && data.startedAt) {
          duration = Math.round(
            (new Date(data.completedAt).getTime() -
              new Date(data.startedAt).getTime()) /
              1000
          );
        }

        return {
          id: docSnap.id,
          userId: data.userId || "",
          userName: user?.fullName || user?.displayName || "Unknown",
          userEmail: user?.email || "",
          userPlan: user?.plan || "Free Trial",
          scanType: data.scanType || "video",
          channelName: data.channelName || "",
          status: data.status || "unknown",
          totalVideos: videos,
          totalLinks: links,
          workingLinks: statistics.workingLinks || data.workingLinks || 0,
          warningLinks: statistics.warningLinks || data.warningLinks || 0,
          brokenLinks: broken,
          createdAt: createdAt || "",
          completedAt: data.completedAt || "",
          duration,
        };
      });

      // Sort by date descending
      scansList.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime() || 0;
        const dateB = new Date(b.createdAt).getTime() || 0;
        return dateB - dateA;
      });

      setScans(scansList);
      setStats({
        totalScans: scansList.length,
        scansLast30Days,
        averageVideosPerScan:
          scansList.length > 0
            ? Math.round(totalVideos / scansList.length)
            : 0,
        averageLinksPerVideo:
          totalVideos > 0 ? Math.round(totalLinks / totalVideos) : 0,
        successRate:
          scansList.length > 0
            ? Math.round((completedScans / scansList.length) * 100)
            : 0,
        totalBrokenLinksFound: totalBrokenLinks,
      });
    } catch (error) {
      console.error("Error loading scans:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
  }, []);

  const deleteScan = async (scanId: string) => {
    if (!confirm("Are you sure you want to delete this scan session?")) return;

    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "scanSessions", scanId));
      alert("Scan session deleted successfully");
      loadScans();
    } catch (error) {
      console.error("Error deleting scan:", error);
      alert("Failed to delete scan session");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const columns: Column<ScanSession>[] = [
    {
      key: "userName",
      header: "User",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{row.userEmail}</p>
        </div>
      ),
    },
    {
      key: "scanType",
      header: "Type",
      sortable: true,
      render: (value, row) => (
        <div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              value === "channel"
                ? "bg-red-100 text-red-800"
                : "bg-purple-100 text-purple-800"
            }`}
          >
            {value === "channel" ? "Channel" : "Video"}
          </span>
          {row.channelName && (
            <p className="text-xs text-gray-500 mt-1">{row.channelName}</p>
          )}
        </div>
      ),
    },
    {
      key: "totalVideos",
      header: "Videos",
      sortable: true,
      render: (value) => value?.toLocaleString() || "0",
    },
    {
      key: "totalLinks",
      header: "Links Found",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-2">
          <span>{value || 0}</span>
          {row.brokenLinks > 0 && (
            <span className="text-xs text-red-600">
              ({row.brokenLinks} broken)
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            value === "completed"
              ? "bg-green-100 text-green-800"
              : value === "processing" || value === "scanning"
                ? "bg-blue-100 text-blue-800"
                : value === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      sortable: true,
      render: (value) => (value ? formatDuration(value) : "-"),
    },
    {
      key: "createdAt",
      header: "Date",
      sortable: true,
      render: (value) =>
        value ? new Date(value).toLocaleString() : "-",
    },
    {
      key: "id",
      header: "Actions",
      render: (value) => (
        <button
          onClick={() => deleteScan(value)}
          disabled={actionLoading}
          className="p-1.5 hover:bg-red-100 rounded transition-colors"
          title="Delete scan"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Scans"
        subtitle="Monitor scan sessions and system usage"
        onRefresh={loadScans}
        loading={loading}
      />

      <div className="p-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-6">
            <StatsCard
              title="Total Scans"
              value={stats.totalScans}
              icon={<Scan className="w-6 h-6" />}
              color="blue"
            />
            <StatsCard
              title="Last 30 Days"
              value={stats.scansLast30Days}
              icon={<Calendar className="w-6 h-6" />}
              color="purple"
            />
            <StatsCard
              title="Avg Videos/Scan"
              value={stats.averageVideosPerScan}
              icon={<Video className="w-6 h-6" />}
              color="green"
            />
            <StatsCard
              title="Avg Links/Video"
              value={stats.averageLinksPerVideo}
              icon={<LinkIcon className="w-6 h-6" />}
              color="gray"
            />
            <StatsCard
              title="Success Rate"
              value={`${stats.successRate}%`}
              icon={<CheckCircle className="w-6 h-6" />}
              color={stats.successRate >= 90 ? "green" : "yellow"}
            />
            <StatsCard
              title="Broken Links Found"
              value={stats.totalBrokenLinksFound}
              icon={<AlertTriangle className="w-6 h-6" />}
              color={stats.totalBrokenLinksFound > 0 ? "red" : "green"}
            />
          </div>
        )}

        {/* Scans Table */}
        <DataTable
          columns={columns}
          data={scans}
          loading={loading}
          searchable
          searchPlaceholder="Search by user or channel..."
          pageSize={25}
          exportable
          emptyMessage="No scan sessions found"
        />
      </div>
    </div>
  );
}
