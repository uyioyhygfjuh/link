import { scanQueue, ScanJobData, ScanJobResult } from './queue';
import { Job } from 'bull';
import { db } from './firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface VideoLink {
  url: string;
  status: 'working' | 'broken' | 'warning';
  statusCode: number;
}

interface VideoScanResult {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  publishedAt: string;
  links: VideoLink[];
}

// Extract links from video description
function extractLinksFromDescription(description: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = description.match(urlRegex);
  return matches ? matches.map(url => url.replace(/[.,;!?)]+$/, '')) : [];
}

// Detect if URL is from a social media or known platform
function isSocialMediaOrKnownPlatform(url: string): boolean {
  const knownDomains = [
    'facebook.com', 'fb.com', 'twitter.com', 'x.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'snapchat.com',
    'pinterest.com', 'reddit.com', 'tumblr.com', 'whatsapp.com',
    't.me', 'telegram.org', 'telegram.me',
    'goo.gl', 'bit.ly', 't.co', 'ow.ly', 'tinyurl.com', 'buff.ly',
    'amazon.com', 'amzn.to', 'flipkart.com', 'ebay.com', 'meesho.com',
    'prntscr.com', 'lightshot.com', 'imgur.com', 'gyazo.com'
  ];
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '').replace('app.', '');
    return knownDomains.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

// Check link status with retry logic
async function checkLinkStatus(url: string, retryCount = 0): Promise<VideoLink> {
  const maxRetries = 2;
  const isSocialMedia = isSocialMediaOrKnownPlatform(url);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    let status: 'working' | 'broken' | 'warning' = 'working';
    const statusCode = response.status;

    if (statusCode >= 200 && statusCode < 300) {
      status = 'working';
    } else if (statusCode >= 300 && statusCode < 400) {
      status = 'warning';
    } else if (statusCode >= 400 && statusCode < 500) {
      if (isSocialMedia) {
        if (statusCode === 400 || statusCode === 403 || statusCode === 405 || statusCode === 429) {
          status = 'warning';
        } else if (statusCode === 404 || statusCode === 410) {
          status = 'broken';
        } else {
          status = 'warning';
        }
      } else {
        status = 'broken';
      }
    } else if (statusCode >= 500) {
      if (isSocialMedia && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return checkLinkStatus(url, retryCount + 1);
      }
      status = 'warning';
    }

    return { url, status, statusCode };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      if (isSocialMedia && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return checkLinkStatus(url, retryCount + 1);
      }
      return { url, status: 'warning', statusCode: 408 };
    }
    
    if (isSocialMedia && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return checkLinkStatus(url, retryCount + 1);
    }
    
    if (isSocialMedia) {
      return { url, status: 'warning', statusCode: 0 };
    }
    
    return { url, status: 'broken', statusCode: 0 };
  }
}

