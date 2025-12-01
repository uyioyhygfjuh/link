'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Header from '@/components/Header';
import { ArrowLeft, ExternalLink, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface VideoReport {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  links: {
    url: string;
    status: 'working' | 'broken' | 'warning';
    statusCode: number;
  }[];
}

export default function VideoReportDetailPage() {
  const [report, setReport] = useState<VideoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const params = useParams();
  const videoId = params.videoId as string;

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadReport();
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, videoId]);

  const loadReport = async () => {
    try {
      const docRef = doc(db, 'videoReports', videoId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setReport(docSnap.data() as VideoReport);
      }
    } catch (error) {
      console.error('Error loading report:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'working':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'broken':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header user={user} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8">
        <Link href="/dashboard" className="inline-flex items-center text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        {report ? (
          <div>
            <h1 className="text-2xl font-bold text-white mb-4">{report.videoTitle}</h1>
            <a 
              href={report.videoUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-red-400 hover:text-red-300 flex items-center gap-2 mb-8"
            >
              View on YouTube <ExternalLink className="w-4 h-4" />
            </a>

            <h2 className="text-xl font-semibold text-white mb-4">Links Found ({report.links?.length || 0})</h2>
            <div className="space-y-3">
              {report.links?.map((link, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(link.status)}
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 truncate max-w-md"
                    >
                      {link.url}
                    </a>
                  </div>
                  <span className="text-gray-500 text-sm">HTTP {link.statusCode}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400">Report not found</p>
          </div>
        )}
      </main>
    </div>
  );
}