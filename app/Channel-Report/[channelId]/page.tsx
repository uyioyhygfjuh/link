'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getChannelVideos, getVideoDetails, extractLinksFromDescription } from '@/lib/youtube';
import Link from 'next/link';
import Header from '@/components/Header';
import { 
  Shield, 
  Youtube, 
  Link as LinkIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ExternalLink,
  Filter,
  ArrowLeft,
  BarChart3,
  Video,
  Download,
  FileText,
  FileSpreadsheet,
  FileDown
} from 'lucide-react';

interface VideoLink {
  url: string;
  status: 'working' | 'broken' | 'warning';
  statusCode: number;
}

interface VideoReport {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  links: VideoLink[];
}

interface Channel {
  firestoreId: string;
  channelId: string;
  channelName: string;
  channelImage?: string;
  subscribers: string;
  videoCount?: number;
  lastScanResults?: {
    totalLinks: number;
    brokenLinks: number;
    warningLinks: number;
    workingLinks: number;
  };
  scanResults?: VideoReport[];
}

type FilterType = 'all' | 'broken' | 'warning' | 'working';

export default function ChannelReportPage() {
  const router = useRouter();
  const params = useParams();
  const channelId = params.channelId as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connectedChannels, setConnectedChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [videoReports, setVideoReports] = useState<VideoReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<VideoReport[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Statistics from last scan
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalLinks: 0,
    brokenLinks: 0,
    warningLinks: 0,
    workingLinks: 0
  });

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

  useEffect(() => {
    if (selectedChannel && selectedChannel.lastScanResults) {
      // Load statistics from last scan
      const results = selectedChannel.lastScanResults;
      const scannedVideos = selectedChannel.scanResults?.length || 0;
      setStats({
        totalVideos: scannedVideos,
        totalLinks: results.totalLinks || 0,
        brokenLinks: results.brokenLinks || 0,
        warningLinks: results.warningLinks || 0,
        workingLinks: results.workingLinks || 0
      });
      
      // Load video reports if available
      if (selectedChannel.scanResults && Array.isArray(selectedChannel.scanResults)) {
        setVideoReports(selectedChannel.scanResults);
      } else {
        setVideoReports([]);
      }
    } else {
      setVideoReports([]);
      setStats({
        totalVideos: 0,
        totalLinks: 0,
        brokenLinks: 0,
        warningLinks: 0,
        workingLinks: 0
      });
    }
  }, [selectedChannel]);

  useEffect(() => {
    applyFilter(activeFilter);
  }, [videoReports, activeFilter]);

  const applyFilter = (filter: FilterType) => {
    setActiveFilter(filter);
    
    if (filter === 'all') {
      setFilteredReports(videoReports);
      return;
    }
    
    const filtered = videoReports
      .map(report => ({
        ...report,
        links: report.links.filter(link => link.status === filter)
      }))
      .filter(report => report.links.length > 0);
    
    setFilteredReports(filtered);
  };

  const loadConnectedChannels = async (userId: string) => {
    try {
      const channelsRef = collection(db, 'channels');
      const q = query(channelsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const channels: Channel[] = querySnapshot.docs.map(doc => ({
        firestoreId: doc.id,
        ...doc.data()
      } as Channel));
      
      setConnectedChannels(channels);
      
      // Find and set the selected channel
      const channel = channels.find(ch => ch.channelId === channelId);
      if (channel) {
        setSelectedChannel(channel);
      } else if (channels.length > 0) {
        setSelectedChannel(channels[0]);
        router.push(`/Channel-Report/${channels[0].channelId}`);
      }
      
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

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    router.push(`/Channel-Report/${channel.channelId}`);
  };

  // Download as CSV
  const downloadCSV = () => {
    if (!selectedChannel) return;

    const csvRows = [];
    
    // Header
    csvRows.push(['Channel Report - ' + selectedChannel.channelName]);
    csvRows.push(['Generated on: ' + new Date().toLocaleString()]);
    csvRows.push([]);
    csvRows.push(['Summary Statistics']);
    csvRows.push(['Total Videos', stats.totalVideos]);
    csvRows.push(['Total Links', stats.totalLinks]);
    csvRows.push(['Working Links', stats.workingLinks]);
    csvRows.push(['Warning Links', stats.warningLinks]);
    csvRows.push(['Broken Links', stats.brokenLinks]);
    csvRows.push([]);
    
    // Video details header
    csvRows.push(['Video Title', 'Video URL', 'Link URL', 'Link Status', 'Status Code']);
    
    // Video data
    filteredReports.forEach(video => {
      if (video.links.length === 0) {
        csvRows.push([video.videoTitle, video.videoUrl, 'No links found', '', '']);
      } else {
        video.links.forEach((link, index) => {
          csvRows.push([
            index === 0 ? video.videoTitle : '',
            index === 0 ? video.videoUrl : '',
            link.url,
            link.status,
            link.statusCode
          ]);
        });
      }
    });

    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Sanitize filename to remove invalid characters
    const sanitizedChannelName = selectedChannel.channelName.replace(/[/\\?%*:|"<>]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `${sanitizedChannelName}_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('✅ CSV file generated successfully');
  };

  // Download as Excel
  const downloadExcel = async () => {
    if (!selectedChannel) {
      alert('No channel selected');
      return;
    }

    // Check if there's data to export
    if (!videoReports || videoReports.length === 0) {
      alert('No scan data available to export. Please scan the channel first.');
      return;
    }

    console.log('📊 Starting Excel export...');
    console.log('Channel:', selectedChannel.channelName);
    console.log('Video Reports:', videoReports.length);
    console.log('Filtered Reports:', filteredReports.length);
    console.log('Stats:', stats);

    try {
      // Import xlsx library - it's a named export, not default
      const XLSX = await import('xlsx');
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Main Report Sheet with structured layout
      const reportData: any[][] = [];
      
      // ===== HEADING SECTION =====
      reportData.push(['CHANNEL REPORT']);
      reportData.push(['']); // Empty row
      
      // Channel Information
      reportData.push(['Channel Name:', selectedChannel.channelName]);
      reportData.push(['Channel ID:', selectedChannel.channelId]);
      reportData.push(['Subscribers:', selectedChannel.subscribers]);
      reportData.push(['Total Videos on Channel:', selectedChannel.videoCount || 'N/A']);
      reportData.push(['']); // Empty row
      
      // Report Details
      reportData.push(['Report Generated:', new Date().toLocaleString()]);
      reportData.push(['Filter Applied:', activeFilter === 'all' ? 'All Links' : activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)]);
      reportData.push(['']); // Empty row
      
      // Overall Statistics
      reportData.push(['OVERALL STATISTICS']);
      reportData.push(['Total Videos Scanned:', stats.totalVideos]);
      reportData.push(['Total Links Found:', stats.totalLinks]);
      reportData.push(['Working Links:', stats.workingLinks, '(' + (stats.totalLinks > 0 ? ((stats.workingLinks / stats.totalLinks) * 100).toFixed(1) : '0') + '%)']);
      reportData.push(['Warning Links:', stats.warningLinks, '(' + (stats.totalLinks > 0 ? ((stats.warningLinks / stats.totalLinks) * 100).toFixed(1) : '0') + '%)']);
      reportData.push(['Broken Links:', stats.brokenLinks, '(' + (stats.totalLinks > 0 ? ((stats.brokenLinks / stats.totalLinks) * 100).toFixed(1) : '0') + '%)']);
      reportData.push(['']); // Empty row
      reportData.push(['']); // Empty row
      
      // ===== VIDEO DATA SECTION =====
      reportData.push(['VIDEO DETAILS']);
      reportData.push(['']); // Empty row
      
      // Column Headers
      reportData.push([
        'Video Title',
        'Video URL',
        'All Links',
        'Broken Links',
        'Warning Links',
        'Working Links'
      ]);
      
      // Video Data Rows
      console.log('Processing', videoReports.length, 'videos for main report...');
      
      videoReports.forEach(video => {
        const allLinks = video.links.map(l => l.url).join('\n');
        const brokenLinks = video.links.filter(l => l.status === 'broken').map(l => l.url).join('\n');
        const warningLinks = video.links.filter(l => l.status === 'warning').map(l => l.url).join('\n');
        const workingLinks = video.links.filter(l => l.status === 'working').map(l => l.url).join('\n');
        
        reportData.push([
          video.videoTitle,
          video.videoUrl,
          allLinks || 'No links found',
          brokenLinks || '-',
          warningLinks || '-',
          workingLinks || '-'
        ]);
      });
      
      const reportSheet = XLSX.utils.aoa_to_sheet(reportData);
      
      // Set column widths
      reportSheet['!cols'] = [
        { wch: 40 },  // Video Title
        { wch: 50 },  // Video URL
        { wch: 60 },  // All Links
        { wch: 60 },  // Broken Links
        { wch: 60 },  // Warning Links
        { wch: 60 }   // Working Links
      ];
      
      // Set row heights for better readability (optional)
      const headerRowIndex = reportData.findIndex(row => row[0] === 'Video Title');
      if (headerRowIndex >= 0) {
        reportSheet['!rows'] = reportSheet['!rows'] || [];
        reportSheet['!rows'][headerRowIndex] = { hpt: 25 }; // Header row height
      }
      
      XLSX.utils.book_append_sheet(wb, reportSheet, 'Channel Report');
      
      // Detailed data sheet with all information (use videoReports for complete data)
      const detailedData = [['Video ID', 'Video Title', 'Video URL', 'Total Links', 'Link URL', 'Link Status', 'Status Code', 'Link Type']];
      
      console.log('Processing', videoReports.length, 'videos for detailed report...');
      
      videoReports.forEach(video => {
        const linkCount = video.links.length;
        
        if (linkCount === 0) {
          // Include videos with no links
          detailedData.push([
            video.videoId,
            video.videoTitle,
            video.videoUrl,
            '0',
            'No links found',
            'N/A',
            '',
            'N/A'
          ]);
        } else {
          video.links.forEach((link, index) => {
            // Determine link type based on domain
            let linkType = 'Other';
            try {
              const urlObj = new URL(link.url);
              const domain = urlObj.hostname.toLowerCase();
              if (domain.includes('facebook') || domain.includes('fb.com')) linkType = 'Facebook';
              else if (domain.includes('twitter') || domain.includes('x.com')) linkType = 'Twitter/X';
              else if (domain.includes('instagram')) linkType = 'Instagram';
              else if (domain.includes('linkedin')) linkType = 'LinkedIn';
              else if (domain.includes('youtube') || domain.includes('youtu.be')) linkType = 'YouTube';
              else if (domain.includes('tiktok')) linkType = 'TikTok';
              else if (domain.includes('amazon') || domain.includes('amzn')) linkType = 'Amazon';
              else if (domain.includes('bit.ly') || domain.includes('tinyurl') || domain.includes('goo.gl')) linkType = 'URL Shortener';
            } catch (e) {
              linkType = 'Invalid URL';
            }
            
            detailedData.push([
              index === 0 ? video.videoId : '',
              index === 0 ? video.videoTitle : '',
              index === 0 ? video.videoUrl : '',
              index === 0 ? linkCount.toString() : '',
              link.url,
              link.status,
              link.statusCode.toString(),
              linkType
            ]);
          });
        }
      });
      
      const detailedSheet = XLSX.utils.aoa_to_sheet(detailedData);
      
      // Set column widths for detailed sheet
      detailedSheet['!cols'] = [
        { wch: 15 },  // Video ID
        { wch: 40 },  // Video Title
        { wch: 50 },  // Video URL
        { wch: 12 },  // Total Links
        { wch: 60 },  // Link URL
        { wch: 12 },  // Link Status
        { wch: 12 },  // Status Code
        { wch: 15 }   // Link Type
      ];
      
      XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Report');
      
      // Add a third sheet with videos summary (use videoReports for complete data)
      const videoSummaryData = [['Video ID', 'Video Title', 'Video URL', 'Total Links', 'Working', 'Warning', 'Broken']];
      
      console.log('Processing', videoReports.length, 'videos for summary sheet...');
      
      videoReports.forEach(video => {
        const workingCount = video.links.filter(l => l.status === 'working').length;
        const warningCount = video.links.filter(l => l.status === 'warning').length;
        const brokenCount = video.links.filter(l => l.status === 'broken').length;
        
        videoSummaryData.push([
          video.videoId,
          video.videoTitle,
          video.videoUrl,
          video.links.length.toString(),
          workingCount.toString(),
          warningCount.toString(),
          brokenCount.toString()
        ]);
      });
      
      const videoSummarySheet = XLSX.utils.aoa_to_sheet(videoSummaryData);
      
      // Set column widths for video summary sheet
      videoSummarySheet['!cols'] = [
        { wch: 15 },  // Video ID
        { wch: 40 },  // Video Title
        { wch: 50 },  // Video URL
        { wch: 12 },  // Total Links
        { wch: 10 },  // Working
        { wch: 10 },  // Warning
        { wch: 10 }   // Broken
      ];
      
      XLSX.utils.book_append_sheet(wb, videoSummarySheet, 'Videos Summary');
      
      // Download - sanitize filename to remove invalid characters
      const sanitizedChannelName = selectedChannel.channelName.replace(/[/\\?%*:|"<>]/g, '-');
      const filename = `${sanitizedChannelName}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      console.log('📥 Downloading Excel file:', filename);
      console.log('📊 Export Summary:');
      console.log('  - Channel Report (Main): ' + videoReports.length + ' videos with structured layout');
      console.log('  - Detailed Report: ' + (detailedData.length - 1) + ' rows (link-by-link)');
      console.log('  - Videos Summary: ' + (videoSummaryData.length - 1) + ' videos');
      console.log('');
      console.log('📋 Main Sheet Structure:');
      console.log('  ✓ Heading section with channel info');
      console.log('  ✓ Overall statistics with percentages');
      console.log('  ✓ Video data table with columns:');
      console.log('    - Video Title');
      console.log('    - Video URL');
      console.log('    - All Links');
      console.log('    - Broken Links');
      console.log('    - Warning Links');
      console.log('    - Working Links');
      
      XLSX.writeFile(wb, filename);
      
      console.log('✅ Excel file generated successfully with structured layout!');
    } catch (error: any) {
      console.error('❌ Error generating Excel:', error);
      console.error('Error details:', error.message, error.stack);
      alert(`Failed to generate Excel file. Please try again.\n\nError: ${error.message || 'Unknown error'}`);
    }
  };

  // Download as PDF
  const downloadPDF = async () => {
    if (!selectedChannel) return;

    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text('Channel Report', 14, 20);
      
      // Channel info
      doc.setFontSize(12);
      doc.text(`Channel: ${selectedChannel.channelName}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 37);
      
      // Summary statistics
      doc.setFontSize(14);
      doc.text('Summary Statistics', 14, 50);
      
      const summaryData = [
        ['Total Videos', stats.totalVideos.toString()],
        ['Total Links', stats.totalLinks.toString()],
        ['Working Links', stats.workingLinks.toString()],
        ['Warning Links', stats.warningLinks.toString()],
        ['Broken Links', stats.brokenLinks.toString()]
      ];
      
      autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Count']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });
      
      // Detailed report
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Detailed Link Report', 14, 20);
      
      const detailedData: any[] = [];
      filteredReports.forEach(video => {
        if (video.links.length === 0) {
          detailedData.push([
            video.videoTitle.substring(0, 40) + (video.videoTitle.length > 40 ? '...' : ''),
            'No links found',
            '',
            ''
          ]);
        } else {
          video.links.forEach((link, index) => {
            detailedData.push([
              index === 0 ? video.videoTitle.substring(0, 40) + (video.videoTitle.length > 40 ? '...' : '') : '',
              link.url.substring(0, 50) + (link.url.length > 50 ? '...' : ''),
              link.status,
              link.statusCode.toString()
            ]);
          });
        }
      });
      
      autoTable(doc, {
        startY: 25,
        head: [['Video Title', 'Link URL', 'Status', 'Code']],
        body: detailedData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 70 },
          2: { cellWidth: 25 },
          3: { cellWidth: 15 }
        }
      });
      
      // Save - sanitize filename to remove invalid characters
      const sanitizedChannelName = selectedChannel.channelName.replace(/[/\\?%*:|"<>]/g, '-');
      doc.save(`${sanitizedChannelName}_report_${new Date().toISOString().split('T')[0]}.pdf`);
      
      console.log('✅ PDF file generated successfully');
    } catch (error: any) {
      console.error('❌ Error generating PDF:', error);
      console.error('Error details:', error.message, error.stack);
      alert(`Failed to generate PDF file. Please try again.\n\nError: ${error.message || 'Unknown error'}`);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'broken': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'working': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'broken': return <XCircle className="w-4 h-4" />;
      default: return <LinkIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Unified Header */}
      <Header user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link 
          href="/channels"
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Channels</span>
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Channel Report</h1>
          <p className="text-gray-600">View scan results and link analysis</p>
        </div>

        {/* Channel Bar - Horizontal Scroll */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Connected Channels</h2>
          <div className="flex space-x-3 overflow-x-auto pb-3">
            {connectedChannels.map((channel) => (
              <button
                key={channel.channelId}
                onClick={() => handleChannelSelect(channel)}
                className={`flex-shrink-0 flex items-center space-x-3 px-4 py-3 rounded-lg border-2 transition-all ${
                  selectedChannel?.channelId === channel.channelId
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {channel.channelImage ? (
                  <img 
                    src={channel.channelImage} 
                    alt={channel.channelName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Youtube className="w-5 h-5 text-red-600" />
                  </div>
                )}
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">{channel.channelName}</p>
                  <p className="text-xs text-gray-600">{channel.subscribers} subscribers</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Summary Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 mb-1">Total Scan Videos</p>
                <p className="text-3xl font-bold text-purple-900">{stats.totalVideos}</p>
              </div>
              <Video className="w-10 h-10 text-purple-600 opacity-50" />
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

        {/* Download and Filter Section */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Filter Links</h3>
            </div>
            
            {/* Download Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadCSV}
                disabled={!selectedChannel || filteredReports.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Download as CSV"
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">CSV</span>
              </button>
              
              <button
                onClick={downloadExcel}
                disabled={!selectedChannel || filteredReports.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Download as Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm font-medium">Excel</span>
              </button>
              
              <button
                onClick={downloadPDF}
                disabled={!selectedChannel || filteredReports.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Download as PDF"
              >
                <FileDown className="w-4 h-4" />
                <span className="text-sm font-medium">PDF</span>
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => applyFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeFilter === 'all'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({stats.totalLinks})
            </button>
            <button
              onClick={() => applyFilter('broken')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeFilter === 'broken'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              Broken ({stats.brokenLinks})
            </button>
            <button
              onClick={() => applyFilter('warning')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeFilter === 'warning'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}
            >
              Warning ({stats.warningLinks})
            </button>
            <button
              onClick={() => applyFilter('working')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeFilter === 'working'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              Working ({stats.workingLinks})
            </button>
          </div>
        </div>

        {/* Video Reports */}
        {filteredReports.length === 0 ? (
          <div className="card text-center py-12">
            <Youtube className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Results</h3>
            <p className="text-gray-600 mb-6">
              {videoReports.length === 0
                ? 'No scan data available. Go to Channels page to scan this channel.'
                : `No videos with ${activeFilter} links found`}
            </p>
            {videoReports.length === 0 && (
              <Link href="/channels" className="btn-primary inline-block">
                Go to Channels
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div key={report.videoId} className="card hover:shadow-lg transition-shadow">
                {/* Video Header */}
                <div className="flex items-start space-x-4 mb-4 pb-4 border-b border-gray-200">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Youtube className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {report.videoTitle}
                    </h3>
                    <a
                      href={report.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Watch on YouTube</span>
                    </a>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                      {report.links.length} {report.links.length === 1 ? 'link' : 'links'}
                    </span>
                  </div>
                </div>

                {/* Links List */}
                <div className="space-y-2">
                  {report.links.map((link, index) => (
                    <div
                      key={index}
                      className={`flex items-start space-x-3 p-3 rounded-lg border ${getStatusColor(link.status)}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getStatusIcon(link.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono break-all hover:underline"
                        >
                          {link.url}
                        </a>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="px-2 py-1 text-xs font-semibold rounded">
                          {link.statusCode}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
