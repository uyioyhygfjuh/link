const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  customUrl: string;
  thumbnail: string;
  subscriberCount: string;
  videoCount: string;
  viewCount: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
}

// Extract channel ID from various YouTube URL formats
export function extractChannelId(input: string): string | null {
  // Remove whitespace
  input = input.trim();

  // If it's already a channel ID (starts with UC)
  if (input.startsWith('UC') && input.length === 24) {
    return input;
  }

  // Extract from URL patterns
  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]{22})/,
    /youtube\.com\/c\/([\w-]+)/,
    /youtube\.com\/@([\w-]+)/,
    /youtube\.com\/user\/([\w-]+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // If it starts with @, remove it
  if (input.startsWith('@')) {
    return input.substring(1);
  }

  // Return as-is (might be username or custom URL)
  return input;
}

// Get channel details by ID
export async function getChannelById(channelId: string): Promise<YouTubeChannel | null> {
  try {
    const url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const channel = data.items[0];
      return {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl || '',
        thumbnail: channel.snippet.thumbnails.high.url,
        subscriberCount: formatNumber(channel.statistics.subscriberCount),
        videoCount: channel.statistics.videoCount,
        viewCount: channel.statistics.viewCount,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching channel:', error);
    return null;
  }
}

// Search for channel by username or custom URL
export async function searchChannel(query: string): Promise<YouTubeChannel | null> {
  try {
    // First try to get by username/forUsername
    const forUsernameUrl = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&forUsername=${query}&key=${YOUTUBE_API_KEY}`;
    const forUsernameResponse = await fetch(forUsernameUrl);
    const forUsernameData = await forUsernameResponse.json();

    if (forUsernameData.items && forUsernameData.items.length > 0) {
      const channel = forUsernameData.items[0];
      return {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl || '',
        thumbnail: channel.snippet.thumbnails.high.url,
        subscriberCount: formatNumber(channel.statistics.subscriberCount),
        videoCount: channel.statistics.videoCount,
        viewCount: channel.statistics.viewCount,
      };
    }

    // If not found, try search
    const searchUrl = `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.items && searchData.items.length > 0) {
      const channelId = searchData.items[0].id.channelId;
      return await getChannelById(channelId);
    }

    return null;
  } catch (error) {
    console.error('Error searching channel:', error);
    return null;
  }
}

// Get channel videos
export async function getChannelVideos(channelId: string, maxResults: number = 50): Promise<YouTubeVideo[]> {
  try {
    const url = `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.items) {
      return data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails.high.url,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching videos:', error);
    return [];
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

// Get all videos from a playlist (channel uploads)
async function getPlaylistVideos(
  playlistId: string,
  maxResults: number,
  startDate?: string,
  endDate?: string
): Promise<YouTubeVideo[]> {
  try {
    let allVideos: YouTubeVideo[] = [];
    let nextPageToken: string | undefined = undefined;
    const videosPerPage = 50; // YouTube API max

    const startDateTime = startDate ? new Date(startDate).getTime() : 0;
    const endDateTime = endDate ? new Date(endDate).getTime() : Infinity;

    console.log(`Fetching videos from playlist: ${playlistId}, max: ${maxResults}`);

    while (allVideos.length < maxResults) {
      const resultsToFetch = Math.min(videosPerPage, maxResults - allVideos.length);
      const pageToken: string = nextPageToken ? `&pageToken=${nextPageToken}` : '';
      
      const url: string = `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${resultsToFetch}${pageToken}&key=${YOUTUBE_API_KEY}`;
      
      console.log(`Fetching page ${Math.floor(allVideos.length / videosPerPage) + 1}, requesting ${resultsToFetch} videos`);
      const response: Response = await fetch(url);
      
      if (!response.ok) {
        console.error(`YouTube API error: ${response.status}`);
        const errorData = await response.json();
        console.error('Error details:', errorData);
        break;
      }

      const data: any = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log('No more videos available');
        break;
      }

      const videos = data.items
        .filter((item: any) => {
          // Filter by date range if specified
          if (startDate || endDate) {
            const publishedAt = new Date(item.snippet.publishedAt).getTime();
            return publishedAt >= startDateTime && publishedAt <= endDateTime;
          }
          return true;
        })
        .map((item: any) => ({
          id: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          publishedAt: item.snippet.publishedAt,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
        }));

      console.log(`Received ${videos.length} videos (after filtering), total: ${allVideos.length + videos.length}`);
      allVideos = allVideos.concat(videos);
      nextPageToken = data.nextPageToken;
      
      // Break if we have enough videos or no more pages
      if (allVideos.length >= maxResults || !nextPageToken) {
        if (!nextPageToken) {
          console.log('No more pages available');
        }
        break;
      }
    }

    return allVideos.slice(0, maxResults);
  } catch (error) {
    console.error('Error fetching playlist videos:', error);
    return [];
  }
}

// Get channel videos with date range support (NEW: Uses Playlist API)
export async function getChannelVideosByDateRange(
  channelId: string,
  maxResults: number = 50,
  startDate?: string,
  endDate?: string
): Promise<YouTubeVideo[]> {
  try {
    console.log(`Getting videos for channel: ${channelId}, max: ${maxResults}`);
    
    // Get the uploads playlist ID for this channel
    const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
    
    if (!uploadsPlaylistId) {
      console.error('Could not find uploads playlist for channel');
      return [];
    }

    console.log(`Found uploads playlist: ${uploadsPlaylistId}`);
    
    // Fetch videos from the uploads playlist
    const videos = await getPlaylistVideos(uploadsPlaylistId, maxResults, startDate, endDate);
    
    console.log(`Total videos fetched: ${videos.length}`);
    return videos;
  } catch (error) {
    console.error('Error fetching videos by date range:', error);
    return [];
  }
}

// Get video details including description
export async function getVideoDetails(videoId: string): Promise<any> {
  try {
    const url = `${YOUTUBE_API_BASE}/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      return data.items[0];
    }

    return null;
  } catch (error) {
    console.error('Error fetching video details:', error);
    return null;
  }
}

// Extract links from video description
export function extractLinksFromDescription(description: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = description.match(urlRegex);
  return matches || [];
}

// Check if a link is working
export async function checkLink(url: string): Promise<{ working: boolean; status: number }> {
  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
    return {
      working: response.ok || response.type === 'opaque',
      status: response.status || 200,
    };
  } catch (error) {
    return {
      working: false,
      status: 0,
    };
  }
}

// Format large numbers (e.g., 1.2M, 45K)
function formatNumber(num: string | number): string {
  const n = typeof num === 'string' ? parseInt(num) : num;
  
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1) + 'M';
  } else if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'K';
  }
  
  return n.toString();
}

// Connect to a YouTube channel
export async function connectYouTubeChannel(input: string): Promise<YouTubeChannel | null> {
  const channelIdentifier = extractChannelId(input);
  
  if (!channelIdentifier) {
    throw new Error('Invalid YouTube channel input');
  }

  // Try to get channel by ID first
  if (channelIdentifier.startsWith('UC')) {
    return await getChannelById(channelIdentifier);
  }

  // Otherwise search for the channel
  return await searchChannel(channelIdentifier);
}
