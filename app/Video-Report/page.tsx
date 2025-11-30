"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import {
  ArrowLeft,
  Video,
  Link as LinkIcon,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
} from "lucide-react";
import Link from "next/link";

interface VideoReport {
  id: string;
  title: string;
  videoId: string;
  thumbnail?: string;
  totalLinks: number;
  workingLinks: number;
  warningLinks: number;
  brokenLinks: number;
  scannedAt: string;
}

export default function VideoReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<VideoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      
      setUser(currentUser);
      
      try {
        const videosRef = collection(db, "videos");
        const q = query(
          videosRef,
          where("userId", "==", currentUser.uid),
          orderBy("scannedAt", "desc")
        );
        const snapshot = await getDocs(q);
        
        const reportData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as VideoReport[];
        
        setReports(reportData);
      } catch (error) {
        console.error("Error loading video reports:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const filteredReports = reports.filter(report =>
    report.title?.toLowerCase().includes(search.toLowerCase()) ||
    report.videoId?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading video reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Video Reports</h1>
              <p className="text-gray-400">View link analysis for your videos</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Reports List */}
        {filteredReports.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Video Reports</h3>
            <p className="text-gray-400 mb-6">
              {search ? "No videos match your search." : "You haven't scanned any videos yet."}
            </p>
            {!search && (
              <Link
                href="/Video"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Scan Videos
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredReports.map((report) => (
              <Link
                key={report.id}
                href={`/Video-Report/${report.id}`}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors block"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {report.thumbnail ? (
                      <img
                        src={report.thumbnail}
                        alt={report.title}
                        className="w-32 h-20 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-32 h-20 bg-gray-700 rounded-lg flex items-center justify-center">
                        <Video className="w-8 h-8 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {report.title || "Untitled Video"}
                      </h3>
                      <p className="text-sm text-gray-400">
                        Scanned: {new Date(report.scannedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white">{report.workingLinks || 0}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-white">{report.warningLinks || 0}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span className="text-white">{report.brokenLinks || 0}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
