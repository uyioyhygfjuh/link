# YouTube API Key Rotation System

This document explains how to configure multiple YouTube API keys for automatic rotation when quota limits are reached.

## Overview

The YouTube API has daily quota limits (typically 10,000 units). When scanning large channels with thousands of videos, you may hit these limits. This system automatically rotates between multiple API keys to ensure continuous operation.

## How It Works

1. **Primary Key First**: The system always tries to use the first available API key
2. **Automatic Detection**: When a 403 error occurs (quota exceeded), the system automatically switches to the next key
3. **Round-Robin Rotation**: Keys are rotated in order, cycling back to the first when reaching the end
4. **24-Hour Reset**: Exhausted keys are automatically reset after 24 hours (when YouTube resets quotas)

## Configuration

### Option 1: Multiple Keys (Recommended)

Add multiple API keys in your `.env.local` file, separated by commas:

```env
YOUTUBE_API_KEYS=AIzaSyKey1,AIzaSyKey2,AIzaSyKey3,AIzaSyKey4
```

### Option 2: Single Key (Backward Compatible)

If you only have one API key, you can use the existing format:

```env
NEXT_PUBLIC_YOUTUBE_API_KEY=AIzaSyYourSingleKey
```

The system will automatically fall back to this if `YOUTUBE_API_KEYS` is not set.

## Getting Multiple API Keys

### From Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create multiple projects (e.g., "LinkGuard-1", "LinkGuard-2", etc.)
3. Enable the **YouTube Data API v3** for each project
4. Create an API key for each project
5. Add all keys to your `YOUTUBE_API_KEYS` environment variable

### Quota Per Key

Each YouTube API key has:
- **10,000 units per day** (default)
- Video list request: ~1 unit per request
- Video details request: ~1 unit per video
- Channel details request: ~1 unit

With 5,000 videos to scan, you'll use approximately:
- ~100 units for listing videos (50 per page)
- ~5,000 units for video details

### Recommended Number of Keys

| Videos to Scan | Recommended Keys |
|----------------|------------------|
| < 5,000        | 1-2 keys         |
| 5,000-15,000   | 2-3 keys         |
| 15,000-50,000  | 4-6 keys         |
| 50,000+        | 6-10 keys        |

## Monitoring Key Usage

The system logs key rotation events:

```
🔑 YouTube API Manager initialized with 4 key(s)
⚠️ YouTube API quota exceeded for key #1
🔄 API Key #1 exhausted (403 error). Rotating to next key...
✅ Switched to API Key #2
```

Check your server logs to monitor key rotation.

## API Manager Status

You can check the status of all keys programmatically:

```typescript
import { youtubeApiManager } from '@/lib/youtube-api-manager';

const status = youtubeApiManager.getStatus();
console.log(status);
// { total: 4, available: 3, exhausted: 1, currentIndex: 2 }
```

## Troubleshooting

### All Keys Exhausted

If all keys are exhausted:
1. Wait for the 24-hour quota reset
2. Add more API keys
3. Reduce the number of videos scanned per day

### 403 Errors Continue

If you're still getting 403 errors:
1. Verify all API keys are valid
2. Check that YouTube Data API is enabled for all projects
3. Ensure no IP restrictions are set on the keys

### Keys Not Rotating

Check that:
1. Keys are properly comma-separated without spaces
2. All keys are valid and active
3. YouTube Data API v3 is enabled for each key's project

## Files Modified

The following files use the YouTube API Manager:

- `lib/youtube-api-manager.ts` - Core API key manager
- `lib/youtube.ts` - YouTube helper functions
- `lib/scanWorker.ts` - Background scan worker
- `app/api/scan-channel/route.ts` - Channel scanning API
- `app/api/get-scan-results/route.ts` - Scan results API
