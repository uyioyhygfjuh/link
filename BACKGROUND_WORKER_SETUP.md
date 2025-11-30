# Background Worker Setup Guide

## Overview
LinkGuard now uses a background job queue system to process channel scans asynchronously. This allows scans to continue even if the user closes their browser or turns off their PC.

## Architecture

```
User Browser → Next.js API → Bull Queue → Redis → Background Worker
                                                         ↓
                                                   Firestore (Results)
```

## Prerequisites

### 1. Install Redis
Redis is required for the Bull queue system.

**Windows:**
- Download Redis from: https://github.com/microsoftarchive/redis/releases
- Or use WSL2 with Redis: `sudo apt-get install redis-server`
- Or use Docker: `docker run -d -p 6379:6379 redis`

**Mac:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

### 2. Configure Environment Variables
Add to your `.env.local` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Existing variables...
NEXT_PUBLIC_YOUTUBE_API_KEY=your_key_here
```

## Installation

1. **Install Dependencies** (Already done):
```bash
npm install bull ioredis @types/bull uuid @types/uuid
```

2. **Start Redis Server**:
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

3. **Start the Background Worker**:
```bash
# In a separate terminal window
node worker.js
```

4. **Start Next.js Dev Server**:
```bash
npm run dev
```

## How It Works

### 1. User Initiates Scan
- User clicks "Start Scan" on a channel
- Frontend calls `/api/scan-channel-async`
- API creates a job in Bull queue
- Job document created in Firestore (`scanJobs` collection)
- User receives Job ID immediately

### 2. Background Processing
- Worker process picks up the job from queue
- Performs 3-step scan:
  1. Collect videos from YouTube
  2. Extract links from descriptions
  3. Check all links
- Updates progress in Firestore (0-100%)
- Can retry failed jobs automatically (up to 3 attempts)

### 3. Status Tracking
- Frontend polls `/api/scan-status?jobId=xxx` every 3 seconds
- Shows real-time progress
- Notifies user when complete
- Results stored in Firestore

### 4. Results
- Scan results saved to `channels` collection
- Detailed video/link data in `scanResults` field
- User can view in Channel Report page

## File Structure

```
linkguard/
├── lib/
│   ├── queue.ts              # Bull queue configuration
│   └── scanWorker.ts         # Background worker logic
├── app/api/
│   ├── scan-channel-async/   # Queue scan job
│   │   └── route.ts
│   └── scan-status/          # Check job status
│       └── route.ts
├── worker.js                 # Worker entry point
└── BACKGROUND_WORKER_SETUP.md
```

## Firestore Collections

### `scanJobs` Collection
Tracks all scan jobs:
```javascript
{
  jobId: "uuid",
  userId: "user123",
  channelId: "UCxxx",
  channelName: "Channel Name",
  status: "queued|processing|completed|failed",
  progress: 0-100,
  videoCount: 50,
  scanMode: "count|dateRange",
  createdAt: "ISO timestamp",
  startedAt: "ISO timestamp",
  completedAt: "ISO timestamp",
  result: { /* scan results */ },
  error: "error message if failed"
}
```

### `channels` Collection
Updated with scan results:
```javascript
{
  // ... existing fields
  lastScanResults: {
    scannedVideos: 50,
    videosWithLinks: 38,
    totalLinks: 156,
    brokenLinks: 24,
    warningLinks: 32,
    workingLinks: 100,
    scannedAt: "ISO timestamp"
  },
  scanResults: [
    {
      videoId: "abc123",
      videoTitle: "Video Title",
      videoUrl: "https://youtube.com/watch?v=abc123",
      links: [
        { url: "https://example.com", status: "working", statusCode: 200 }
      ]
    }
  ]
}
```

## Running in Production

### Option 1: PM2 (Recommended)
```bash
npm install -g pm2

# Start worker
pm2 start worker.js --name linkguard-worker

# View logs
pm2 logs linkguard-worker

# Restart
pm2 restart linkguard-worker

# Stop
pm2 stop linkguard-worker
```

### Option 2: Docker
Create `Dockerfile.worker`:
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "worker.js"]
```

Run:
```bash
docker build -f Dockerfile.worker -t linkguard-worker .
docker run -d --name worker linkguard-worker
```

### Option 3: Systemd Service (Linux)
Create `/etc/systemd/system/linkguard-worker.service`:
```ini
[Unit]
Description=LinkGuard Background Worker
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/linkguard
ExecStart=/usr/bin/node worker.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable linkguard-worker
sudo systemctl start linkguard-worker
```

## Monitoring

### Check Queue Status
```bash
# Redis CLI
redis-cli

# View all keys
KEYS *

# Check queue length
LLEN bull:channel-scan:wait

# View job data
GET bull:channel-scan:job-id
```

### View Worker Logs
```bash
# If using PM2
pm2 logs linkguard-worker

# If using systemd
journalctl -u linkguard-worker -f

# If running directly
# Check terminal output
```

## Troubleshooting

### Worker Not Processing Jobs
1. Check Redis is running: `redis-cli ping`
2. Check worker is running: `ps aux | grep worker`
3. Check worker logs for errors
4. Verify environment variables are set

### Jobs Stuck in Queue
1. Check worker logs for errors
2. Restart worker: `pm2 restart linkguard-worker`
3. Clear failed jobs: `redis-cli FLUSHDB` (⚠️ deletes all data)

### Slow Processing
1. Increase worker concurrency in `queue.ts`
2. Add more worker instances
3. Optimize link checking timeout

## Benefits

✅ **Resilient**: Scans continue even if browser closes
✅ **Scalable**: Can run multiple workers
✅ **Reliable**: Automatic retries on failure
✅ **Trackable**: Real-time progress updates
✅ **Persistent**: Results saved to database
✅ **User-Friendly**: No need to keep browser open

## Next Steps

1. Start Redis server
2. Start worker: `node worker.js`
3. Start dev server: `npm run dev`
4. Test by scanning a channel
5. Monitor worker logs
6. Check Firestore for results

## Support

For issues or questions:
- Check worker logs
- Verify Redis connection
- Check Firestore permissions
- Review API responses
