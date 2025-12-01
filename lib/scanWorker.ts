import { scanQueue, ScanJobData, ScanJobResult } from './queue';
import { Job } from 'bull';
import { db } from './firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { youtubeApiManager, getVideoDetails as getVideoDetailsFromApi } from './youtube-api-manager';

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

// Batch processing configuration
const BATCH_SIZE = 50;
const MAX_PARALLEL_BATCHES = 100;
const LINKS_CONCURRENCY = 20;

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

// Get channel's uploads playlist ID (uses API manager with key rotation)
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
async function checkLinksInParallel(links: string[]): Promise<VideoLink[]> {
  const results: VideoLink[] = [];
  
  for (let i = 0; i < links.length; i += LINKS_CONCURRENCY) {
    const chunk = links.slice(i, i + LINKS_CONCURRENCY);
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
  
  console.log(`  🔄 [Batch ${batchIndex + 1}/${totalBatches}] Processing ${videos.length} videos...`);
  
  // Get video details and extract links
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
  }
  
  // Check all links in parallel
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
  
  console.log(`  ✅ [Batch ${batchIndex + 1}] Done - ${batchResults.length} videos with links`);
  
  return batchResults;
}

// Split array into batches
function splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

// Process all batches in parallel
async function processAllBatchesInParallel(videos: any[]): Promise<VideoScanResult[]> {
  const batches = splitIntoBatches(videos, BATCH_SIZE);
  const totalBatches = batches.length;
  
  console.log(`\n⚡ PARALLEL BATCH PROCESSING`);
  console.log(`  Total videos: ${videos.length}`);
  console.log(`  Batches: ${totalBatches} (${BATCH_SIZE} per batch)`);
  console.log(`  Max parallel: ${MAX_PARALLEL_BATCHES}\n`);
  
  const allResults: VideoScanResult[] = [];
  
  for (let i = 0; i < batches.length; i += MAX_PARALLEL_BATCHES) {
    const batchGroup = batches.slice(i, i + MAX_PARALLEL_BATCHES);
    const startIndex = i;
    
    console.log(`\n🚀 Processing batch group ${Math.floor(i / MAX_PARALLEL_BATCHES) + 1}/${Math.ceil(batches.length / MAX_PARALLEL_BATCHES)}`);
    
    const groupResults = await Promise.all(
      batchGroup.map((batch, idx) => 
        processBatch(batch, startIndex + idx, totalBatches)
      )
    );
    
    for (const batchResults of groupResults) {
      allResults.push(...batchResults);
    }
  }
  
  return allResults;
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
    
    const scanStartTime = Date.now();
    const videos = await fetchChannelVideos(channelId, videoCount, startDate, endDate);
    console.log(`✓ Collected ${videos.length} videos`);
    
    await job.progress(10);

    // STEP 2 & 3: Process videos (parallel for large scans, sequential for small)
    let scanResults: VideoScanResult[];
    
    if (videos.length > BATCH_SIZE) {
      // Use parallel batch processing for large scans
      console.log(`\n⚡ Using PARALLEL BATCH PROCESSING (${videos.length} videos > ${BATCH_SIZE} threshold)`);
      await job.progress(15);
      
      scanResults = await processAllBatchesInParallel(videos);
      
      await job.progress(85);
    } else {
      // Sequential processing for small scans
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

      // STEP 3: Check links (with parallel processing for links)
      console.log(`\n========================================`);
      console.log(`STEP 3: CHECKING ALL LINKS`);
      console.log(`========================================`);
      
      scanResults = [];
      
      for (let i = 0; i < videoDetailsWithLinks.length; i++) {
        const videoData = videoDetailsWithLinks[i];
        
        // Use parallel link checking
        const videoLinks = await checkLinksInParallel(videoData.links);
        
        scanResults.push({
          videoId: videoData.videoId,
          videoTitle: videoData.videoTitle,
          videoUrl: videoData.videoUrl,
          publishedAt: videoData.publishedAt,
          links: videoLinks,
        });
        
        // Update progress (40% to 85%)
        const progress = 40 + Math.floor(((i + 1) / videoDetailsWithLinks.length) * 45);
        await job.progress(progress);
      }
    }
    
    const scanDuration = ((Date.now() - scanStartTime) / 1000).toFixed(1);
    console.log(`\n✅ Scan completed in ${scanDuration} seconds!`);
    console.log(`  - Videos scanned: ${videos.length}`);
    console.log(`  - Videos with links: ${scanResults.length}`);

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

    console.log(`\n✓ Final statistics:`);
    console.log(`  - Total links checked: ${totalLinksCount}`);
    console.log(`  - Broken: ${brokenLinks}, Warning: ${warningLinks}, Working: ${workingLinks}`);

    const result: ScanJobResult = {
      success: true,
      scannedVideos: videos.length,
      videosWithLinks: scanResults.length,
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
        videosWithLinks: scanResults.length,
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
