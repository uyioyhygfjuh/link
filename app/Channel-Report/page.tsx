'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Link from 'next/link';
import Header from '@/components/Header';
import { Shield, Youtube, BarChart3 } from 'lucide-react';

export default function ReportsIndexPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectedChannels, setConnectedChannels] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadConnectedChannels(currentUser.uid);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadConnectedChannels = async (userId: string) => {
    try {
      const channelsRef = collection(db, 'channels');
      const q = query(channelsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const channels = querySnapshot.docs.map(doc => ({
        firestoreId: doc.id,
        ...doc.data()
      }));
      
      setConnectedChannels(channels);
      setLoading(false);
    } catch (error) {
      console.error('Error loading channels:', error);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Unified Header */}
      <Header user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <BarChart3 className="w-16 h-16 text-primary-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Channel Reports</h1>
          <p className="text-gray-600">Select a channel to view its report</p>
        </div>

        {connectedChannels.length === 0 ? (
          <div className="card text-center py-12">
            <Youtube className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Channels Connected</h3>
            <p className="text-gray-600 mb-6">
              Connect a YouTube channel first to view reports
            </p>
            <Link href="/channels" className="btn-primary inline-block">
              Go to Channels
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connectedChannels.map((channel: any) => (
              <Link
                key={channel.channelId}
                href={`/Channel-Report/${channel.channelId}`}
                className="card hover:shadow-xl transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center space-x-4 mb-4">
                  {channel.channelImage ? (
                    <img 
                      src={channel.channelImage} 
                      alt={channel.channelName}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <Youtube className="w-8 h-8 text-red-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {channel.channelName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {channel.subscribers} subscribers
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-primary-600 font-medium">
                    View Report →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
