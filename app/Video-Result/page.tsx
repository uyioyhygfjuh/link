'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import Link from 'next/link';
import Header from '@/components/Header';
import { notifySessionDeleted } from '@/lib/notifications';
import { 
  Shield, 
  ArrowLeft,
  FileText,
  Calendar,
  Video,
  Link as LinkIcon,
  BarChart3,
  ArrowRight,
  Trash2,
  X
} from 'lucide-react';

interface ScanSession {
  sessionId: string;
  sessionName: string;
  scannedAt: string;
  videoCount: number;
  statistics: {
    totalVideos: number;
    totalLinks: number;
    workingLinks: number;
    warningLinks: number;
    brokenLinks: number;
  };
  videoIds: string[];
}

export default function VideoResultPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanSessions, setScanSessions] = useState<ScanSession[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ScanSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadScanSessions(currentUser.uid);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadScanSessions = async (userId: string) => {
    try {
      setLoading(true);
      console.log('Loading scan sessions for user:', userId);
      
      const sessionsRef = collection(db, 'scanSessions');
      const q = query(sessionsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const sessions: ScanSession[] = querySnapshot.docs.map(doc => doc.data() as ScanSession);
      
      // Sort by date (newest first)
      sessions.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
      
      console.log(`Loaded ${sessions.length} scan sessions`);
      setScanSessions(sessions);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading scan sessions:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteClick = (e: React.MouseEvent, session: ScanSession) => {
    e.preventDefault();
    e.stopPropagation();
    setSessionToDelete(session);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return;
    
    try {
      setDeleting(true);
      console.log('Deleting session:', sessionToDelete.sessionId);
      const current = sessionToDelete;
      
      // Delete all video scans associated with this session
      for (const videoId of sessionToDelete.videoIds) {
        try {
          await deleteDoc(doc(db, 'videoScans', videoId));
          console.log(`Deleted video scan: ${videoId}`);
        } catch (error) {
          console.error(`Error deleting video scan ${videoId}:`, error);
        }
      }
      
      // Delete the session document
      await deleteDoc(doc(db, 'scanSessions', current.sessionId));
      console.log(`Deleted session: ${current.sessionId}`);
      
      // Update local state
      setScanSessions(prev => prev.filter(s => s.sessionId !== current.sessionId));
      
      // Close modal
      setDeleteModalOpen(false);
      setSessionToDelete(null);
      setDeleting(false);
      
      if (user && current) {
        await notifySessionDeleted(
          user.uid,
          current.sessionName,
          current.sessionId,
          current.videoCount
        );
      }

      alert('Scan session deleted successfully!');
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete scan session. Please try again.');
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setSessionToDelete(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-primary-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading video results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Unified Header */}
      <Header user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link 
          href="/Video"
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Video Scanner</span>
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Video Scan Results</h1>
          <p className="text-lg text-gray-600">Select a scan session to view its report</p>
        </div>

        {/* Scan Sessions Grid */}
        {scanSessions.length === 0 ? (
          <div className="card text-center py-16">
            <FileText className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">No Scan Sessions Yet</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Upload a CSV with YouTube video URLs to create your first scan session and see results here
            </p>
            <Link href="/Video" className="btn-primary inline-flex items-center space-x-2">
              <Video className="w-5 h-5" />
              <span>Go to Video Scanner</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scanSessions.map((session) => (
              <div key={session.sessionId} className="relative">
                <Link
                  href={`/Video-Result/${session.sessionId}`}
                  className="card hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group block"
                >
                  {/* Session Icon */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">Session ID</div>
                      <div className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {session.sessionId.split('_')[1]?.substring(0, 8)}...
                      </div>
                    </div>
                  </div>

                {/* Session Name */}
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {session.sessionName}
                </h3>

                {/* Timestamp */}
                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(session.scannedAt)}</span>
                </div>

                {/* Statistics */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2 text-gray-700">
                      <Video className="w-4 h-4" />
                      <span>Videos Scanned</span>
                    </div>
                    <span className="font-semibold text-gray-900">{session.videoCount}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2 text-gray-700">
                      <LinkIcon className="w-4 h-4" />
                      <span>Total Links</span>
                    </div>
                    <span className="font-semibold text-gray-900">{session.statistics.totalLinks}</span>
                  </div>
                </div>

                {/* Status Summary */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs font-medium text-gray-700">{session.statistics.workingLinks}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-xs font-medium text-gray-700">{session.statistics.warningLinks}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-xs font-medium text-gray-700">{session.statistics.brokenLinks}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 text-primary-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                    <span>View Report</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
              
              {/* Delete Button */}
              <button
                onClick={(e) => handleDeleteClick(e, session)}
                className="absolute top-4 right-4 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg z-10"
                title="Delete this scan session"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Delete Scan Session</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={handleDeleteCancel}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={deleting}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Are you sure you want to delete the scan session <strong>"{sessionToDelete?.sessionName}"</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-medium mb-2">This will permanently delete:</p>
                <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                  <li>{sessionToDelete?.videoCount} video scan results</li>
                  <li>All link analysis data</li>
                  <li>Session statistics and history</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
