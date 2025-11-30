import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { getVideoDetails, extractLinksFromDescription } from '@/lib/youtube';
import { applyPlanIfTrialEnded, getPlanPolicyFromFirestore } from '@/lib/plans';

export const maxDuration = 300; // 5 minutes max execution time
export const dynamic = 'force-dynamic';

interface VideoLink {
  url: string;
  status: 'working' | 'broken' | 'warning';
  statusCode: number;
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

// Check link status with retry logic (matching channel scan logic)
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrls, sessionName, userId } = body;

    // Validation
    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: 'Video URLs array is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!sessionName) {
      return NextResponse.json(
        { error: 'Session name is required' },
        { status: 400 }
      );
    }

    // Enforce plan limits
    let planIdUsed = 'free';
    if (userId) {
      planIdUsed = await applyPlanIfTrialEnded(userId);
      const policy = await getPlanPolicyFromFirestore(planIdUsed);
      if (policy.maxBulkVideosPerRun !== 'unlimited' && videoUrls.length > policy.maxBulkVideosPerRun) {
        return NextResponse.json({ error: 'Bulk scan size exceeds plan limit' }, { status: 403 });
      }
      if (policy.maxScans !== 'unlimited') {
        const sessionsRef = collection(db, 'scanSessions');
        const q = query(sessionsRef, where('userId', '==', userId));
        const snap = await getDocs(q);
        if (snap.size >= policy.maxScans) {
          return NextResponse.json({ error: 'Scan limit reached for your plan' }, { status: 403 });
        }
      }
    }

    // Generate unique session ID
    const scanSessionId = `session_${Date.now()}_${uuidv4().substring(0, 8)}`;

    console.log(`\n========================================`);
    console.log(`VIDEO SCAN REQUEST RECEIVED`);
    console.log(`========================================`);
    console.log(`Session ID: ${scanSessionId}`);
    console.log(`Session Name: ${sessionName}`);
    console.log(`User ID: ${userId}`);
    console.log(`Video Count: ${videoUrls.length}`);
    console.log(`========================================\n`);

    // Process videos synchronously (matching channel scan logic)
    const results: any[] = [];
    let totalLinks = 0;
    let brokenLinks = 0;
    let warningLinks = 0;
    let workingLinks = 0;
    let videosWithLinks = 0;

    console.log(`\n========================================`);
    console.log(`PROCESSING ${videoUrls.length} VIDEOS`);
    console.log(`========================================`);

    for (let i = 0; i < videoUrls.length; i++) {
      const videoUrl = videoUrls[i];
      
      try {
        // Extract video ID
        const videoIdMatch = videoUrl.match(/(?:v=|\/videos\/|embed\/|youtu.be\/|\/v\/|watch\?v=|&v=)([^#&?]*)/);
        if (!videoIdMatch || !videoIdMatch[1]) {
          console.warn(`⚠️ Invalid video URL: ${videoUrl}`);
          continue;
        }

        const videoId = videoIdMatch[1];
        console.log(`\n[${i + 1}/${videoUrls.length}] Processing video: ${videoId}`);

        // Get video details
        const videoDetails = await getVideoDetails(videoId);
        if (!videoDetails || !videoDetails.snippet) {
          console.warn(`  ⚠️ Could not fetch details - skipping`);
          continue;
        }

        const videoTitle = videoDetails.snippet.title || `Video ${videoId}`;
        const description = videoDetails.snippet.description || '';

        // Extract links from description
        const descriptionLinks = extractLinksFromDescription(description);
        
        if (descriptionLinks.length === 0) {
          console.log(`  ℹ️ No links found - skipping`);
          continue;
        }

        videosWithLinks++;
        console.log(`  ✓ Found ${descriptionLinks.length} links`);
        console.log(`  Checking links...`);

        // Check each link
        const linkResults: VideoLink[] = [];
        for (let j = 0; j < descriptionLinks.length; j++) {
          const link = descriptionLinks[j];
          console.log(`    [${j + 1}/${descriptionLinks.length}] Checking: ${link.substring(0, 60)}...`);
          
          const linkStatus = await checkLinkStatus(link);
          linkResults.push(linkStatus);
          
          totalLinks++;
          if (linkStatus.status === 'working') workingLinks++;
          else if (linkStatus.status === 'warning') warningLinks++;
          else brokenLinks++;
          
          console.log(`      → ${linkStatus.status} (${linkStatus.statusCode})`);
        }

        results.push({
          videoId,
          videoTitle,
          videoUrl,
          links: linkResults
        });

        // Save individual video scan to Firestore
        const videoScanData = {
          videoId,
          videoTitle,
          videoUrl,
          scannedAt: new Date().toISOString(),
          userId,
          scanSessionId,
          scanSessionName: sessionName,
          links: linkResults,
          statistics: {
            totalLinks: linkResults.length,
            workingLinks: linkResults.filter(l => l.status === 'working').length,
            warningLinks: linkResults.filter(l => l.status === 'warning').length,
            brokenLinks: linkResults.filter(l => l.status === 'broken').length
          }
        };

        await setDoc(doc(db, 'videoScans', videoId), videoScanData);
        console.log(`  ✅ Saved to Firestore`);

      } catch (error) {
        console.error(`❌ Error processing video ${videoUrl}:`, error);
      }
    }

    console.log(`\n========================================`);
    console.log(`FINAL STATISTICS`);
    console.log(`========================================`);
    console.log(`Videos Scanned: ${videoUrls.length}`);
    console.log(`Videos with Links: ${videosWithLinks}`);
    console.log(`Total Links: ${totalLinks}`);
    console.log(`  - Working: ${workingLinks}`);
    console.log(`  - Warning: ${warningLinks}`);
    console.log(`  - Broken: ${brokenLinks}`);
    console.log(`========================================\n`);

    const scannedAt = new Date().toISOString();

    // Save final session data to Firestore
    const finalSessionData = {
      sessionId: scanSessionId,
      sessionName,
      userId,
      status: 'completed',
      progress: 100,
      totalVideos: videoUrls.length,
      processedVideos: videoUrls.length,
      createdAt: scannedAt,
      startedAt: scannedAt,
      completedAt: scannedAt,
      videoCount: results.length,
      statistics: {
        totalVideos: videoUrls.length,
        totalLinks,
        workingLinks,
        warningLinks,
        brokenLinks
      },
      videoIds: results.map(r => r.videoId),
      enforcedPlanId: planIdUsed
    };

    await setDoc(doc(db, 'scanSessions', scanSessionId), finalSessionData);
    console.log(`✅ Session saved to Firestore: ${scanSessionId}\n`);

    return NextResponse.json({
      success: true,
      sessionId: scanSessionId,
      scannedVideos: videoUrls.length,
      videosWithLinks,
      statistics: {
        totalLinks,
        workingLinks,
        warningLinks,
        brokenLinks
      },
      results,
      scannedAt
    });

  } catch (error: any) {
    console.error('❌ Video scan error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scan videos',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
