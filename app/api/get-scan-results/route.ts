import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface VideoLink {
  url: string;
  status: 'working' | 'broken' | 'warning';
  statusCode: number;
}

interface VideoReport {
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

// Check link status
async function checkLinkStatus(url: string): Promise<VideoLink> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    let status: 'working' | 'broken' | 'warning' = 'working';
    const statusCode = response.status;

    if (statusCode >= 400) {
      status = 'broken';
    } else if (statusCode >= 300 && statusCode < 400) {
      status = 'warning';
    }

    return { url, status, statusCode };
  } catch (error) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      let status: 'working' | 'broken' | 'warning' = 'working';
      const statusCode = response.status;

      if (statusCode >= 400) {
        status = 'broken';
      } else if (statusCode >= 300 && statusCode < 400) {
        status = 'warning';
      }

      return { url, status, statusCode };
    } catch (getError) {
      return { url, status: 'broken', statusCode: 0 };
    }
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoIds } = body;

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'Video IDs array is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching details for ${videoIds.length} videos...`);

    const videoReports: VideoReport[] = [];

    // Process each video
    for (const videoId of videoIds) {
      const videoDetails = await getVideoDetails(videoId);
      
      if (!videoDetails) {
        console.log(`Skipping video ${videoId} - could not fetch details`);
        continue;
      }

      const description = videoDetails.snippet.description || '';
      const links = extractLinksFromDescription(description);

      if (links.length === 0) {
        console.log(`No links found in video ${videoId}`);
        continue;
      }

      console.log(`Found ${links.length} links in video ${videoId}`);

      // Check each link
      const videoLinks: VideoLink[] = [];
      for (const link of links) {
        const linkStatus = await checkLinkStatus(link);
        videoLinks.push(linkStatus);
        console.log(`  Link: ${link} - Status: ${linkStatus.status} (${linkStatus.statusCode})`);
      }

      videoReports.push({
        videoId,
        videoTitle: videoDetails.snippet.title,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: videoDetails.snippet.publishedAt,
        links: videoLinks,
      });
    }

    return NextResponse.json({
      success: true,
      results: videoReports,
    });

  } catch (error: any) {
    console.error('Error fetching scan results:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch scan results',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