// Get channel's uploads playlist ID
async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  try {
    const url = `${YOUTUBE_API_BASE}/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      return data.items[0].contentDetails.relatedPlaylists.uploads;
    }
    return null;
  } catch (error) {
    console.error('Error getting uploads playlist:', error);
    return null;
  }
}

// Fetch channel videos using Playlist API (NO LIMIT!)
async function fetchChannelVideos(
  channelId: string,
  maxResults: number,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  try {
    console.log(`\n📹 Fetching ${maxResults} videos from channel: ${channelId}`);
    
    // Get the uploads playlist ID
    const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
    
    if (!uploadsPlaylistId) {
      throw new Error('Could not find uploads playlist for channel');
    }

    console.log(`✓ Found uploads playlist: ${uploadsPlaylistId}`);

    let allVideos: any[] = [];
    let nextPageToken: string | undefined = undefined;
    const videosPerPage = 50;

    const startDateTime = startDate ? new Date(startDate).getTime() : 0;
    const endDateTime = endDate ? new Date(endDate).getTime() : Infinity;

    let pageCount = 0;
    while (allVideos.length < maxResults) {
      pageCount++;
      const resultsToFetch = Math.min(videosPerPage, maxResults - allVideos.length);
      const pageToken = nextPageToken ? `&pageToken=${nextPageToken}` : '';
      
      const playlistUrl: string = `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${resultsToFetch}${pageToken}&key=${YOUTUBE_API_KEY}`;
      
      console.log(`  📄 Fetching page ${pageCount} (${resultsToFetch} videos)...`);
      const response = await fetch(playlistUrl);
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log('  ✓ No more videos available');
        break;
      }

      // Filter by date range if specified
      const filteredItems = data.items.filter((item: any) => {
        if (startDate || endDate) {
          const publishedAt = new Date(item.snippet.publishedAt).getTime();
          return publishedAt >= startDateTime && publishedAt <= endDateTime;
        }
        return true;
      });

      // Convert playlist items to search result format for compatibility
      const convertedItems = filteredItems.map((item: any) => ({
        id: { videoId: item.snippet.resourceId.videoId },
        snippet: item.snippet
      }));

      console.log(`  ✓ Received ${convertedItems.length} videos (total: ${allVideos.length + convertedItems.length})`);
      allVideos = allVideos.concat(convertedItems);
      nextPageToken = data.nextPageToken;

      if (!nextPageToken || allVideos.length >= maxResults) {
        if (!nextPageToken) {
          console.log('  ✓ Reached end of playlist');
        }
        break;
      }
    }

    const finalVideos = allVideos.slice(0, maxResults);
    console.log(`✓ Total videos fetched: ${finalVideos.length}\n`);
    return finalVideos;
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
}

// Get video details including description
async function getVideoDetails(videoId: string): Promise<any> {
  try {
    const url = `${YOUTUBE_API_BASE}/videos?key=${YOUTUBE_API_KEY}&id=${videoId}&part=snippet,contentDetails,statistics`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    return data.items?.[0] || null;
  } catch (error) {
    console.error('Error fetching video details:', error);
    return null;
  }
}

// Process scan job
scanQueue.process(async (job: Job<ScanJobData>) => {
  const { jobId, userId, channelId, channelName, firestoreDocId, videoCount, startDate, endDate, scanMode } = job.data;
  
  console.log(`\n🚀 Starting background scan job: ${jobId}`);
  console.log(`Channel: ${channelName} (${channelId})`);
  console.log(`Mode: ${scanMode}`);
  console.log(`Videos: ${videoCount}`);
  
  try {
    // Update job status to processing
    await updateDoc(doc(db, 'scanJobs', jobId), {
      status: 'processing',
      startedAt: new Date().toISOString(),
      progress: 0,
    });

    // STEP 1: Fetch videos
    console.log(`\n========================================`);
    console.log(`STEP 1: COLLECTING ${videoCount} VIDEOS`);
    console.log(`========================================`);
    
    const videos = await fetchChannelVideos(channelId, videoCount, startDate, endDate);
    console.log(`✓ Collected ${videos.length} videos`);
    
    await job.progress(10);

    // STEP 2: Get video details
    console.log(`\n========================================`);
    console.log(`STEP 2: FETCHING VIDEO DETAILS`);
    console.log(`========================================`);
    
    const videoDetailsWithLinks: Array<{
      videoId: string;
      videoTitle: string;
      videoUrl: string;
      publishedAt: string;
      links: string[];
    }> = [];
    
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const videoId = video.id.videoId;
      
      const videoDetails = await getVideoDetails(videoId);
      
      if (!videoDetails) continue;
      
      const description = videoDetails.snippet.description || '';
      const links = extractLinksFromDescription(description);
      
      if (links.length === 0) continue;
      
      videoDetailsWithLinks.push({
        videoId,
        videoTitle: videoDetails.snippet.title,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: videoDetails.snippet.publishedAt,
        links: links,
      });
      
      // Update progress (10% to 40%)
      const progress = 10 + Math.floor((i / videos.length) * 30);
      await job.progress(progress);
    }
    
    console.log(`✓ Found ${videoDetailsWithLinks.length} videos with links`);
    await job.progress(40);

    // STEP 3: Check links
    console.log(`\n========================================`);
    console.log(`STEP 3: CHECKING ALL LINKS`);
    console.log(`========================================`);
    
    const scanResults: VideoScanResult[] = [];
    const totalLinks = videoDetailsWithLinks.reduce((sum, v) => sum + v.links.length, 0);
    let checkedLinks = 0;
    
    for (const videoData of videoDetailsWithLinks) {
      const videoLinks: VideoLink[] = [];
      
      for (const link of videoData.links) {
        const linkStatus = await checkLinkStatus(link);
        videoLinks.push(linkStatus);
        checkedLinks++;
        
        // Update progress (40% to 90%)
        const progress = 40 + Math.floor((checkedLinks / totalLinks) * 50);
        await job.progress(progress);
      }
      
      scanResults.push({
        videoId: videoData.videoId,
        videoTitle: videoData.videoTitle,
        videoUrl: videoData.videoUrl,
        publishedAt: videoData.publishedAt,
        links: videoLinks,
      });
    }

    // Calculate statistics
    let totalLinksCount = 0;
    let brokenLinks = 0;
    let warningLinks = 0;
    let workingLinks = 0;

    scanResults.forEach(result => {
      result.links.forEach(link => {
        totalLinksCount++;
        if (link.status === 'broken') brokenLinks++;
        else if (link.status === 'warning') warningLinks++;
        else workingLinks++;
      });
    });

    console.log(`\n✓ Scan completed!`);
    console.log(`  - Videos scanned: ${videos.length}`);
    console.log(`  - Videos with links: ${videoDetailsWithLinks.length}`);
    console.log(`  - Total links checked: ${totalLinksCount}`);
    console.log(`  - Broken: ${brokenLinks}, Warning: ${warningLinks}, Working: ${workingLinks}`);

    const result: ScanJobResult = {
      success: true,
      scannedVideos: videos.length,
      videosWithLinks: videoDetailsWithLinks.length,
      statistics: {
        totalLinks: totalLinksCount,
        brokenLinks,
        warningLinks,
        workingLinks,
      },
      results: scanResults,
      scannedAt: new Date().toISOString(),
    };

    // Update Firestore with results
    const channelDoc = await getDoc(doc(db, 'channels', firestoreDocId));
    const currentTotalScans = channelDoc.data()?.totalScans || 0;
    
    await updateDoc(doc(db, 'channels', firestoreDocId), {
      totalScans: currentTotalScans + 1,
      brokenLinks: brokenLinks,
      lastScan: new Date().toISOString(),
      lastScanResults: {
        scannedVideos: videos.length,
        videosWithLinks: videoDetailsWithLinks.length,
        totalLinks: totalLinksCount,
        brokenLinks,
        warningLinks,
        workingLinks,
        scannedAt: result.scannedAt,
      },
      scanResults: scanResults,
    });

    // Update job status to completed
    await updateDoc(doc(db, 'scanJobs', jobId), {
      status: 'completed',
      completedAt: new Date().toISOString(),
      progress: 100,
      result: result,
    });

    await job.progress(100);
    
    console.log(`✅ Job ${jobId} completed successfully`);
    return result;

  } catch (error: any) {
    console.error(`❌ Job ${jobId} failed:`, error);
    
    // Update job status to failed
    await updateDoc(doc(db, 'scanJobs', jobId), {
      status: 'failed',
      failedAt: new Date().toISOString(),
      error: error.message || 'Unknown error',
    });

    throw error;
  }
});

// Event listeners
scanQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed`);
});

scanQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

scanQueue.on('progress', (job, progress) => {
  console.log(`📊 Job ${job.id} progress: ${progress}%`);
});

console.log('👷 Scan worker started and listening for jobs...');

export default scanQueue;
