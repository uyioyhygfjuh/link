/**
 * YouTube API Key Manager
 * 
 * Manages multiple YouTube API keys with automatic rotation on quota exhaustion (403 errors).
 * Uses round-robin rotation to ensure continuous data retrieval.
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface ApiKeyState {
  key: string;
  isExhausted: boolean;
  exhaustedAt: number | null;
  errorCount: number;
}

class YouTubeApiKeyManager {
  private apiKeys: ApiKeyState[] = [];
  private currentKeyIndex: number = 0;
  private readonly EXHAUSTION_RESET_TIME = 24 * 60 * 60 * 1000; // 24 hours in ms

  constructor() {
    this.loadApiKeys();
  }

  private loadApiKeys(): void {
    // Load API keys from environment variable
    // Format: YOUTUBE_API_KEYS="key1,key2,key3" (comma-separated)
    const keysEnv = process.env.YOUTUBE_API_KEYS || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || '';
    
    if (!keysEnv) {
      console.error('⚠️ No YouTube API keys configured!');
      return;
    }

    // Split by comma and filter empty strings
    const keys = keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    this.apiKeys = keys.map(key => ({
      key,
      isExhausted: false,
      exhaustedAt: null,
      errorCount: 0,
    }));

    console.log(`🔑 YouTube API Manager initialized with ${this.apiKeys.length} key(s)`);
  }

  /**
   * Get the current active API key
   */
  getCurrentKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error('No YouTube API keys available');
    }

    // Check if current key needs to be reset (24 hours passed)
    this.resetExpiredExhaustion();

    // Find first available (non-exhausted) key
    let attempts = 0;
    while (attempts < this.apiKeys.length) {
      const keyState = this.apiKeys[this.currentKeyIndex];
      
      if (!keyState.isExhausted) {
        return keyState.key;
      }

      // Move to next key
      this.rotateToNextKey();
      attempts++;
    }

    // All keys are exhausted, try to reset and use first key
    console.warn('⚠️ All YouTube API keys are exhausted! Attempting to use first key anyway...');
    this.currentKeyIndex = 0;
    return this.apiKeys[0].key;
  }

  /**
   * Rotate to the next available API key
   */
  private rotateToNextKey(): void {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
  }

  /**
   * Mark current key as exhausted and switch to next available key
   */
  markCurrentKeyExhausted(): boolean {
    if (this.apiKeys.length === 0) return false;

    const currentKey = this.apiKeys[this.currentKeyIndex];
    currentKey.isExhausted = true;
    currentKey.exhaustedAt = Date.now();
    currentKey.errorCount++;

    console.log(`🔄 API Key #${this.currentKeyIndex + 1} exhausted (403 error). Rotating to next key...`);

    // Find next available key
    const previousIndex = this.currentKeyIndex;
    this.rotateToNextKey();

    let attempts = 0;
    while (this.apiKeys[this.currentKeyIndex].isExhausted && attempts < this.apiKeys.length - 1) {
      this.rotateToNextKey();
      attempts++;
    }

    if (this.currentKeyIndex === previousIndex && this.apiKeys[this.currentKeyIndex].isExhausted) {
      console.error('❌ All API keys are exhausted!');
      return false;
    }

    console.log(`✅ Switched to API Key #${this.currentKeyIndex + 1}`);
    return true;
  }

  /**
   * Reset exhausted keys if 24 hours have passed
   */
  private resetExpiredExhaustion(): void {
    const now = Date.now();
    
    this.apiKeys.forEach((keyState, index) => {
      if (keyState.isExhausted && keyState.exhaustedAt) {
        if (now - keyState.exhaustedAt >= this.EXHAUSTION_RESET_TIME) {
          keyState.isExhausted = false;
          keyState.exhaustedAt = null;
          console.log(`🔄 API Key #${index + 1} has been reset (24 hours passed)`);
        }
      }
    });
  }

  /**
   * Get status of all API keys
   */
  getStatus(): { total: number; available: number; exhausted: number; currentIndex: number } {
    const exhaustedCount = this.apiKeys.filter(k => k.isExhausted).length;
    return {
      total: this.apiKeys.length,
      available: this.apiKeys.length - exhaustedCount,
      exhausted: exhaustedCount,
      currentIndex: this.currentKeyIndex + 1,
    };
  }

  /**
   * Make a YouTube API request with automatic key rotation on 403 errors
   */
  async makeRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const maxRetries = this.apiKeys.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const apiKey = this.getCurrentKey();
        const queryParams = new URLSearchParams({
          ...params,
          key: apiKey,
        });

        const url = `${YOUTUBE_API_BASE}/${endpoint}?${queryParams.toString()}`;
        const response = await fetch(url);

        if (response.ok) {
          return await response.json();
        }

        // Handle quota exceeded (403) error
        if (response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          const isQuotaError = errorData?.error?.errors?.some(
            (e: any) => e.reason === 'quotaExceeded' || e.reason === 'dailyLimitExceeded'
          ) || response.status === 403;

          if (isQuotaError) {
            console.warn(`⚠️ YouTube API quota exceeded for key #${this.currentKeyIndex + 1}`);
            const hasMoreKeys = this.markCurrentKeyExhausted();
            
            if (!hasMoreKeys) {
              throw new Error('All YouTube API keys have exceeded their quota');
            }
            
            // Continue to next iteration with new key
            continue;
          }
        }

        // For other errors, throw immediately
        throw new Error(`YouTube API error: ${response.status}`);

      } catch (error) {
        lastError = error as Error;
        
        // If it's a quota error and we have more keys, continue
        if (lastError.message.includes('quota') || lastError.message.includes('403')) {
          this.markCurrentKeyExhausted();
          continue;
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }

    throw lastError || new Error('YouTube API request failed after all retries');
  }
}

// Singleton instance
export const youtubeApiManager = new YouTubeApiKeyManager();

// Helper functions for common API calls
export async function getChannelDetails(channelId: string): Promise<any> {
  const data = await youtubeApiManager.makeRequest<any>('channels', {
    part: 'snippet,contentDetails,statistics',
    id: channelId,
  });
  return data.items?.[0] || null;
}

export async function getChannelByHandle(handle: string): Promise<any> {
  const data = await youtubeApiManager.makeRequest<any>('channels', {
    part: 'snippet,contentDetails,statistics',
    forHandle: handle,
  });
  return data.items?.[0] || null;
}

export async function getPlaylistItems(
  playlistId: string,
  maxResults: number = 50,
  pageToken?: string
): Promise<any> {
  const params: Record<string, string> = {
    part: 'snippet',
    playlistId,
    maxResults: String(Math.min(maxResults, 50)),
  };
  
  if (pageToken) {
    params.pageToken = pageToken;
  }

  return youtubeApiManager.makeRequest<any>('playlistItems', params);
}

export async function getVideoDetails(videoId: string): Promise<any> {
  const data = await youtubeApiManager.makeRequest<any>('videos', {
    part: 'snippet,contentDetails,statistics',
    id: videoId,
  });
  return data.items?.[0] || null;
}

export async function getVideosDetails(videoIds: string[]): Promise<any[]> {
  // YouTube API allows max 50 video IDs per request
  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const results: any[] = [];
  for (const chunk of chunks) {
    const data = await youtubeApiManager.makeRequest<any>('videos', {
      part: 'snippet,contentDetails,statistics',
      id: chunk.join(','),
    });
    if (data.items) {
      results.push(...data.items);
    }
  }

  return results;
}

export { YOUTUBE_API_BASE };
