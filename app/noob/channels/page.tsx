"use client";

import { useEffect, useState } from "react";
import { AdminHeader, StatsCard, DataTable, Column } from "@/components/noob";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc, deleteDoc } from "firebase/firestore";
import {
  Youtube,
  Users,
  Video,
  AlertTriangle,
  Link as LinkIcon,
  Trash2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface Channel {
  id: string;
  channelId: string;
  channelName: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userPlan?: string;
  subscriberCount?: number;
  videoCount?: number;
  totalScans?: number;
  lastScanDate?: string;
  brokenLinks?: number;
  warningLinks?: number;
  workingLinks?: number;
  totalLinks?: number;
}

interface ChannelStats {
  totalChannels: number;
  channelsByPlan: {
    trial: number;
    basic: number;
    pro: number;
    enterprise: number;
  };
  channelsWithIssues: number;
  totalBrokenLinks: number;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadChannels = async () => {
    setLoading(true);
    try {
      // Get all channels
      const channelsRef = collection(db, "channels");
      const channelsSnapshot = await getDocs(channelsRef);

      // Get all users for lookup
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const usersMap: { [key: string]: any } = {};
      usersSnapshot.forEach((doc) => {
        usersMap[doc.id] = doc.data();
      });

      const channelsByPlan = { trial: 0, basic: 0, pro: 0, enterprise: 0 };
      let channelsWithIssues = 0;
      let totalBrokenLinks = 0;

      const channelsList: Channel[] = channelsSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const user = usersMap[data.userId];
        const userPlan = user?.plan?.toLowerCase() || "trial";

        // Count by plan
        if (userPlan.includes("enterprise")) channelsByPlan.enterprise++;
        else if (userPlan.includes("pro")) channelsByPlan.pro++;
        else if (userPlan.includes("basic")) channelsByPlan.basic++;
        else channelsByPlan.trial++;

        // Get scan results
        const scanResults = data.lastScanResults || {};
        const brokenLinks = scanResults.brokenLinks || 0;
        const warningLinks = scanResults.warningLinks || 0;
        const workingLinks = scanResults.workingLinks || 0;
        const totalLinks = scanResults.totalLinks || 0;

        if (brokenLinks > 0) channelsWithIssues++;
        totalBrokenLinks += brokenLinks;

        return {
          id: docSnap.id,
          channelId: data.channelId || "",
          channelName: data.channelName || "Unknown Channel",
          userId: data.userId || "",
          userName: user?.fullName || user?.displayName || "Unknown",
          userEmail: user?.email || "",
          userPlan: user?.plan || "Free Trial",
          subscriberCount: data.subscriberCount || 0,
          videoCount: data.videoCount || 0,
          totalScans: data.totalScans || 0,
          lastScanDate: scanResults.scannedAt || data.lastScanned || "",
          brokenLinks,
          warningLinks,
          workingLinks,
          totalLinks,
        };
      });

      // Sort by broken links (most first)
      channelsList.sort((a, b) => (b.brokenLinks || 0) - (a.brokenLinks || 0));

      setChannels(channelsList);
      setStats({
        totalChannels: channelsList.length,
        channelsByPlan,
        channelsWithIssues,
        totalBrokenLinks,
      });
    } catch (error) {
      console.error("Error loading channels:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const deleteChannel = async (channelId: string) => {
    if (!confirm("Are you sure you want to delete this channel?")) return;

    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "channels", channelId));
      alert("Channel deleted successfully");
      loadChannels();
    } catch (error) {
      console.error("Error deleting channel:", error);
      alert("Failed to delete channel");
    } finally {
      setActionLoading(false);
    }
  };

  const columns: Column<Channel>[] = [
    {
      key: "channelName",
      header: "Channel",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <Youtube className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">
              {row.userName} ({row.userEmail})
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "userPlan",
      header: "User Plan",
      sortable: true,
      render: (value) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            value?.toLowerCase().includes("enterprise")
              ? "bg-purple-100 text-purple-800"
              : value?.toLowerCase().includes("pro")
                ? "bg-blue-100 text-blue-800"
                : value?.toLowerCase().includes("basic")
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: "videoCount",
      header: "Videos",
      sortable: true,
      render: (value) => value?.toLocaleString() || "0",
    },
    {
      key: "totalLinks",
      header: "Links",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-2">
          <span className="text-gray-900">{value || 0}</span>
          {(row.brokenLinks || 0) > 0 && (
            <span className="text-xs text-red-600">
              ({row.brokenLinks} broken)
            </span>
          )}
        </div>
      ),
    },
    {
      key: "brokenLinks",
      header: "Status",
      sortable: true,
      render: (value) =>
        value > 0 ? (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
            {value} issues
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            Healthy
          </span>
        ),
    },
    {
      key: "lastScanDate",
      header: "Last Scan",
      sortable: true,
      render: (value) =>
        value ? new Date(value).toLocaleDateString() : "Never",
    },
    {
      key: "id",
      header: "Actions",
      render: (value, row) => (
        <div className="flex items-center space-x-2">
          {row.channelId && (
            <a
              href={`https://youtube.com/channel/${row.channelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title="View on YouTube"
            >
              <ExternalLink className="w-4 h-4 text-gray-600" />
            </a>
          )}
          <button
            onClick={() => deleteChannel(value)}
            disabled={actionLoading}
            className="p-1.5 hover:bg-red-100 rounded transition-colors"
            title="Delete channel"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Channels"
        subtitle="Monitor connected YouTube channels"
        onRefresh={loadChannels}
        loading={loading}
      />

      <div className="p-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatsCard
              title="Total Channels"
              value={stats.totalChannels}
              icon={<Youtube className="w-6 h-6" />}
              color="red"
            />
            <StatsCard
              title="Channels with Issues"
              value={stats.channelsWithIssues}
              icon={<AlertTriangle className="w-6 h-6" />}
              color={stats.channelsWithIssues > 0 ? "yellow" : "green"}
              subtitle={`${stats.totalBrokenLinks} total broken links`}
            />
            <StatsCard
              title="By Plan"
              value={`${stats.channelsByPlan.basic}/${stats.channelsByPlan.pro}/${stats.channelsByPlan.enterprise}`}
              icon={<Users className="w-6 h-6" />}
              color="blue"
              subtitle="Basic / Pro / Enterprise"
            />
            <StatsCard
              title="Trial Users"
              value={stats.channelsByPlan.trial}
              icon={<Users className="w-6 h-6" />}
              color="gray"
              subtitle="Channels from trial users"
            />
          </div>
        )}

        {/* Channels with Issues Alert */}
        {stats && stats.channelsWithIssues > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800">
                  Channels Need Attention
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  {stats.channelsWithIssues} channel
                  {stats.channelsWithIssues > 1 ? "s have" : " has"}{" "}
                  broken links that need to be fixed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Channels Table */}
        <DataTable
          columns={columns}
          data={channels}
          loading={loading}
          searchable
          searchPlaceholder="Search channels or users..."
          pageSize={25}
          exportable
          emptyMessage="No channels found"
        />
      </div>
    </div>
  );
}
