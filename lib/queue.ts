import Queue from 'bull';

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

// Create scan queue
export const scanQueue = new Queue('channel-scan', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5 second delay
    },
    removeOnComplete: false, // Keep completed jobs for history
    removeOnFail: false, // Keep failed jobs for debugging
  },
});

// Job data interface
export interface ScanJobData {
  jobId: string;
  userId: string;
  channelId: string;
  channelName: string;
  firestoreDocId: string;
  videoCount: number;
  startDate?: string;
  endDate?: string;
  scanMode: 'count' | 'dateRange';
}

// Job result interface
export interface ScanJobResult {
  success: boolean;
  scannedVideos: number;
  videosWithLinks: number;
  statistics: {
    totalLinks: number;
    brokenLinks: number;
    warningLinks: number;
    workingLinks: number;
  };
  results: any[];
  scannedAt: string;
  error?: string;
}

console.log('📦 Bull Queue initialized with Redis:', redisConfig.host);
