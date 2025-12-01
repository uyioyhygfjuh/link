import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { applyPlanIfTrialEnded, getPlanPolicyFromFirestore } from '@/lib/plans';
import { 
  youtubeApiManager, 
  getVideoDetails as getVideoDetailsFromApi,
  getVideosDetails,
  YOUTUBE_API_BASE 
} from '@/lib/youtube-api-manager';

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

interface ScanProgress {
  totalVideos: number;
  scannedVideos: number;
  currentVideo: string;
  results: VideoScanResult[];
}

// Batch processing configuration
const BATCH_SIZE = 50; // Process videos in batches of 50
const MAX_PARALLEL_BATCHES = 100; // Maximum number of batches to process in parallel
const LINKS_CONCURRENCY = 10; // Number of links to check in parallel within a batch

// Extract links from video description
function extractLinksFromDescription(description: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = description.match(urlRegex);
  return matches ? matches.map(url => url.replace(/[.,;!?)]+$/, '')) : [];
}

// Detect if URL is from a social media or known platform
function isSocialMediaOrKnownPlatform(url: string): boolean {
  const knownDomains = [
    // Social Media
    'facebook.com', 'fb.com', 'twitter.com', 'x.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'snapchat.com',
    'pinterest.com', 'reddit.com', 'tumblr.com', 'whatsapp.com',
    't.me', 'telegram.org', 'telegram.me',
    // URL Shorteners
    'goo.gl', 'bit.ly', 't.co', 'ow.ly', 'tinyurl.com', 'buff.ly',
    // E-commerce
    'amazon.com', 'amzn.to', 'flipkart.com', 'ebay.com', 'meesho.com',
    // Tools & Services
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
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

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

    // 2xx = working
    if (statusCode >= 200 && statusCode < 300) {
      status = 'working';
    }
    // 3xx = warning (redirects, but still accessible)
    else if (statusCode >= 300 && statusCode < 400) {
      status = 'warning';
    }
    // Special handling for social media and known platforms
    else if (statusCode >= 400 && statusCode < 500) {
      // 4xx errors on social media often mean bot protection, not broken links
      if (isSocialMedia) {
        // For social media, 400/403/405 likely means bot protection, mark as warning
        if (statusCode === 400 || statusCode === 403 || statusCode === 405 || statusCode === 429) {
          console.log(`Social media link ${url} returned ${statusCode} (likely bot protection) - marking as warning`);
          status = 'warning';
        } else if (statusCode === 404 || statusCode === 410) {
          // 404/410 on social media likely means actually broken
          status = 'broken';
        } else {
          status = 'warning'; // Other 4xx on social media = warning
        }
      } else {
        // For regular sites, 4xx = broken
        status = 'broken';
      }
    }
    // 5xx = server errors
    else if (statusCode >= 500) {
      // Server errors might be temporary, especially for known platforms
      if (isSocialMedia && retryCount < maxRetries) {
        console.log(`Server error ${statusCode} for ${url}, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        return checkLinkStatus(url, retryCount + 1); // Retry
      }
      // Mark as warning (server issue, not necessarily broken)
      status = 'warning';
    }

    return { url, status, statusCode };
  } catch (error: any) {
    console.error(`Error checking ${url}:`, error.message);
    
    // Check if it's a timeout or network error
    if (error.name === 'AbortError') {
      // Timeout - retry once for important sites
      if (isSocialMedia && retryCount < maxRetries) {
        console.log(`Timeout for ${url}, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return checkLinkStatus(url, retryCount + 1);
      }
      return { url, status: 'warning', statusCode: 408 }; // Timeout = warning
    }
    
    // Network errors - retry for social media
    if (isSocialMedia && retryCount < maxRetries) {
      console.log(`Network error for ${url}, retrying... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return checkLinkStatus(url, retryCount + 1);
    }
    
    // For other errors on social media, mark as warning (likely accessible in browser)
    if (isSocialMedia) {
      return { url, status: 'warning', statusCode: 0 };
    }
    
    // For regular sites, mark as broken
    return { url, status: 'broken', statusCode: 0 };
  }
}

// Get channel's uploads playlist ID
async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  try {
    const data = await youtubeApiManager.makeRequest<any>('channels', {
      part: 'contentDetails',
      id: channelId,
    });

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
      
      console.log(`  📄 Fetching page ${pageCount} (${resultsToFetch} videos)...`);
      
      // Use API manager with automatic key rotation
      const params: Record<string, string> = {
        part: 'snippet',
        playlistId: uploadsPlaylistId,
        maxResults: String(resultsToFetch),
      };
      
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }
      
      const data = await youtubeApiManager.makeRequest<any>('playlistItems', params);
      
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

// Get video details including description (uses API manager with key rotation)
async function getVideoDetails(videoId: string): Promise<any> {
  try {
    return await getVideoDetailsFromApi(videoId);
  } catch (error) {
    console.error('Error fetching video details:', error);
    return null;
  }
}

// Check multiple links in parallel with concurrency limit
async function checkLinksInParallel(links: string[], concurrency: number = LINKS_CONCURRENCY): Promise<VideoLink[]> {
  const results: VideoLink[] = [];
  
  // Process links in chunks
  for (let i = 0; i < links.length; i += concurrency) {
    const chunk = links.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(link => checkLinkStatus(link))
    );
    results.push(...chunkResults);
  }
  
  return results;
}

// Process a single batch of videos
async function processBatch(
  videos: any[],
  batchIndex: number,
  totalBatches: number
): Promise<VideoScanResult[]> {
  const batchResults: VideoScanResult[] = [];
  const startTime = Date.now();
  
  console.log(`\n🔄 [Batch ${batchIndex + 1}/${totalBatches}] Processing ${videos.length} videos...`);
  
  // Step 1: Get video details and extract links
  const videoDetailsWithLinks: Array<{
    videoId: string;
    videoTitle: string;
    videoUrl: string;
    publishedAt: string;
    links: string[];
  }> = [];
  
  for (const video of videos) {
    const videoId = video.id.videoId;
    const videoDetails = await getVideoDetails(videoId);
    
    if (!videoDetails) {
      continue;
    }
    
    const description = videoDetails.snippet.description || '';
    const links = extractLinksFromDescription(description);
    
    if (links.length === 0) {
      continue;
    }
    
    videoDetailsWithLinks.push({
      videoId,
      videoTitle: videoDetails.snippet.title,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: videoDetails.snippet.publishedAt,
      links: links,
    });
  }
  
  console.log(`   [Batch ${batchIndex + 1}] Found ${videoDetailsWithLinks.length} videos with links`);
  
  // Step 2: Check all links in parallel
  for (const videoData of videoDetailsWithLinks) {
    const videoLinks = await checkLinksInParallel(videoData.links);
    
    batchResults.push({
      videoId: videoData.videoId,
      videoTitle: videoData.videoTitle,
      videoUrl: videoData.videoUrl,
      publishedAt: videoData.publishedAt,
      links: videoLinks,
    });
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   ✅ [Batch ${batchIndex + 1}] Completed in ${duration}s - ${batchResults.length} videos processed`);
  
  return batchResults;
}

// Split array into chunks
function splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

// Process all batches with controlled parallelism
async function processAllBatchesInParallel(
  videos: any[],
  maxParallelBatches: number = MAX_PARALLEL_BATCHES
): Promise<VideoScanResult[]> {
  const batches = splitIntoBatches(videos, BATCH_SIZE);
  const totalBatches = batches.length;
  
  console.log(`\n========================================`);
  console.log(`PARALLEL BATCH PROCESSING`);
  console.log(`========================================`);
  console.log(`Total videos: ${videos.length}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Number of batches: ${totalBatches}`);
  console.log(`Max parallel batches: ${maxParallelBatches}`);
  console.log(`========================================\n`);
  
  const allResults: VideoScanResult[] = [];
  
  // Process batches in parallel groups
  for (let i = 0; i < batches.length; i += maxParallelBatches) {
    const batchGroup = batches.slice(i, i + maxParallelBatches);
    const startIndex = i;
    
    console.log(`\n🚀 Starting parallel group ${Math.floor(i / maxParallelBatches) + 1}/${Math.ceil(batches.length / maxParallelBatches)} (${batchGroup.length} batches)`);
    
    const groupResults = await Promise.all(
      batchGroup.map((batch, idx) => 
        processBatch(batch, startIndex + idx, totalBatches)
      )
    );
    
    // Flatten and add results
    for (const batchResults of groupResults) {
      allResults.push(...batchResults);
    }
  }
  
  return allResults;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId, videoCount, startDate, endDate, firestoreDocId, userId, channelName } = body;

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      );
    }

    if (!videoCount || videoCount < 1) {
      return NextResponse.json(
        { error: 'Video count must be at least 1' },
        { status: 400 }
      );
    }

    console.log(`\n========================================`);
    console.log(`SCAN REQUEST RECEIVED`);
    console.log(`========================================`);
    console.log(`Channel ID: ${channelId}`);
    console.log(`Channel Name: ${channelName || 'Unknown'}`);
    console.log(`Firestore Doc ID: ${firestoreDocId || 'Not provided'}`);
    console.log(`User ID: ${userId || 'Not provided'}`);
    console.log(`Video Count: ${videoCount}`);
    console.log(`========================================\n`);

    // Enforce plan limits
    let enforcedCount = videoCount;
    let planIdUsed = 'free';
    if (userId) {
      planIdUsed = await applyPlanIfTrialEnded(userId);
      const policy = await getPlanPolicyFromFirestore(planIdUsed);
      enforcedCount = policy.maxVideosPerScan === 'unlimited' ? videoCount : Math.min(videoCount, policy.maxVideosPerScan);
      if (policy.maxScans !== 'unlimited') {
        const channelsRef = collection(db, 'channels');
        const q = query(channelsRef, where('userId', '==', userId));
        const snap = await getDocs(q);
        let totalUserScans = 0;
        snap.forEach((d) => {
          const data = d.data() as any;
          totalUserScans += Number(data?.totalScans || 0);
        });
        if (totalUserScans >= policy.maxScans) {
          return NextResponse.json({ error: 'Scan limit reached for your plan' }, { status: 403 });
        }
      }
    }

    // STEP 1: Fetch ALL videos from channel first
    console.log(`\n========================================`);
    console.log(`STEP 1: COLLECTING ${videoCount} VIDEOS`);
    console.log(`========================================`);
    console.log(`Fetching ${videoCount} videos from channel ${channelId}...`);
    
    const scanStartTime = Date.now();
    const videos = await fetchChannelVideos(channelId, enforcedCount, startDate, endDate);
    
    console.log(`✓ Successfully collected ${videos.length} videos!`);
    
    // STEP 2 & 3: Process videos in parallel batches (if > 100 videos)
    let scanResults: VideoScanResult[];
    
    if (videos.length > BATCH_SIZE) {
      // Use parallel batch processing for large scans
      console.log(`\n⚡ Using PARALLEL BATCH PROCESSING (${videos.length} videos > ${BATCH_SIZE} threshold)`);
      scanResults = await processAllBatchesInParallel(videos);
    } else {
      // Use sequential processing for small scans (more efficient for < 100 videos)
      console.log(`\n📝 Using sequential processing (${videos.length} videos <= ${BATCH_SIZE} threshold)`);
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
      
      let detailsFetchedCount = 0;
      
      for (const video of videos) {
        const videoId = video.id.videoId;
        detailsFetchedCount++;
        
        console.log(`[${detailsFetchedCount}/${videos.length}] Fetching details for video: ${videoId}`);
        
        const videoDetails = await getVideoDetails(videoId);
        
        if (!videoDetails) {
          console.log(`  ⚠️ Could not fetch details - skipping`);
          continue;
        }
        
        const description = videoDetails.snippet.description || '';
        const links = extractLinksFromDescription(description);
        
        if (links.length === 0) {
          console.log(`  ℹ️ No links found - skipping`);
          continue;
        }
        
        console.log(`  ✓ Found ${links.length} links`);
        
        videoDetailsWithLinks.push({
          videoId,
          videoTitle: videoDetails.snippet.title,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: videoDetails.snippet.publishedAt,
          links: links,
        });
      }
      
      console.log(`\n✓ Collected ${videoDetailsWithLinks.length} videos with links`);
      
      // STEP 3: Check links (with parallel processing for links)
      console.log(`\n========================================`);
      console.log(`STEP 3: CHECKING ALL LINKS`);
      console.log(`========================================`);
      
      scanResults = [];
      
      for (const videoData of videoDetailsWithLinks) {
        console.log(`\nChecking ${videoData.links.length} links for: ${videoData.videoTitle}`);
        
        // Use parallel link checking even for small batches
        const videoLinks = await checkLinksInParallel(videoData.links);
        
        scanResults.push({
          videoId: videoData.videoId,
          videoTitle: videoData.videoTitle,
          videoUrl: videoData.videoUrl,
          publishedAt: videoData.publishedAt,
          links: videoLinks,
        });
      }
    }
    
    const scanDuration = ((Date.now() - scanStartTime) / 1000).toFixed(1);
    const totalLinksChecked = scanResults.reduce((sum, r) => sum + r.links.length, 0);
    
    console.log(`\n✅ Scan completed in ${scanDuration} seconds!`);
    console.log(`  - Videos scanned: ${videos.length}`);
    console.log(`  - Videos with links: ${scanResults.length}`);
    console.log(`  - Total links checked: ${totalLinksChecked}`);


    // Calculate statistics
    let totalLinks = 0;
    let brokenLinks = 0;
    let warningLinks = 0;
    let workingLinks = 0;

    scanResults.forEach(result => {
      result.links.forEach(link => {
        totalLinks++;
        if (link.status === 'broken') brokenLinks++;
        else if (link.status === 'warning') warningLinks++;
        else workingLinks++;
      });
    });

    console.log(`\n========================================`);
    console.log(`FINAL STATISTICS`);
    console.log(`========================================`);
    console.log(`Total Links: ${totalLinks}`);
    console.log(`  - Broken: ${brokenLinks}`);
    console.log(`  - Warning: ${warningLinks}`);
    console.log(`  - Working: ${workingLinks}`);
    console.log(`========================================\n`);

    const scannedAt = new Date().toISOString();
    const scanResultData = {
      success: true,
      channelId,
      scannedVideos: videos.length,
      videosWithLinks: scanResults.length,
      statistics: {
        totalLinks,
        brokenLinks,
        warningLinks,
        workingLinks,
      },
      results: scanResults,
      scannedAt,
      enforcedPlanId: planIdUsed
    };

    // SAVE RESULTS TO FIRESTORE
    if (firestoreDocId && userId) {
      try {
        console.log(`\n========================================`);
        console.log(`SAVING RESULTS TO FIRESTORE`);
        console.log(`========================================`);
        console.log(`Firestore Doc ID: ${firestoreDocId}`);
        
        const channelRef = doc(db, 'channels', firestoreDocId);
        
        // Get current channel data to preserve totalScans count
        const channelDoc = await getDoc(channelRef);
        const currentData = channelDoc.exists() ? channelDoc.data() : {};
        const currentTotalScans = currentData.totalScans || 0;
        
        // Update channel document with scan results
        await updateDoc(channelRef, {
          totalScans: currentTotalScans + 1,
          brokenLinks: brokenLinks,
          lastScan: scannedAt,
          lastScanResults: {
            scannedVideos: videos.length,
            videosWithLinks: scanResults.length,
            totalLinks,
            brokenLinks,
            warningLinks,
            workingLinks,
            scannedAt,
          },
          scanResults: scanResults,
          lastUpdated: scannedAt,
          enforcedPlanId: planIdUsed
        });
        
        console.log(`✅ Results saved to Firestore successfully!`);
        console.log(`   - Total Scans: ${currentTotalScans + 1}`);
        console.log(`   - Broken Links: ${brokenLinks}`);
        console.log(`   - Last Scan: ${scannedAt}`);
        console.log(`========================================\n`);
        
      } catch (firestoreError: any) {
        console.error('❌ Failed to save to Firestore:', firestoreError);
        console.error('Error details:', firestoreError.message);
        // Don't fail the entire request if Firestore save fails
        // Results will still be returned to frontend
      }
    } else {
      console.log(`\n⚠️  Firestore save skipped - missing firestoreDocId or userId`);
      console.log(`   firestoreDocId: ${firestoreDocId || 'NOT PROVIDED'}`);
      console.log(`   userId: ${userId || 'NOT PROVIDED'}\n`);
    }

    return NextResponse.json(scanResultData);

  } catch (error: any) {
    console.error('Scan error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scan channel',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
