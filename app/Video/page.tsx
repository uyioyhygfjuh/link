'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { applyPlanIfTrialEnded, getPolicy, capByPolicy, getPlanPolicyFromFirestore, getPlanDetailsFromFirestore } from '@/lib/plans';
import { logOut } from '@/lib/auth';
import Header from '@/components/Header';
import Link from 'next/link';
import { 
  Shield,
  Download,
  Upload,
  Video as VideoIcon,
  Link as LinkIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  FileText,
  Search,
  RefreshCw,
  Youtube,
  X,
  BarChart3
} from 'lucide-react';
import { connectYouTubeChannel, YouTubeChannel, getChannelVideosByDateRange, getVideoDetails, extractLinksFromDescription } from '@/lib/youtube';
import { notifyExtractCompleted, notifyBulkScanCompleted } from '@/lib/notifications';

interface VideoData {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  publishedAt: string;
}

interface ScanResult {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  links: {
    url: string;
    status: 'working' | 'broken' | 'warning';
    statusCode: number;
    error?: string;
  }[];
}

type FilterType = 'all' | 'broken' | 'warning' | 'working';

export default function VideoExtractScanPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState(getPolicy('free'));
  const [planId, setPlanId] = useState<string>('free');
  const [planName, setPlanName] = useState('Free Trial');
  const [planStatus, setPlanStatus] = useState('Active');
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const isTrial = planStatus === 'Trial';
  const [usage, setUsage] = useState<{ channelExtractsUsed: number; videosPerScanUsed: number; bulkScanUsed: number }>({ channelExtractsUsed: 0, videosPerScanUsed: 0, bulkScanUsed: 0 });
  
  // Extract section
  const [channelUrl, setChannelUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedVideos, setExtractedVideos] = useState<VideoData[]>([]);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractMode, setExtractMode] = useState<'count' | 'dateRange'>('count');
  const [videoCount, setVideoCount] = useState('50');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [channelData, setChannelData] = useState<YouTubeChannel | null>(null);
  const [fetchingChannel, setFetchingChannel] = useState(false);
  
  // CSV upload section
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  
  // Results
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<ScanResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalLinks: 0,
    brokenLinks: 0,
    warningLinks: 0,
    workingLinks: 0
  });

  const planChannels = policy.maxChannels === 'unlimited' ? 'Unlimited' : String(policy.maxChannels);
  const planVideosPerScan = policy.maxVideosPerScan === 'unlimited'
    ? 'Unlimited'
    : String(Math.max(0, (policy.maxVideosPerScan as number) - (usage.videosPerScanUsed || 0)));
  const planBulkPerRun = policy.maxBulkVideosPerRun === 'unlimited'
    ? 'Unlimited'
    : String(Math.max(0, (policy.maxBulkVideosPerRun as number) - (usage.bulkScanUsed || 0)));
  const planTotalScans = policy.maxScans === 'unlimited' ? 'Unlimited' : String(policy.maxScans);
  const planExtracts = policy.maxChannelExtracts === 'unlimited'
    ? 'Unlimited'
    : String(Math.max(0, (policy.maxChannelExtracts ?? 0) - (usage.channelExtractsUsed || 0)) || '0');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userSnap.exists() ? (userSnap.data() as any) : {};
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
          channelExtractsUsed: Number(u?.channelExtractsUsed || 0),
          videosPerScanUsed: Number(u?.videosPerScanUsed || 0),
          bulkScanUsed: Number(u?.bulkScanUsed || 0),
        });
        if (inTrial) {
          const dr = Math.max(0, Math.ceil((trialEndMs - now) / (24 * 60 * 60 * 1000)));
          setDaysRemaining(dr);
        } else {
          setDaysRemaining(null);
        }
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await logOut();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleExtractClick = async () => {
    if (!channelUrl.trim()) {
      alert('Please enter a channel URL');
      return;
    }
    
    setFetchingChannel(true);
    try {
      const channel = await connectYouTubeChannel(channelUrl);
      if (!channel) {
        alert('Channel not found. Please check the URL and try again.');
        setFetchingChannel(false);
        return;
      }
      setChannelData(channel);
      setShowExtractModal(true);
    } catch (error: any) {
      alert(error.message || 'Failed to fetch channel information');
    } finally {
      setFetchingChannel(false);
    }
  };

  const handleExtractVideos = async () => {
    if (!channelData) return;
    
    setExtracting(true);
    try {
      if (policy.maxChannelExtracts !== 'unlimited') {
        const remainingExtracts = Math.max(0, (policy.maxChannelExtracts ?? 0) - (usage.channelExtractsUsed || 0));
        if (remainingExtracts < 1) {
          alert('No channel extracts remaining in your plan.');
          setExtracting(false);
          return;
        }
      }
      let videos;
      
      if (extractMode === 'count') {
        const count = parseInt(videoCount);
        if (isNaN(count) || count < 1) {
          alert('Please enter a valid number of videos (minimum 1)');
          setExtracting(false);
          return;
        }
        const remainingVideosLimit = policy.maxVideosPerScan === 'unlimited'
          ? count
          : Math.max(0, (policy.maxVideosPerScan as number) - (usage.videosPerScanUsed || 0));
        if (policy.maxVideosPerScan !== 'unlimited' && remainingVideosLimit < 1) {
          alert('No remaining Videos Per Scan available in your plan.');
          setExtracting(false);
          return;
        }
        const capped = Math.min(count, remainingVideosLimit);
        console.log(`Extracting ${capped} videos from channel ID: ${channelData.id}`);
        videos = await getChannelVideosByDateRange(channelData.id, capped);
        console.log(`Received ${videos.length} videos from API`);
      } else {
        // Date range mode
        if (isTrial) {
          alert('Date range extraction is available on paid plans.');
          setExtracting(false);
          return;
        }
        if (!startDate || !endDate) {
          alert('Please select both start and end dates');
          setExtracting(false);
          return;
        }
        if (new Date(startDate) > new Date(endDate)) {
          alert('Start date must be before end date');
          setExtracting(false);
          return;
        }
        const remainingVideosLimit = policy.maxVideosPerScan === 'unlimited'
          ? 999999
          : Math.max(0, (policy.maxVideosPerScan as number) - (usage.videosPerScanUsed || 0));
        if (policy.maxVideosPerScan !== 'unlimited' && remainingVideosLimit < 1) {
          alert('No remaining Videos Per Scan available in your plan.');
          setExtracting(false);
          return;
        }
        const max = remainingVideosLimit;
        videos = await getChannelVideosByDateRange(channelData.id, max, startDate, endDate);
      }
      
      if (videos.length === 0) {
        alert('No videos found for the selected criteria');
        setExtracting(false);
        return;
      }
      
      // Convert to VideoData format
      const extractedData: VideoData[] = videos.map(video => ({
        videoId: video.id,
        videoTitle: video.title,
        videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
        publishedAt: video.publishedAt
      }));
      
      setExtractedVideos(extractedData);
      setShowExtractModal(false);
      
      const requestedCount = extractMode === 'count' ? parseInt(videoCount) : 'all';
      const message = extractedData.length < (typeof requestedCount === 'number' ? requestedCount : Infinity)
        ? `✅ Successfully extracted ${extractedData.length} videos!\n\n⚠️ Note: You requested ${requestedCount} videos, but the channel only has ${extractedData.length} videos available.\n\nYou can now download the CSV file.`
        : `✅ Successfully extracted ${extractedData.length} videos!\n\nYou can now download the CSV file.`;
      
      alert(message);
      if (user) {
        try {
          await notifyExtractCompleted(user.uid, channelData.title, extractedData.length, channelData.id);
        } catch {}
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            'usage.channelExtractsUsed': increment(1),
            'usage.videosPerScanUsed': increment(extractedData.length),
          });
          setUsage(prev => ({
            ...prev,
            channelExtractsUsed: (prev.channelExtractsUsed || 0) + 1,
            videosPerScanUsed: (prev.videosPerScanUsed || 0) + extractedData.length,
          }));
        } catch {}
      }
    } catch (error: any) {
      console.error('Extraction error:', error);
      alert(`Extraction failed: ${error.message || 'Unknown error'}`);
    } finally {
      setExtracting(false);
    }
  };

  const handleDownloadCSV = () => {
    if (extractedVideos.length === 0) {
      alert('No videos to download. Extract videos first.');
      return;
    }
    
    try {
      // Create CSV content
      const headers = ['Video ID', 'Video Title', 'Video URL', 'Published At'];
      const csvRows = [headers.join(',')];
      
      extractedVideos.forEach(video => {
        const row = [
          video.videoId,
          `"${video.videoTitle.replace(/"/g, '""')}"`, // Escape quotes in title
          video.videoUrl,
          new Date(video.publishedAt).toLocaleString()
        ];
        csvRows.push(row.join(','));
      });
      
      const csvContent = csvRows.join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `youtube_videos_${new Date().getTime()}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert(`✅ CSV file downloaded successfully!\n\nTotal videos: ${extractedVideos.length}`);
    } catch (error: any) {
      console.error('CSV download error:', error);
      alert(`Failed to download CSV: ${error.message || 'Unknown error'}`);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
    }
  };


  const handleScanNow = async () => {
    if (!csvFile) {
      alert('Please upload a CSV file first');
      return;
    }
    
    setScanning(true);
    
    const scanSessionName = csvFile.name.replace('.csv', '') || `Scan ${new Date().toLocaleString()}`;
    
    try {
      // Parse CSV file
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        alert('CSV file is empty');
        setScanning(false);
        return;
      }
      
      // Extract YouTube video URLs from CSV
      const videoUrls: string[] = [];
      
      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes('video') || lines[0].toLowerCase().includes('url') ? 1 : 0;
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Extract YouTube URLs from the line
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
        let match;
        let foundMatch = false;
        
        while ((match = youtubeRegex.exec(line)) !== null) {
          const videoId = match[1];
          const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
          if (videoId && !videoUrls.includes(fullUrl)) {
            videoUrls.push(fullUrl);
            foundMatch = true;
          }
        }
        
        if (!foundMatch) {
          // Try to extract video ID from CSV columns
          const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
          for (const part of parts) {
            const match = part.match(/([a-zA-Z0-9_-]{11})/);
            if (match && match[1]) {
              videoUrls.push(`https://www.youtube.com/watch?v=${match[1]}`);
              break;
            }
          }
        }
      }
      
      if (videoUrls.length === 0) {
        alert('No valid YouTube video URLs found in CSV file.\n\nPlease ensure your CSV contains YouTube video URLs like:\nhttps://www.youtube.com/watch?v=VIDEO_ID');
        setScanning(false);
        return;
      }
      
      // Enforce bulk per-run size based on plan and remaining usage
      if (policy.maxBulkVideosPerRun !== 'unlimited') {
        const remainingBulk = Math.max(0, (policy.maxBulkVideosPerRun as number) - (usage.bulkScanUsed || 0));
        if (videoUrls.length > remainingBulk) {
          alert(`You have ${remainingBulk} bulk video slots remaining in your plan.`);
          setScanning(false);
          return;
        }
      }

      // Start synchronous scan (matching channel scan logic)
      console.log('Starting synchronous video scan...');
      const response = await fetch('/api/scan-videos-async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrls,
          sessionName: scanSessionName,
          userId: user?.uid
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to scan videos');
      }

      console.log('Scan response:', data);
      
      // Backend has already saved results to Firestore
      console.log('✅ Scan completed and results saved to database!');
      
      alert(
        `✅ Scan Complete & Saved!\n\n` +
        `Session: ${scanSessionName}\n` +
        `Videos Scanned: ${data.scannedVideos}\n` +
        `Videos with Links: ${data.videosWithLinks}\n\n` +
        `📊 Results:\n` +
        `Total Links: ${data.statistics.totalLinks}\n` +
        `✅ Working: ${data.statistics.workingLinks}\n` +
        `⚠️ Warning: ${data.statistics.warningLinks}\n` +
        `❌ Broken: ${data.statistics.brokenLinks}\n\n` +
        `💾 Results saved to database!\n` +
        `You can close the browser - results will remain available.\n\n` +
        `View detailed report in the Video Results page.`
      );

      if (user) {
        try {
          await notifyBulkScanCompleted(user.uid, data.statistics.totalVideos || data.scannedVideos || 0, data.statistics.brokenLinks || 0);
        } catch {}
        try {
          const usedVideos = (data?.statistics?.totalVideos || data?.scannedVideos || 0) as number;
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            'usage.bulkScanUsed': increment(usedVideos),
          });
          setUsage(prev => ({
            ...prev,
            bulkScanUsed: (prev.bulkScanUsed || 0) + usedVideos,
          }));
        } catch {}
      }
      
      // Navigate to results page
      if (confirm('Would you like to view the scan results now?')) {
        router.push(`/Video-Result/${data.sessionId}`);
      }
      
    } catch (error: any) {
      console.error('CSV scan error:', error);
      alert(`❌ Scan Failed\n\n${error.message || 'An error occurred while scanning. Please try again.'}`);
    } finally {
      setScanning(false);
    }
  };

  const applyFilter = (filter: FilterType) => {
    setActiveFilter(filter);
    if (filter === 'all') {
      setFilteredResults(scanResults);
    } else {
      const filtered = scanResults.filter(result => 
        result.links.some(link => link.status === filter)
      );
      setFilteredResults(filtered);
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
      {/* Navigation */}
      <Header user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Extract & Scan</h1>
          <p className="text-gray-600">Extract videos from channels and scan for broken links</p>
        </div>

        {/* Your Plan (consistent style with Channels) */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Plan</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Channel Extracts</p>
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900">{planExtracts}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Videos Per Scan</p>
                <VideoIcon className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900">{planVideosPerScan}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Bulk Scan Size</p>
                <BarChart3 className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900">{planBulkPerRun}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Status</p>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900">{planStatus}</p>
            </div>
          </div>
        </div>

        {/* Section 1: Extract Videos */}
        <div className="card mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <VideoIcon className="w-6 h-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Extract Videos</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Channel URL
              </label>
              <input
                type="text"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                placeholder="https://www.youtube.com/@channelname or Channel ID"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleExtractClick}
                disabled={!channelUrl.trim() || fetchingChannel}
                className="btn-primary flex items-center space-x-2"
              >
                {fetchingChannel ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading Channel...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Extract</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleDownloadCSV}
                disabled={extractedVideos.length === 0}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="w-5 h-5" />
                <span>Download CSV</span>
              </button>
            </div>

            {/* Extracted Videos Count */}
            {extractedVideos.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-sm font-medium text-green-800">
                    ✅ {extractedVideos.length} videos extracted successfully! Click "Download CSV" to save the list.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Upload CSV */}
        <div className="card mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Upload className="w-6 h-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Scan Links from YouTube Video Descriptions</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CSV File (YouTube Video URLs)
              </label>
              <p className="text-xs text-gray-600 mb-2">
                Upload a CSV containing YouTube video URLs. The tool will extract and scan all links found in the video descriptions.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              {csvFile && (
                <p className="mt-2 text-sm text-green-600">
                  ✓ {csvFile.name} selected
                </p>
              )}
            </div>

            <button
              onClick={handleScanNow}
              disabled={!csvFile || scanning}
              className="btn-primary flex items-center space-x-2"
            >
              {scanning ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Scanning Links...</span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  <span>Scan Now</span>
                </>
              )}
            </button>

            {/* Scanning Progress */}
            {scanning && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">
                      Scanning videos and checking link availability...
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Each link is being validated for accessibility. This may take a few moments.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            {!scanning && !csvFile && (
              <div className="space-y-3 mt-4">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700 mb-2">CSV Format Examples:</p>
                  <div className="space-y-1 text-xs text-gray-600 font-mono bg-white p-3 rounded">
                    <p>https://www.youtube.com/watch?v=VIDEO_ID_1</p>
                    <p>https://www.youtube.com/watch?v=VIDEO_ID_2</p>
                    <p>https://youtu.be/VIDEO_ID_3</p>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Or use the CSV downloaded from "Extract Videos" section above.
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-800 mb-1">ℹ️ About Link Checking</p>
                  <p className="text-xs text-blue-700 mb-2">
                    Links are checked with the same logic as the channels page:
                  </p>
                  <ul className="text-xs text-blue-700 ml-4 space-y-1.5">
                    <li>• <span className="font-semibold text-green-700">Working</span> - Link is accessible (2xx status)</li>
                    <li>• <span className="font-semibold text-orange-700">Warning</span> - Temporary issues:
                      <ul className="ml-4 mt-0.5 text-[11px]">
                        <li>- Redirects (3xx)</li>
                        <li>- Access restrictions for social media (403, 429)</li>
                        <li>- Server errors (5xx) or timeouts</li>
                      </ul>
                    </li>
                    <li>• <span className="font-semibold text-red-700">Broken</span> - Confirmed failures:
                      <ul className="ml-4 mt-0.5 text-[11px]">
                        <li>- Not found (404, 410)</li>
                        <li>- Other permanent errors (non-social media)</li>
                      </ul>
                    </li>
                  </ul>
                  <p className="text-[11px] text-blue-600 mt-2 italic">
                    Note: Social media links get special handling with retry logic. Warning links may work when clicked.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scan Results */}
        {scanResults.length > 0 && (
          <div data-results-section>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700 mb-1">Total Videos</p>
                    <p className="text-3xl font-bold text-purple-900">{stats.totalVideos}</p>
                  </div>
                  <VideoIcon className="w-10 h-10 text-purple-600 opacity-50" />
                </div>
              </div>

              <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700 mb-1">Total Links</p>
                    <p className="text-3xl font-bold text-blue-900">{stats.totalLinks}</p>
                  </div>
                  <LinkIcon className="w-10 h-10 text-blue-600 opacity-50" />
                </div>
              </div>

              <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-700 mb-1">Broken Links</p>
                    <p className="text-3xl font-bold text-red-900">{stats.brokenLinks}</p>
                  </div>
                  <XCircle className="w-10 h-10 text-red-600 opacity-50" />
                </div>
              </div>

              <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-700 mb-1">Warning Links</p>
                    <p className="text-3xl font-bold text-orange-900">{stats.warningLinks}</p>
                  </div>
                  <AlertTriangle className="w-10 h-10 text-orange-600 opacity-50" />
                </div>
              </div>

              <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700 mb-1">Working Links</p>
                    <p className="text-3xl font-bold text-green-900">{stats.workingLinks}</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
                </div>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="card mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <Filter className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Filter Links</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeFilter === 'all'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Links
                </button>
                <button
                  onClick={() => applyFilter('broken')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeFilter === 'broken'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Broken
                </button>
                <button
                  onClick={() => applyFilter('warning')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeFilter === 'warning'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Warning
                </button>
                <button
                  onClick={() => applyFilter('working')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeFilter === 'working'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Working
                </button>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Scan Results</h3>
              {filteredResults.map((result, index) => (
                <div key={index} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{result.videoTitle}</h4>
                      {result.videoUrl && (
                        <a 
                          href={result.videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:underline"
                        >
                          {result.videoUrl}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                        {result.links.length} {result.links.length === 1 ? 'link' : 'links'}
                      </span>
                    </div>
                  </div>

                  {/* Links List */}
                  <div className="space-y-2">
                    {result.links.length === 0 ? (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                        <p className="text-sm text-gray-600">No links found in video description</p>
                      </div>
                    ) : (
                      result.links.map((link, linkIndex) => (
                      <div 
                        key={linkIndex}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          link.status === 'working' 
                            ? 'bg-green-50 border-green-200' 
                            : link.status === 'warning'
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            {link.status === 'working' ? (
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                            ) : link.status === 'warning' ? (
                              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            )}
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-gray-700 hover:underline truncate"
                            >
                              {link.url}
                            </a>
                          </div>
                          {link.error && (
                            <p className="text-xs text-gray-500 mt-1 ml-8">
                              {link.error}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            link.status === 'working'
                              ? 'bg-green-600 text-white'
                              : link.status === 'warning'
                              ? 'bg-orange-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}>
                            {link.status.toUpperCase()}
                          </span>
                          {link.statusCode > 0 && (
                            <span className="text-xs text-gray-500">
                              {link.statusCode}
                            </span>
                          )}
                        </div>
                      </div>
                    )))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Extract Modal */}
      {showExtractModal && channelData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header with Channel Info */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 rounded-t-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Configure Extraction</h2>
                <button
                  onClick={() => {
                    setShowExtractModal(false);
                    setChannelData(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                  disabled={extracting}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Channel Display */}
              <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                {channelData.thumbnail ? (
                  <img 
                    src={channelData.thumbnail} 
                    alt={channelData.title}
                    className="w-16 h-16 rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <Youtube className="w-8 h-8 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">
                    {channelData.title}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-white/90">
                    <span>{channelData.subscriberCount} subscribers</span>
                    <span>•</span>
                    <span>{channelData.videoCount} videos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Extraction Mode Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select Extraction Method
                </label>
                <div className="space-y-3">
                  {/* Option 1: Video Count */}
                  <div 
                    onClick={() => !extracting && setExtractMode('count')}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      extractMode === 'count' 
                        ? 'border-primary-600 bg-primary-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    } ${extracting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex items-center h-5">
                        <input
                          type="radio"
                          name="extractMode"
                          checked={extractMode === 'count'}
                          onChange={() => setExtractMode('count')}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                          disabled={extracting}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900 mb-1 cursor-pointer">
                          Extract by Video Count
                        </label>
                        <p className="text-xs text-gray-600 mb-3">
                          Specify the number of recent videos to extract
                        </p>
                        {extractMode === 'count' && (
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              value={videoCount}
                              onChange={(e) => setVideoCount(e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 pr-20"
                              placeholder="Enter number of videos"
                              disabled={extracting}
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
                      if (extracting) return;
                      if (isTrial) { alert('Date range extraction is available on paid plans.'); return; }
                      setExtractMode('dateRange');
                    }}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      extractMode === 'dateRange' 
                        ? 'border-primary-600 bg-primary-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    } ${(extracting || isTrial) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex items-center h-5">
                        <input
                          type="radio"
                          name="extractMode"
                          checked={extractMode === 'dateRange'}
                          onChange={() => { if (isTrial) { alert('Date range extraction is available on paid plans.'); return; } setExtractMode('dateRange'); }}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                          disabled={extracting || isTrial}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900 mb-1 cursor-pointer">
                          Extract by Date Range
                        </label>
                        <p className="text-xs text-gray-600 mb-3">
                          Select a specific date range for videos
                        </p>
                        {isTrial && (
                          <p className="text-xs text-red-600">Locked on Free Trial</p>
                        )}
                        {extractMode === 'dateRange' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" onClick={(e) => e.stopPropagation()}>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-2">
                                Start Date
                              </label>
                              <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                disabled={extracting}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-2">
                                End Date
                              </label>
                              <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                disabled={extracting}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">ℹ️ Note:</span> You can extract any number of videos. 
                  However, YouTube API has daily quota limits. For very large extractions (1000+ videos), 
                  the process may take several minutes.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowExtractModal(false);
                  setChannelData(null);
                }}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={extracting}
              >
                Cancel
              </button>
              <button
                onClick={handleExtractVideos}
                disabled={
                  extracting || 
                  (extractMode === 'count' && (!videoCount || parseInt(videoCount) < 1)) ||
                  (extractMode === 'dateRange' && (!startDate || !endDate))
                }
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {extracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Start Extract</span>
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
