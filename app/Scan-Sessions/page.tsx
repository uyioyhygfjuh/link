"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import {
  Scan,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface ScanSession {
  id: string;
  channelName?: string;
  status: string;
  totalVideos: number;
  totalLinks: number;
  workingLinks: number;
  warningLinks: number;
  brokenLinks: number;
  createdAt: string;
  completedAt?: string;
}

export default function ScanSessionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [scans, setScans] = useState<ScanSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      
      setUser(currentUser);
      
      try {
        const scansRef = collection(db, "scanSessions");
        const q = query(
          scansRef,
          where("userId", "==", currentUser.uid),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        
        const scanData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ScanSession[];
        
        setScans(scanData);
      } catch (error) {
        console.error("Error loading scans:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading scan sessions...</p>
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
              <h1 className="text-2xl font-bold text-white">Scan Sessions</h1>
              <p className="text-gray-400">View your scan history</p>
            </div>
          </div>
        </div>

        {/* Scans List */}
        {scans.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <Scan className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Scan Sessions</h3>
            <p className="text-gray-400 mb-6">You haven&apos;t run any scans yet.</p>
            <Link
              href="/channels"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Scanning
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-lg ${
                      scan.status === "completed" ? "bg-green-500/20" : 
                      scan.status === "failed" ? "bg-red-500/20" : "bg-blue-500/20"
                    }`}>
                      {scan.status === "completed" ? (
                        <CheckCircle className="w-6 h-6 text-green-400" />
                      ) : scan.status === "failed" ? (
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                      ) : (
                        <Clock className="w-6 h-6 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {scan.channelName || "Channel Scan"}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {new Date(scan.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="text-center">
                      <p className="text-gray-400">Videos</p>
                      <p className="text-white font-semibold">{scan.totalVideos}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">Links</p>
                      <p className="text-white font-semibold">{scan.totalLinks}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">Broken</p>
                      <p className="text-red-400 font-semibold">{scan.brokenLinks}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
