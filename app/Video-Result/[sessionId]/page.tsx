'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import { doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import Header from '@/components/Header';
import { 
  Shield, 
  ArrowLeft,
  Youtube,
  Link as LinkIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Video,
  FileText,
  ExternalLink,
  Trash2,
  X,
  Download,
  FileSpreadsheet,
  FileDown
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

interface VideoScanData {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  scannedAt: string;
  statistics: {
    totalLinks: number;
    workingLinks: number;
    warningLinks: number;
    brokenLinks: number;
  };
  links: {
    url: string;
    status: 'working' | 'broken' | 'warning';
    statusCode: number;
  }[];
}

type FilterType = 'all' | 'working' | 'warning' | 'broken';

export default function SessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.sessionId as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<ScanSession | null>(null);
  const [videos, setVideos] = useState<VideoScanData[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [filteredVideos, setFilteredVideos] = useState<VideoScanData[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<VideoScanData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadSessionData(sessionId);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router, sessionId]);

  useEffect(() => {
    applyFilter();
  }, [videos, activeFilter]);

  const loadSessionData = async (sessionId: string) => {
    try {
      setLoading(true);
      console.log('Loading session data for:', sessionId);
      
      // Load session metadata
      const sessionDoc = await getDoc(doc(db, 'scanSessions', sessionId));
      
      if (!sessionDoc.exists()) {
        console.error('Session not found');
        setLoading(false);
        return;
      }
      
      const session = sessionDoc.data() as ScanSession;
      setSessionData(session);
      
      // Load all videos in the session
      const videoData: VideoScanData[] = [];
      for (const videoId of session.videoIds) {
        const videoDoc = await getDoc(doc(db, 'videoScans', videoId));
        if (videoDoc.exists()) {
          videoData.push(videoDoc.data() as VideoScanData);
        }
      }
      
      // If no videos found but session exists, it might be empty
      if (videoData.length === 0 && session.videoIds.length > 0) {
        console.warn('Session has video IDs but no video documents found');
      }
      
      setVideos(videoData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading session data:', error);
      setLoading(false);
    }
  };

  const applyFilter = () => {
    if (activeFilter === 'all') {
      setFilteredVideos(videos);
    } else {
      // Filter videos that have links with the selected status
      const filtered = videos
        .map(video => {
          // Filter links within each video to only show links matching the selected status
          const filteredLinks = video.links.filter(link => link.status === activeFilter);
          
          // Only include videos that have at least one link with the selected status
          if (filteredLinks.length > 0) {
            return {
              ...video,
              links: filteredLinks,
              statistics: {
                totalLinks: filteredLinks.length,
                workingLinks: filteredLinks.filter(l => l.status === 'working').length,
                warningLinks: filteredLinks.filter(l => l.status === 'warning').length,
                brokenLinks: filteredLinks.filter(l => l.status === 'broken').length
              }
            };
          }
          return null;
        })
        .filter((video): video is VideoScanData => video !== null);
      
      setFilteredVideos(filtered);
    }
  };

  const getVideosWithStatus = (status: 'working' | 'warning' | 'broken') => {
    return videos.filter(video => video.links.some(link => link.status === status)).length;
  };

  const handleLogout = async () => {
    try {
      await logOut();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return 'text-green-600';
      case 'warning': return 'text-orange-600';
      case 'broken': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'working': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-orange-50 border-orange-200';
      case 'broken': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'working': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'broken': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const handleDeleteVideoClick = (e: React.MouseEvent, video: VideoScanData) => {
    e.preventDefault();
    e.stopPropagation();
    setVideoToDelete(video);
    setDeleteModalOpen(true);
  };

  const handleDeleteVideoConfirm = async () => {
    if (!videoToDelete || !sessionData) return;
    
    try {
      setDeleting(true);
      console.log('Deleting video scan:', videoToDelete.videoId);
      
      // Delete the video scan document
      await deleteDoc(doc(db, 'videoScans', videoToDelete.videoId));
      console.log(`Deleted video scan: ${videoToDelete.videoId}`);
      
      // Update the session document to remove this video ID
      const updatedVideoIds = sessionData.videoIds.filter(id => id !== videoToDelete.videoId);
      
      // Recalculate statistics
      const remainingVideos = videos.filter(v => v.videoId !== videoToDelete.videoId);
      const newStats = {
        totalVideos: remainingVideos.length,
        totalLinks: remainingVideos.reduce((sum, v) => sum + v.statistics.totalLinks, 0),
        workingLinks: remainingVideos.reduce((sum, v) => sum + v.statistics.workingLinks, 0),
        warningLinks: remainingVideos.reduce((sum, v) => sum + v.statistics.warningLinks, 0),
        brokenLinks: remainingVideos.reduce((sum, v) => sum + v.statistics.brokenLinks, 0)
      };
      
      // Update session document
      await updateDoc(doc(db, 'scanSessions', sessionId), {
        videoIds: updatedVideoIds,
        videoCount: updatedVideoIds.length,
        statistics: newStats
      });
      console.log(`Updated session: ${sessionId}`);
      
      // Update local state
      setVideos(remainingVideos);
      setSessionData({
        ...sessionData,
        videoIds: updatedVideoIds,
        videoCount: updatedVideoIds.length,
        statistics: newStats
      });
      
      // Close modal
      setDeleteModalOpen(false);
      setVideoToDelete(null);
      setDeleting(false);
      
      alert('Video scan result deleted successfully!');
      
      // If no videos left, redirect to Video-Result page
      if (remainingVideos.length === 0) {
        alert('All videos deleted. Redirecting to Video Results page...');
        router.push('/Video-Result');
      }
    } catch (error) {
      console.error('Error deleting video scan:', error);
      alert('Failed to delete video scan. Please try again.');
      setDeleting(false);
    }
  };

  const handleDeleteVideoCancel = () => {
    setDeleteModalOpen(false);
    setVideoToDelete(null);
  };

  // Download as CSV
  const downloadCSV = () => {
    if (!sessionData) return;

    const csvRows = [];
    
    // Header
    csvRows.push(['Video Scan Report - ' + sessionData.sessionName]);
    csvRows.push(['Generated on: ' + new Date().toLocaleString()]);
    csvRows.push(['Scanned at: ' + new Date(sessionData.scannedAt).toLocaleString()]);
    csvRows.push([]);
    csvRows.push(['Summary Statistics']);
    csvRows.push(['Total Videos', sessionData.statistics.totalVideos]);
    csvRows.push(['Total Links', sessionData.statistics.totalLinks]);
    csvRows.push(['Working Links', sessionData.statistics.workingLinks]);
    csvRows.push(['Warning Links', sessionData.statistics.warningLinks]);
    csvRows.push(['Broken Links', sessionData.statistics.brokenLinks]);
    csvRows.push([]);
    
    // Video details header
    csvRows.push(['Video Title', 'Video URL', 'Link URL', 'Link Status', 'Status Code']);
    
    // Video data
    videos.forEach(video => {
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
    
    const sanitizedSessionName = sessionData.sessionName.replace(/[/\\?%*:|"<>]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `${sanitizedSessionName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('✅ CSV file generated successfully');
  };

  // Download as Excel
  const downloadExcel = async () => {
    if (!sessionData) {
      alert('No session data available');
      return;
    }

    if (!videos || videos.length === 0) {
      alert('No video data available to export.');
      return;
    }

    console.log('📊 Starting Excel export...');
    console.log('Session:', sessionData.sessionName);
    console.log('Videos:', videos.length);

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      
      // Main Report Sheet with structured layout
      const reportData: any[][] = [];
      
      // ===== HEADING SECTION =====
      reportData.push(['VIDEO SCAN REPORT']);
      reportData.push(['']);
      
      // Session Information
      reportData.push(['Session Name:', sessionData.sessionName]);
      reportData.push(['Session ID:', sessionData.sessionId]);
      reportData.push(['Scanned At:', new Date(sessionData.scannedAt).toLocaleString()]);
      reportData.push(['Report Generated:', new Date().toLocaleString()]);
      reportData.push(['']);
      
      // Overall Statistics
      reportData.push(['OVERALL STATISTICS']);
      reportData.push(['Total Videos Scanned:', sessionData.statistics.totalVideos]);
      reportData.push(['Total Links Found:', sessionData.statistics.totalLinks]);
      reportData.push(['Working Links:', sessionData.statistics.workingLinks, '(' + (sessionData.statistics.totalLinks > 0 ? ((sessionData.statistics.workingLinks / sessionData.statistics.totalLinks) * 100).toFixed(1) : '0') + '%)']);
      reportData.push(['Warning Links:', sessionData.statistics.warningLinks, '(' + (sessionData.statistics.totalLinks > 0 ? ((sessionData.statistics.warningLinks / sessionData.statistics.totalLinks) * 100).toFixed(1) : '0') + '%)']);
      reportData.push(['Broken Links:', sessionData.statistics.brokenLinks, '(' + (sessionData.statistics.totalLinks > 0 ? ((sessionData.statistics.brokenLinks / sessionData.statistics.totalLinks) * 100).toFixed(1) : '0') + '%)']);
      reportData.push(['']);
      reportData.push(['']);
      
      // ===== VIDEO DATA SECTION =====
      reportData.push(['VIDEO DETAILS']);
      reportData.push(['']);
      
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
      videos.forEach(video => {
        const allLinks = video.links.map(l => l.url).join('\\n');
        const brokenLinks = video.links.filter(l => l.status === 'broken').map(l => l.url).join('\\n');
        const warningLinks = video.links.filter(l => l.status === 'warning').map(l => l.url).join('\\n');
        const workingLinks = video.links.filter(l => l.status === 'working').map(l => l.url).join('\\n');
        
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
        { wch: 40 },
        { wch: 50 },
        { wch: 60 },
        { wch: 60 },
        { wch: 60 },
        { wch: 60 }
      ];
      
      XLSX.utils.book_append_sheet(wb, reportSheet, 'Video Scan Report');
      
      // Detailed Report Sheet
      const detailedData = [['Video ID', 'Video Title', 'Video URL', 'Total Links', 'Link URL', 'Link Status', 'Status Code']];
      
      videos.forEach(video => {
        const linkCount = video.links.length;
        
        if (linkCount === 0) {
          detailedData.push([
            video.videoId,
            video.videoTitle,
            video.videoUrl,
            '0',
            'No links found',
            'N/A',
            ''
          ]);
        } else {
          video.links.forEach((link, index) => {
            detailedData.push([
              index === 0 ? video.videoId : '',
              index === 0 ? video.videoTitle : '',
              index === 0 ? video.videoUrl : '',
              index === 0 ? linkCount.toString() : '',
              link.url,
              link.status,
              link.statusCode.toString()
            ]);
          });
        }
      });
      
      const detailedSheet = XLSX.utils.aoa_to_sheet(detailedData);
      detailedSheet['!cols'] = [
        { wch: 15 },
        { wch: 40 },
        { wch: 50 },
        { wch: 12 },
        { wch: 60 },
        { wch: 12 },
        { wch: 12 }
      ];
      
      XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Report');
      
      // Videos Summary Sheet
      const videoSummaryData = [['Video ID', 'Video Title', 'Video URL', 'Total Links', 'Working', 'Warning', 'Broken']];
      
      videos.forEach(video => {
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
      videoSummarySheet['!cols'] = [
        { wch: 15 },
        { wch: 40 },
        { wch: 50 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 }
      ];
      
      XLSX.utils.book_append_sheet(wb, videoSummarySheet, 'Videos Summary');
      
      // Download
      const sanitizedSessionName = sessionData.sessionName.replace(/[/\\?%*:|"<>]/g, '-');
      const filename = `${sanitizedSessionName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      console.log('📥 Downloading Excel file:', filename);
      XLSX.writeFile(wb, filename);
      console.log('✅ Excel file generated successfully!');
    } catch (error: any) {
      console.error('❌ Error generating Excel:', error);
      alert(`Failed to generate Excel file.\\n\\nError: ${error.message || 'Unknown error'}`);
    }
  };

  // Download as PDF
  const downloadPDF = async () => {
    if (!sessionData) return;

    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text('Video Scan Report', 14, 20);
      
      // Session info
      doc.setFontSize(12);
      doc.text(`Session: ${sessionData.sessionName}`, 14, 30);
      doc.text(`Scanned: ${new Date(sessionData.scannedAt).toLocaleString()}`, 14, 37);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 44);
      
      // Summary statistics
      doc.setFontSize(14);
      doc.text('Summary Statistics', 14, 57);
      
      const summaryData = [
        ['Total Videos', sessionData.statistics.totalVideos.toString()],
        ['Total Links', sessionData.statistics.totalLinks.toString()],
        ['Working Links', sessionData.statistics.workingLinks.toString()],
        ['Warning Links', sessionData.statistics.warningLinks.toString()],
        ['Broken Links', sessionData.statistics.brokenLinks.toString()]
      ];
      
      autoTable(doc, {
        startY: 62,
        head: [['Metric', 'Count']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });
      
      // Detailed report
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Detailed Video Report', 14, 20);
      
      const detailedData: any[] = [];
      videos.forEach(video => {
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
      
      // Save
      const sanitizedSessionName = sessionData.sessionName.replace(/[/\\?%*:|"<>]/g, '-');
      doc.save(`${sanitizedSessionName}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      console.log('✅ PDF file generated successfully');
    } catch (error: any) {
      console.error('❌ Error generating PDF:', error);
      alert(`Failed to generate PDF file.\\n\\nError: ${error.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-primary-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Not Found</h2>
          <p className="text-gray-600 mb-6">The scan session you're looking for doesn't exist.</p>
          <Link href="/Video-Result" className="btn-primary">
            Back to Video Results
          </Link>
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
          href="/Video-Result"
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Video Results</span>
        </Link>

        {/* Session Header */}
        <div className="card mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{sessionData.sessionName}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(sessionData.scannedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FileText className="w-4 h-4" />
                    <span>Session ID: {sessionId.split('_')[1]?.substring(0, 12)}...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-700 mb-1">Total Videos</p>
              <p className="text-3xl font-bold text-purple-900">{sessionData.videoCount}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-700 mb-1">Total Links</p>
              <p className="text-3xl font-bold text-blue-900">{sessionData.statistics.totalLinks}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-700 mb-1">Working</p>
              <p className="text-3xl font-bold text-green-900">{sessionData.statistics.workingLinks}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
              <p className="text-sm font-medium text-orange-700 mb-1">Warning</p>
              <p className="text-3xl font-bold text-orange-900">{sessionData.statistics.warningLinks}</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-700 mb-1">Broken</p>
              <p className="text-3xl font-bold text-red-900">{sessionData.statistics.brokenLinks}</p>
            </div>
          </div>
        </div>

        {/* Filter and Download Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                All Videos ({videos.length})
              </button>
          <button
            onClick={() => setActiveFilter('working')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeFilter === 'working'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <CheckCircle className="w-4 h-4 inline mr-1" />
            Working ({getVideosWithStatus('working')})
          </button>
          <button
            onClick={() => setActiveFilter('warning')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeFilter === 'warning'
                ? 'bg-orange-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            Warning ({getVideosWithStatus('warning')})
          </button>
              <button
                onClick={() => setActiveFilter('broken')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeFilter === 'broken'
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <XCircle className="w-4 h-4 inline mr-1" />
                Broken ({getVideosWithStatus('broken')})
              </button>
            </div>

            {/* Download Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadCSV}
                disabled={!sessionData || videos.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Download as CSV"
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">CSV</span>
              </button>
              
              <button
                onClick={downloadExcel}
                disabled={!sessionData || videos.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Download as Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm font-medium">Excel</span>
              </button>
              
              <button
                onClick={downloadPDF}
                disabled={!sessionData || videos.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Download as PDF"
              >
                <FileDown className="w-4 h-4" />
                <span className="text-sm font-medium">PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Videos List */}
        <div className="space-y-6">
          {filteredVideos.length === 0 ? (
            <div className="card text-center py-12">
              <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No videos found with the selected filter.</p>
            </div>
          ) : (
            filteredVideos.map((video) => (
              <div key={video.videoId} className="card relative">
                {/* Delete Button */}
                <button
                  onClick={(e) => handleDeleteVideoClick(e, video)}
                  className="absolute top-4 right-4 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg z-10"
                  title="Delete this video scan result"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                {/* Video Header */}
                <div className="flex items-start justify-between mb-4 pr-12">
                  <div className="flex items-start space-x-3 flex-1">
                    <Youtube className="w-6 h-6 text-red-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{video.videoTitle}</h3>
                      <a 
                        href={video.videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:underline inline-flex items-center space-x-1"
                      >
                        <span>{video.videoUrl}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Video Statistics */}
                <div className="flex items-center space-x-6 mb-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <LinkIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700">{video.statistics.totalLinks} links</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-600 font-medium">{video.statistics.workingLinks}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="text-orange-600 font-medium">{video.statistics.warningLinks}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 font-medium">{video.statistics.brokenLinks}</span>
                  </div>
                </div>

                {/* Links List */}
                {video.links.length > 0 && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Links in Description:</h4>
                    <div className="space-y-2">
                      {video.links.slice(0, 5).map((link, index) => (
                        <div key={index} className={`p-3 rounded-lg border ${getStatusBg(link.status)}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-2 flex-1 min-w-0">
                              <div className={`mt-0.5 ${getStatusColor(link.status)}`}>
                                {getStatusIcon(link.status)}
                              </div>
                              <a 
                                href={link.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`text-sm hover:underline break-all ${getStatusColor(link.status)}`}
                              >
                                {link.url}
                              </a>
                            </div>
                            {link.statusCode > 0 && (
                              <span className={`text-xs font-mono ml-2 ${getStatusColor(link.status)}`}>
                                {link.statusCode}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {video.links.length > 5 && (
                        <p className="text-sm text-gray-600 mt-2">
                          + {video.links.length - 5} more links
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
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
                  <h3 className="text-xl font-bold text-gray-900">Delete Video Scan</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={handleDeleteVideoCancel}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={deleting}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Are you sure you want to delete the scan result for <strong>"{videoToDelete?.videoTitle}"</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-medium mb-2">This will permanently delete:</p>
                <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                  <li>{videoToDelete?.statistics.totalLinks} link scan results</li>
                  <li>All link status information</li>
                  <li>Video scan statistics</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleDeleteVideoCancel}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVideoConfirm}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Video'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
