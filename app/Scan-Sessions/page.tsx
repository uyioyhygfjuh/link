'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import Header from '@/components/Header';

interface ScanSession {
  id: string;
  channelId: string;
  channelTitle: string;
  scannedAt: Date;
  totalVideos: number;
  brokenLinks: number;
}

export default function ScanSessionsPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadSessions(currentUser.uid);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadSessions = async (userId: string) => {
    try {
      const sessionsRef = collection(db, 'scanSessions');
      const q = query(
        sessionsRef,
        where('userId', '==', userId),
        orderBy('scannedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scannedAt: doc.data().scannedAt?.toDate() || new Date()
      })) as ScanSession[];
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error loading sessions:', error);
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
        <h1 className="text-3xl font-bold text-white mb-8">Scan Sessions</h1>
        
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No scan sessions yet.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Start Your First Scan
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 cursor-pointer"
                onClick={() => router.push(`/Video-Result/${session.id}`)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {session.channelTitle}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {session.scannedAt.toLocaleDateString()} at{' '}
                      {session.scannedAt.toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white">{session.totalVideos} videos</p>
                    <p className={session.brokenLinks > 0 ? 'text-red-400' : 'text-green-400'}>
                      {session.brokenLinks} broken links
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}