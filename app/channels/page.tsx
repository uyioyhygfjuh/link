'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { applyPlanIfTrialEnded, getPolicy, capByPolicy, getEffectivePlanId, getPlanPolicyFromFirestore, getPlanDetailsFromFirestore } from '@/lib/plans';
import { logOut } from '@/lib/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc, getDoc, increment } from 'firebase/firestore';
import { connectYouTubeChannel, YouTubeChannel } from '@/lib/youtube';
import { notifyChannelAdded, notifyChannelRemoved, notifyScanCompleted } from '@/lib/notifications';
import { 
  Shield,
  Youtube, 
  RefreshCw,
  Plus,
  Users,
  Video,
  Link as LinkIcon,
  AlertTriangle,
  Calendar,
  BarChart3,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  Zap,
  AlertCircle,
  X
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';

export default function ChannelManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectedChannels, setConnectedChannels] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState(getPolicy('free'));
  const [planId, setPlanId] = useState<string>('free');
  const [planName, setPlanName] = useState('Free Trial');
  const [planStatus, setPlanStatus] = useState('Active');
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [usage, setUsage] = useState<{ totalScansUsed: number; trialCountScansUsed: number }>({ totalScansUsed: 0, trialCountScansUsed: 0 });
  const isTrial = planStatus === 'Trial';
  const trialRunsRemaining = isTrial ? Math.max(0, 2 - (usage.trialCountScansUsed || 0)) : undefined;

  // Scan modal states
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedScanChannel, setSelectedScanChannel] = useState<any>(null);
  const [scanMode, setScanMode] = useState<'count' | 'dateRange'>('count'); // New: track which mode is active
  const [scanVideoCount, setScanVideoCount] = useState('50');
  const [scanStartDate, setScanStartDate] = useState('');
  const [scanEndDate, setScanEndDate] = useState('');
  const [scanning, setScanning] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanningChannelName, setScanningChannelName] = useState<string | null>(null);
  
  // Auto-scan settings
  const [autoScanSettings, setAutoScanSettings] = useState<any>(null);

  // Mock user plan data
  const userPlan = {
    planName: 'Professional Plan',
    remainingScans: 450,
    totalScans: 500,
    validUntil: 'Dec 10, 2025',
    daysRemaining: 30
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
          const userData = userSnap.exists() ? userSnap.data() as any : {};
          const effective = await applyPlanIfTrialEnded(currentUser.uid);
          setPlanId(effective);
          
          // Fetch policy from Firestore for dynamic plans
          const firestorePolicy = await getPlanPolicyFromFirestore(effective);
          setPolicy(firestorePolicy);
          
          // Fetch plan details for name
          const planDetails = await getPlanDetailsFromFirestore(effective);
          const now = Date.now();
          const trialEndMs = userData?.trialEnd ? Date.parse(userData.trialEnd) : 0;
          const inTrial = userData?.planStatus === 'Trial' && trialEndMs && now <= trialEndMs;
          const dn = inTrial ? 'Free Trial' : (planDetails?.name || userData?.plan || 'Free Trial');
          setPlanName(dn);
          setPlanStatus(inTrial ? 'Trial' : (userData?.planStatus || 'Active'));
          const vu = inTrial ? new Date(trialEndMs).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : (userData?.renewalDate || null);
          setValidUntil(vu || null);
          const u = (userData?.usage || {}) as any;
          setUsage({
            totalScansUsed: Number(u?.totalScansUsed || 0),
            trialCountScansUsed: Number(u?.trialCountScansUsed || 0),
          });
          if (inTrial) {
            const dr = Math.max(0, Math.ceil((trialEndMs - now) / (24 * 60 * 60 * 1000)));
            setDaysRemaining(dr);
          } else {
            setDaysRemaining(null);
          }
          await loadConnectedChannels(currentUser.uid);
          
          // Load auto-scan settings
          try {
            const autoScanRes = await fetch('/api/noob/auto-scan?type=settings');
            const autoScanData = await autoScanRes.json();
            if (autoScanData.success) {
              setAutoScanSettings(autoScanData.settings);
            }
          } catch (e) {
            console.error('Error loading auto-scan settings:', e);
          }
        } catch (error) {
          console.error('Failed to load channels:', error);
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadConnectedChannels = async (userId: string) => {
    try {
      setLoadingChannels(true);
      console.log('Loading channels for user:', userId);
      
      const channelsRef = collection(db, 'channels');
      const q = query(channelsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const channels = querySnapshot.docs.map(doc => ({
        firestoreId: doc.id,
        ...doc.data()
      }));
      
      console.log('Loaded channels:', channels.length);
      setConnectedChannels(channels);
      setError(''); // Clear any previous errors
    } catch (error: any) {
      console.error('❌ Error loading channels:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      if (error.code === 'permission-denied') {
        console.error('🔒 PERMISSION DENIED: Firestore rules need to be configured!');
        console.error('👉 See FIRESTORE_RULES_SETUP.md for instructions');
        setError('Permission denied. Please configure Firestore rules. See console for details.');
      } else {
        setError('Failed to load channels. Check console for details.');
      }
    } finally {
      setLoadingChannels(false);
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

  // Load auto-scan settings
  const loadAutoScanSettings = async () => {
    try {
      const response = await fetch('/api/noob/auto-scan?type=settings');
      const data = await response.json();
      if (data.success) {
        setAutoScanSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading auto-scan settings:', error);
    }
  };

  // Toggle auto-scan for a channel
  const toggleChannelAutoScan = async (channelFirestoreId: string, enabled: boolean) => {
    try {
      const limits = getPlanAutoScanLimits();
      
      // Check max channels limit when enabling
      if (enabled) {
        const currentAutoScanCount = connectedChannels.filter(ch => ch.autoScanEnabled).length;
        const maxChannels = limits.maxChannels;
        
        if (maxChannels !== 'unlimited' && currentAutoScanCount >= maxChannels) {
          alert(`Maximum auto-scan channels (${maxChannels}) reached for your plan. Please disable auto-scan on another channel first or upgrade your plan.`);
          return;
        }
      }
      
      // Get the max videos from plan settings
      const maxVideos = limits.maxVideosPerScan === 'unlimited' ? 100 : (limits.maxVideosPerScan || 50);
      
      const channelRef = doc(db, 'channels', channelFirestoreId);
      await updateDoc(channelRef, {
        autoScanEnabled: enabled,
        autoScanFrequency: 'weekly',
        autoScanVideos: maxVideos,
        updatedAt: new Date().toISOString(),
      });
      
      // Reload channels
      if (user) {
        await loadConnectedChannels(user.uid);
      }
    } catch (error) {
      console.error('Error toggling auto-scan:', error);
      alert('Failed to update auto-scan setting');
    }
  };

  // Check if plan has auto-scan enabled
  const isPlanAutoScanEnabled = () => {
    if (!autoScanSettings) return false;
    return autoScanSettings.enabledPlans?.includes(planId);
  };

  // Get plan auto-scan limits
  const getPlanAutoScanLimits = (): { 
    maxChannels: number | 'unlimited'; 
    maxVideosPerScan: number | 'unlimited';
    maxScansPerChannel: number | 'unlimited';
    allowedFrequencies: string[];
  } => {
    if (!autoScanSettings || !isPlanAutoScanEnabled()) {
      return { maxChannels: 0, maxVideosPerScan: 0, maxScansPerChannel: 0, allowedFrequencies: [] };
    }
    const limits = autoScanSettings.planLimits?.[planId];
    return {
      maxChannels: limits?.maxChannels ?? 1,
      maxVideosPerScan: limits?.maxVideosPerScan ?? 50,
      maxScansPerChannel: limits?.maxScansPerChannel ?? 10,
      allowedFrequencies: limits?.allowedFrequencies || ['weekly'],
    };
  };

  // Get count of channels with auto-scan enabled
  const getAutoScanEnabledCount = () => {
    return connectedChannels.filter(ch => ch.autoScanEnabled).length;
  };

  // Correct auto-scan settings when they exceed plan limits (runs once when settings load)
  const [settingsCorrected, setSettingsCorrected] = useState(false);
  
  useEffect(() => {
    const correctAutoScanSettings = async () => {
      if (!autoScanSettings || !user || connectedChannels.length === 0 || settingsCorrected) return;
      
      const limits = getPlanAutoScanLimits();
      if (limits.maxChannels === 0) return; // Plan doesn't have auto-scan
      
      const autoScanChannels = connectedChannels.filter(ch => ch.autoScanEnabled);
      const maxVideos = limits.maxVideosPerScan === 'unlimited' ? null : limits.maxVideosPerScan;
      
      // Check if any channel has wrong video count and correct it
      let correctedCount = 0;
      for (const ch of autoScanChannels) {
        if (maxVideos && ch.autoScanVideos !== maxVideos) {
          try {
            const channelRef = doc(db, 'channels', ch.firestoreId);
            await updateDoc(channelRef, {
              autoScanVideos: maxVideos,
            });
            console.log(`✅ Corrected video count for ${ch.name || ch.channelName}: ${ch.autoScanVideos} → ${maxVideos}`);
            correctedCount++;
          } catch (e) {
            console.error('Error correcting channel:', e);
          }
        }
      }
      
      setSettingsCorrected(true);
      
      // Reload channels if we made corrections
      if (correctedCount > 0) {
        await loadConnectedChannels(user.uid);
      }
    };
    
    correctAutoScanSettings();
  }, [autoScanSettings, user, settingsCorrected]);

  const handleRefresh = async () => {
    if (!user) return;
    
    setRefreshing(true);
    await loadConnectedChannels(user.uid);
    await loadAutoScanSettings();
    setRefreshing(false);
  };

  const handleConnectChannel = () => {
    if (policy.maxChannels !== 'unlimited' && connectedChannels.length >= policy.maxChannels) {
      alert('Channel limit reached for your current plan. Please upgrade in Pricing to connect more channels.');
      return;
    }
    setShowConnectModal(true);
    setChannelInput('');
  };

  const handleCloseModal = () => {
    setShowConnectModal(false);
    setChannelInput('');
    setConnecting(false);
  };

  const handleSubmitChannel = async () => {
    if (!channelInput.trim()) {
      setError('Please enter a YouTube username or channel link');
      return;
    }

    if (!user) return;

    setConnecting(true);
    setError('');
    
    try {
      // Fetch channel data from YouTube API
      const channelData = await connectYouTubeChannel(channelInput);
      
      if (!channelData) {
        setError('Channel not found. Please check the username or link.');
        setConnecting(false);
        return;
      }

      // Check if channel already connected
      const existingChannel = connectedChannels.find(ch => ch.channelId === channelData.id);
      if (existingChannel) {
        setError('This channel is already connected');
        setConnecting(false);
        return;
      }

      // Save to Firestore
      const channelsRef = collection(db, 'channels');
      const channelDoc = await addDoc(channelsRef, {
        userId: user.uid,
        channelId: channelData.id,
        channelName: channelData.title,
        channelImage: channelData.thumbnail,
        subscribers: channelData.subscriberCount,
        videosCount: channelData.videoCount,
        customUrl: channelData.customUrl,
        totalScans: 0,
        brokenLinks: 0,
        lastScan: null,
        status: 'active',
        connectedAt: new Date().toISOString()
      });

      // Send notification
      await notifyChannelAdded(user.uid, channelData.title, channelDoc.id);

      // Reload channels
      await loadConnectedChannels(user.uid);
      
      setConnecting(false);
      handleCloseModal();
      alert(`Successfully connected: ${channelData.title}`);
    } catch (error: any) {
      console.error('Error connecting channel:', error);
      setError(error.message || 'Failed to connect channel. Please try again.');
      setConnecting(false);
    }
  };

  const isValidInput = channelInput.trim().length > 0;

  const handleScanChannel = (channel: any) => {
    setSelectedScanChannel(channel);
    setShowScanModal(true);
    // Reset form
    setScanVideoCount('50');
    setScanStartDate('');
    setScanEndDate('');
  };

  const handleStartScan = async () => {
    if (!selectedScanChannel) return;
    
    // Validate inputs
    const videoCount = parseInt(scanVideoCount);
    if (isNaN(videoCount) || videoCount < 1) {
      alert('Please enter a valid number of videos (minimum 1)');
      return;
    }
    if (scanMode === 'dateRange' && isTrial) {
      alert('Date range scanning is available on paid plans.');
      return;
    }
    if (isTrial && scanMode === 'count') {
      const remaining = Math.max(0, 2 - (usage.trialCountScansUsed || 0));
      if (remaining < 1) {
        alert('Free Trial limit reached: Scan by Video Count can be used only 2 times.');
        return;
      }
    }
    
    if (scanStartDate && scanEndDate && new Date(scanStartDate) > new Date(scanEndDate)) {
      alert('Start date must be before end date');
      return;
    }
    
    // Enforce remaining allowances before starting
    if (policy.maxScans !== 'unlimited') {
      const remainingScans = Math.max(0, (policy.maxScans as number) - (usage.totalScansUsed || 0));
      if (remainingScans < 1) {
        alert('No scans remaining in your plan.');
        return;
      }
    }
    
    // Close modal immediately when scan starts
    setShowScanModal(false);
    setScanning(true);
    setScanningChannelName(selectedScanChannel.channelName);
    
    try {
      console.log('Starting scan for channel:', selectedScanChannel.channelName);
      console.log('Scan mode:', scanMode);
      
      // Prepare request body based on scan mode
      const requestBody: any = {
        channelId: selectedScanChannel.channelId,
      };
      
      if (scanMode === 'count') {
        requestBody.videoCount = isTrial ? 10 : videoCount;
        console.log('Parameters:', { videoCount: requestBody.videoCount });
      } else {
        requestBody.videoCount = 999999;
        requestBody.startDate = scanStartDate;
        requestBody.endDate = scanEndDate;
        console.log('Parameters:', { startDate: scanStartDate, endDate: scanEndDate });
      }
      
      // Add userId, channelName, and firestoreDocId to request
      requestBody.userId = user?.uid;
      requestBody.channelName = selectedScanChannel.channelName;
      requestBody.firestoreDocId = selectedScanChannel.firestoreId;
      requestBody.scanMode = scanMode;
      
      // Use synchronous scan (async requires Redis which may not be set up)
      console.log('Using synchronous scan mode...');
      const response = await fetch('/api/scan-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start scan');
      }

      console.log('Scan response:', data);
      
      // Backend has already saved results to Firestore
      console.log('✅ Scan completed and results saved to database!');
      
      // Send scan completion notification
      if (user) {
        await notifyScanCompleted(
          user.uid,
          selectedScanChannel.channelName,
          data.scannedVideos,
          data.statistics.brokenLinks,
          selectedScanChannel.channelId
        );
      }
      
      alert(
        `✅ Scan Complete & Saved!\n\n` +
        `Channel: ${selectedScanChannel.channelName}\n` +
        `Videos Scanned: ${data.scannedVideos}\n` +
        `Videos with Links: ${data.videosWithLinks}\n\n` +
        `📊 Results:\n` +
        `Total Links: ${data.statistics.totalLinks}\n` +
        `✅ Working: ${data.statistics.workingLinks}\n` +
        `⚠️ Warning: ${data.statistics.warningLinks}\n` +
        `❌ Broken: ${data.statistics.brokenLinks}\n\n` +
        `💾 Results saved to database!\n` +
        `You can close the browser - results will remain available.\n\n` +
        `View detailed report in the Reports page.`
      );
      
      // Clear selected channel after scan completes
      setSelectedScanChannel(null);
      setScanningChannelName(null);
      
      // Reload channels to show updated data and persist scan count
      if (user) {
        loadConnectedChannels(user.uid);
        try {
          const updates: any = { 'usage.totalScansUsed': increment(1) };
          if (isTrial && scanMode === 'count') {
            updates['usage.trialCountScansUsed'] = increment(1);
          }
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, updates);
          setUsage(prev => ({
            ...prev,
            totalScansUsed: (prev.totalScansUsed || 0) + 1,
            trialCountScansUsed: (isTrial && scanMode === 'count') ? (prev.trialCountScansUsed || 0) + 1 : (prev.trialCountScansUsed || 0),
          }));
        } catch {}
      }
      
    } catch (error: any) {
      console.error('Scan error:', error);
      alert(`❌ Scan Failed\n\n${error.message || 'An error occurred while scanning. Please try again.'}`);
      // Reopen modal on error so user can try again
      setShowScanModal(true);
      setScanningChannelName(null);
    } finally {
      setScanning(false);
    }
  };

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/scan-status?jobId=${jobId}`);
        const data = await response.json();
        
        if (!response.ok) {
          console.error('Failed to fetch job status:', data.error);
          clearInterval(pollInterval);
          setScanning(false);
          setCurrentJobId(null);
          return;
        }
        
        console.log(`Job ${jobId} status:`, data.status, `Progress: ${data.progress}%`);
        setScanProgress(data.progress);
        
        if (data.status === 'completed') {
          clearInterval(pollInterval);
          setScanning(false);
          setCurrentJobId(null);
          setScanProgress(0);
          
          // Show completion message
          alert(
            `✅ Scan Complete!\n\n` +
            `Channel: ${data.channelName}\n` +
            `Videos Scanned: ${data.result.scannedVideos}\n` +
            `Videos with Links: ${data.result.videosWithLinks}\n\n` +
            `📊 Results:\n` +
            `Total Links: ${data.result.statistics.totalLinks}\n` +
            `✅ Working: ${data.result.statistics.workingLinks}\n` +
            `⚠️ Warning: ${data.result.statistics.warningLinks}\n` +
            `❌ Broken: ${data.result.statistics.brokenLinks}\n\n` +
            `View detailed report in the Reports page.`
          );
          
          // Reload channels to show updated data
          if (user) {
            loadConnectedChannels(user.uid);
          }
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          setScanning(false);
          setCurrentJobId(null);
          setScanProgress(0);
          
          alert(`❌ Scan Failed\n\n${data.error || 'Unknown error occurred'}`);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 3000); // Poll every 3 seconds
    
    // Stop polling after 30 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setScanning(false);
      setCurrentJobId(null);
    }, 30 * 60 * 1000);
  };

  const handleViewReport = (channelId: string) => {
    router.push(`/Channel-Report/${channelId}`);
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Invalid date';
    }
  };

  const handleRemoveChannel = async (firestoreId: string, channelName: string) => {
    if (!confirm(`Are you sure you want to remove ${channelName}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'channels', firestoreId));
      
      // Send notification
      if (user) {
        await notifyChannelRemoved(user.uid, channelName);
      }
      
      // Reload channels
      if (user) {
        await loadConnectedChannels(user.uid);
      }
      
      alert(`Channel ${channelName} removed successfully`);
    } catch (error) {
      console.error('Error removing channel:', error);
      alert('Failed to remove channel');
    }
  };

  if (loading || loadingChannels) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-primary-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const planChannels = policy.maxChannels === 'unlimited'
    ? 'Unlimited'
    : String(Math.max(0, (policy.maxChannels as number) - connectedChannels.length));
  const planBulkPerRun = policy.maxBulkVideosPerRun === 'unlimited' ? 'Unlimited' : String(policy.maxBulkVideosPerRun);
  const planTotalScans = policy.maxScans === 'unlimited'
    ? 'Unlimited'
    : String(Math.max(0, (policy.maxScans as number) - (usage.totalScansUsed || 0)));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <Header user={user} onLogout={handleLogout} />

      {/* Scanning Progress Banner */}
      {scanning && scanningChannelName && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-blue-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center space-x-4 min-w-[400px]">
            <div className="animate-spin">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">Scanning in Progress...</p>
              <p className="text-sm text-blue-100">
                {scanningChannelName} • Keep browser open
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-75"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Channel Management</h1>
            <p className="text-gray-600">Manage your connected YouTube channels</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleConnectChannel}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Channel</span>
            </button>
          </div>
        </div>

        {/* User Plan Details Card */}
        <div className="card mb-8 bg-gradient-to-br from-primary-50 to-purple-50 border-primary-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
              <Zap className="w-6 h-6 text-primary-600" />
              <span>Your Plan</span>
            </h2>
            <span className="px-3 py-1 bg-primary-600 text-white text-sm font-semibold rounded-full">
              {planName}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Channels Usage */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Channels</p>
                <Youtube className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {connectedChannels.length}
                <span className="text-sm font-normal text-gray-500">
                  /{policy.maxChannels === 'unlimited' ? '∞' : policy.maxChannels}
                </span>
              </p>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-600 rounded-full"
                  style={{ 
                    width: policy.maxChannels === 'unlimited' 
                      ? '30%' 
                      : `${Math.min(100, (connectedChannels.length / (policy.maxChannels as number)) * 100)}%` 
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {planChannels} remaining
              </p>
            </div>

            {/* Scans */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Scans Left</p>
                <RefreshCw className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{planTotalScans}</p>
              <p className="text-xs text-gray-500">
                {policy.maxScans === 'unlimited' ? 'Unlimited scans' : `${usage.totalScansUsed || 0} used`}
              </p>
            </div>

            {/* Auto-Scan Status */}
            <div className={`rounded-lg p-4 shadow-sm ${isPlanAutoScanEnabled() ? 'bg-green-50 border border-green-200' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Auto-Scan</p>
                <Zap className={`w-5 h-5 ${isPlanAutoScanEnabled() ? 'text-green-500' : 'text-gray-400'}`} />
              </div>
              {isPlanAutoScanEnabled() ? (
                <>
                  <p className="text-lg font-bold text-green-600 mb-1">Enabled</p>
                  <p className="text-xs text-green-600">
                    Up to {getPlanAutoScanLimits().maxChannels === 'unlimited' ? '∞' : getPlanAutoScanLimits().maxChannels} channels
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-gray-400 mb-1">Not Available</p>
                  <Link href="/pricing" className="text-xs text-primary-600 hover:underline">
                    Upgrade to unlock →
                  </Link>
                </>
              )}
            </div>

            {/* Status */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Status</p>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-lg font-bold text-green-600 mb-1">{planStatus}</p>
              {validUntil && (
                <p className="text-xs text-gray-500">
                  {planStatus === 'Trial' ? 'Ends' : 'Renews'}: {validUntil}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-primary-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {isPlanAutoScanEnabled() && (
                <span className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  <span>
                    Auto-scan available: {getAutoScanEnabledCount()}/{getPlanAutoScanLimits().maxChannels === 'unlimited' ? '∞' : getPlanAutoScanLimits().maxChannels} channels enabled
                    {getPlanAutoScanLimits().maxVideosPerScan !== 'unlimited' && ` • ${getPlanAutoScanLimits().maxVideosPerScan} videos/scan`}
                  </span>
                </span>
              )}
            </div>
            <Link href="/pricing" className="text-sm text-primary-700 font-medium hover:text-primary-800 transition-colors">
              Upgrade Plan →
            </Link>
          </div>
        </div>

        {/* Connected Channels Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connected Channels</h2>
          <p className="text-gray-600">
            {connectedChannels.length} {connectedChannels.length === 1 ? 'channel' : 'channels'} connected
          </p>
        </div>

        {/* Warning if too many channels have auto-scan enabled */}
        {isPlanAutoScanEnabled() && 
         getPlanAutoScanLimits().maxChannels !== 'unlimited' && 
         getAutoScanEnabledCount() > (getPlanAutoScanLimits().maxChannels as number) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 font-medium">Auto-scan limit exceeded</p>
              <p className="text-amber-700 text-sm mt-1">
                Your plan allows auto-scan for {getPlanAutoScanLimits().maxChannels} channel(s), but you have {getAutoScanEnabledCount()} enabled.
                Please disable auto-scan on {getAutoScanEnabledCount() - (getPlanAutoScanLimits().maxChannels as number)} channel(s) or upgrade your plan.
              </p>
            </div>
          </div>
        )}

        {/* Channels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {connectedChannels.map((channel) => (
            <div key={channel.firestoreId} className="card hover:shadow-xl transition-all duration-300">
              {/* Channel Header */}
              <div className="flex items-start space-x-4 mb-4">
                {channel.channelImage ? (
                  <img 
                    src={channel.channelImage} 
                    alt={channel.channelName}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Youtube className="w-8 h-8 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate mb-1">
                    {channel.channelName}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{channel.subscribers}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Video className="w-4 h-4" />
                      <span>{channel.videosCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">Total Scans</p>
                  <p className="text-xl font-bold text-blue-600">{channel.totalScans || 0}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">Broken Links</p>
                  <p className="text-xl font-bold text-orange-600">{channel.brokenLinks || 0}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">Last Scan</p>
                  <p className="text-xs font-semibold text-green-600">{formatDate(channel.lastScan)}</p>
                </div>
              </div>

              {/* Scan Results Summary (if available) */}
              {channel.lastScanResults && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">Latest Scan Results</p>
                    <span className="text-xs text-gray-500">{formatDate(channel.lastScanResults.scannedAt)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-xs text-gray-600">Videos</p>
                      <p className="text-sm font-bold text-gray-900">{channel.lastScanResults.scannedVideos}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Links</p>
                      <p className="text-sm font-bold text-blue-600">{channel.lastScanResults.totalLinks}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Working</p>
                      <p className="text-sm font-bold text-green-600">{channel.lastScanResults.workingLinks}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Broken</p>
                      <p className="text-sm font-bold text-red-600">{channel.lastScanResults.brokenLinks}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-Scan Toggle */}
              <div className={`mb-4 p-3 rounded-lg border ${channel.autoScanEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${channel.autoScanEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Zap className={`w-4 h-4 ${channel.autoScanEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Auto-Scan</p>
                      <p className="text-xs text-gray-500">
                        {isPlanAutoScanEnabled() 
                          ? (channel.autoScanEnabled ? 'Enabled - Scans automatically' : 'Click to enable')
                          : 'Upgrade plan to unlock'}
                      </p>
                    </div>
                  </div>
                  {isPlanAutoScanEnabled() ? (
                    <button
                      onClick={() => toggleChannelAutoScan(channel.firestoreId, !channel.autoScanEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        channel.autoScanEnabled ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          channel.autoScanEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <Link href="/pricing" className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors">
                      Upgrade
                    </Link>
                  )}
                </div>
                {channel.autoScanEnabled && (
                  <div className="mt-2 pt-2 border-t border-green-200 flex items-center justify-between text-xs">
                    <span className="text-green-700">
                      {channel.autoScanFrequency ? channel.autoScanFrequency.charAt(0).toUpperCase() + channel.autoScanFrequency.slice(1) : 'Weekly'} • {
                        channel.autoScanVideos || getPlanAutoScanLimits().maxVideosPerScan || 50
                      } videos
                    </span>
                    {channel.lastAutoScan && (
                      <span className="text-green-600">Last: {formatDate(channel.lastAutoScan)}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => handleScanChannel(channel)}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Scan</span>
                </button>
                <button
                  onClick={() => handleViewReport(channel.channelId)}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Report</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleScanChannel(channel)}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => handleRemoveChannel(channel.firestoreId, channel.channelName)}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              </div>

              {/* Status Badge */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Status</span>
                  <span className="flex items-center space-x-1 text-xs font-medium text-green-600">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                    <span>Active</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State (if no channels) */}
        {connectedChannels.length === 0 && (
          <div className="card text-center py-12">
            <Youtube className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Channels Connected</h3>
            <p className="text-gray-600 mb-6">
              Connect your first YouTube channel to start monitoring links
            </p>
            <button
              onClick={handleConnectChannel}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Your First Channel</span>
            </button>
          </div>
        )}

        {/* Info Banner - Only show if no channels */}
        {connectedChannels.length === 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Get Started</h3>
                <p className="text-sm text-blue-800">
                  Connect your YouTube channel using the "Connect Channel" button above to start monitoring links in your video descriptions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connect Channel Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Youtube className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Connect YouTube Channel</h2>
                  <p className="text-sm text-gray-600">Add a channel to monitor</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={connecting}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              <div className="mb-4">
                <label htmlFor="channelInput" className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube Username or Channel Link
                </label>
                <input
                  id="channelInput"
                  type="text"
                  value={channelInput}
                  onChange={(e) => {
                    setChannelInput(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g., @username or youtube.com/channel/..."
                  className="input-field"
                  disabled={connecting}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && isValidInput && !connecting) {
                      handleSubmitChannel();
                    }
                  }}
                />
              </div>

              {/* Examples */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">Examples:</p>
                <div className="space-y-1 text-xs text-gray-600">
                  <p>• Username: <span className="font-mono bg-white px-2 py-0.5 rounded">@channelname</span></p>
                  <p>• Channel URL: <span className="font-mono bg-white px-2 py-0.5 rounded">youtube.com/c/channelname</span></p>
                  <p>• Channel ID: <span className="font-mono bg-white px-2 py-0.5 rounded">UCxxxxxxxxxxxxxxxxxx</span></p>
                </div>
              </div>

              {/* Info Box */}
              <div className="flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">
                  We'll securely connect to your YouTube channel to monitor links in video descriptions.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 btn-secondary"
                  disabled={connecting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitChannel}
                  disabled={!isValidInput || connecting}
                  className="flex-1 btn-primary flex items-center justify-center space-x-2"
                >
                  {connecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Connect Channel</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scan Configuration Modal */}
      {showScanModal && selectedScanChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header with Channel Info */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 rounded-t-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Configure Scan</h2>
                <button
                  onClick={() => {
                    setShowScanModal(false);
                    setSelectedScanChannel(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                  disabled={scanning}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Channel Display */}
              <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                {selectedScanChannel.channelImage ? (
                  <img 
                    src={selectedScanChannel.channelImage} 
                    alt={selectedScanChannel.channelName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <Youtube className="w-8 h-8 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">
                    {selectedScanChannel.channelName}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-white/90">
                    <span>{selectedScanChannel.subscribers} subscribers</span>
                    <span>•</span>
                    <span>{selectedScanChannel.videosCount} videos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Scan Mode Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select Scan Method
                </label>
                <div className="space-y-3">
                  {/* Option 1: Video Count */}
                  <div 
                    onClick={() => {
                      if (scanning) return;
                      if (isTrial && trialRunsRemaining === 0) { alert('Free Trial limit reached: Scan by Video Count can be used only 2 times.'); return; }
                      setScanMode('count');
                    }}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      scanMode === 'count' 
                        ? 'border-primary-600 bg-primary-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    } ${(scanning || (isTrial && trialRunsRemaining === 0)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex items-center h-5">
                        <input
                          type="radio"
                          name="scanMode"
                          checked={scanMode === 'count'}
                          onChange={() => setScanMode('count')}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                          disabled={scanning || (isTrial && trialRunsRemaining === 0)}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900 mb-1 cursor-pointer">
                          Scan by Video Count
                        </label>
                        <p className="text-xs text-gray-600 mb-3">
                          Specify the number of recent videos to scan
                        </p>
                        {isTrial && (
                          <div className="mb-2 text-xs text-blue-700">
                            Free Trial: scans exactly 10 videos per run. {trialRunsRemaining !== undefined ? `${trialRunsRemaining} run${trialRunsRemaining === 1 ? '' : 's'} remaining.` : ''}
                          </div>
                        )}
                        {scanMode === 'count' && (
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              value={scanVideoCount}
                              onChange={(e) => setScanVideoCount(e.target.value)}
                              className="input-field pr-20"
                              placeholder="Enter number of videos"
                              disabled={scanning || (isTrial && trialRunsRemaining === 0)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                              videos
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Date Range */}
                  <div 
                    onClick={() => {
                      if (scanning) return;
                      if (isTrial) { alert('Date range scanning is available on paid plans.'); return; }
                      setScanMode('dateRange');
                    }}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      scanMode === 'dateRange' 
                        ? 'border-primary-600 bg-primary-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    } ${(scanning || isTrial) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex items-center h-5">
                        <input
                          type="radio"
                          name="scanMode"
                          checked={scanMode === 'dateRange'}
                          onChange={() => { if (isTrial) { alert('Date range scanning is available on paid plans.'); return; } setScanMode('dateRange'); }}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                          disabled={scanning || isTrial}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900 mb-1 cursor-pointer">
                          Scan by Date Range
                        </label>
                        <p className="text-xs text-gray-600 mb-3">
                          Select a specific date range for videos
                        </p>
                        {isTrial && (
                          <p className="text-xs text-red-600">Locked on Free Trial</p>
                        )}
                        {scanMode === 'dateRange' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" onClick={(e) => e.stopPropagation()}>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-2">
                                Start Date
                              </label>
                              <input
                                type="date"
                                value={scanStartDate}
                                onChange={(e) => setScanStartDate(e.target.value)}
                                className="input-field"
                                disabled={scanning}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-2">
                                End Date
                              </label>
                              <input
                                type="date"
                                value={scanEndDate}
                                onChange={(e) => setScanEndDate(e.target.value)}
                                className="input-field"
                                disabled={scanning}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Scan Configuration</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Method: <span className="font-semibold">{scanMode === 'count' ? 'Video Count' : 'Date Range'}</span></li>
                      {scanMode === 'count' ? (
                        <li>• Videos to scan: <span className="font-semibold">{scanVideoCount || '0'} video(s)</span></li>
                      ) : (
                        <li>• Date Range: <span className="font-semibold">{scanStartDate && scanEndDate ? `${scanStartDate} to ${scanEndDate}` : 'Not set'}</span></li>
                      )}
                      <li>• This scan will check all links in video descriptions</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">ℹ️ Note:</span> You can scan any number of videos from the channel. 
                  The system uses YouTube Playlist API to fetch all videos without limitations. 
                  For large scans (1000+ videos), the process may take several minutes.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowScanModal(false);
                  setSelectedScanChannel(null);
                }}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={scanning}
              >
                Cancel
              </button>
              <button
                onClick={handleStartScan}
                disabled={
                  scanning || 
                  (scanMode === 'count' && (!scanVideoCount || parseInt(scanVideoCount) < 1)) ||
                  (scanMode === 'dateRange' && (!scanStartDate || !scanEndDate))
                }
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {scanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Starting Scan...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Start Scan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
