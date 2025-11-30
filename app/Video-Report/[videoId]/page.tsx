"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft,
  Video,
  Link as LinkIcon,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface VideoData {
  id: string;
  title: string;
  videoId: string;
  thumbnail?: string;
  publishedAt?: string;
  links: LinkData[];
}

interface LinkData {
  url: string;
  status: "working" | "warning" | "broken";
  statusCode?: number;
  responseTime?: number;
}

export default function VideoReportPage() {
  const router = useRouter();
  const params = useParams();
  const videoId = params.videoId as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      
      setUser(currentUser);
      
      if (!videoId) {
        setError("No video ID provided");
        setLoading(false);
        return;
      }

      try {
        // Try to fetch video data from Firestore
        const videoRef = doc(db, "videos", videoId);
        const videoDoc = await getDoc(videoRef);
        
        if (videoDoc.exists()) {
          setVideo({
            id: videoDoc.id,
            ...videoDoc.data(),
          } as VideoData);
        } else {
          setError("Video not found");
        }
      } catch (err) {
        console.error("Error loading video:", err);
        setError("Failed to load video data");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, videoId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading video report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const workingLinks = video?.links?.filter(l => l.status === "working") || [];
  const warningLinks = video?.links?.filter(l => l.status === "warning") || [];
  const brokenLinks = video?.links?.filter(l => l.status === "broken") || [];

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <Link
            href="/Video-Result"
            className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Video Report</h1>
            <p className="text-gray-400">Link analysis for this video</p>
          </div>
        </div>

        {/* Video Info */}
        {video && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-start space-x-4">
              {video.thumbnail ? (
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-40 h-24 object-cover rounded-lg"
                />
              ) : (
                <div className="w-40 h-24 bg-gray-700 rounded-lg flex items-center justify-center">
                  <Video className="w-8 h-8 text-gray-500" />
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white mb-2">{video.title}</h2>
                <p className="text-sm text-gray-400">Video ID: {video.videoId}</p>
                {video.publishedAt && (
                  <p className="text-sm text-gray-400">
                    Published: {new Date(video.publishedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{workingLinks.length}</p>
            <p className="text-sm text-gray-400">Working Links</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{warningLinks.length}</p>
            <p className="text-sm text-gray-400">Warning Links</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{brokenLinks.length}</p>
            <p className="text-sm text-gray-400">Broken Links</p>
          </div>
        </div>

        {/* Links List */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">All Links</h3>
          
          {video?.links && video.links.length > 0 ? (
            <div className="space-y-3">
              {video.links.map((link, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {link.status === "working" ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : link.status === "warning" ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-gray-300 truncate">{link.url}</span>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <LinkIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No links found in this video</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
