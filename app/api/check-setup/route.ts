import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const status = {
    timestamp: new Date().toISOString(),
    checks: {
      nextjs: true,
      youtube_api: false,
      redis: false,
      worker: false,
      firestore: false,
    },
    messages: [] as string[],
  };

  // Check YouTube API
  if (process.env.NEXT_PUBLIC_YOUTUBE_API_KEY) {
    status.checks.youtube_api = true;
    status.messages.push('✅ YouTube API key configured');
  } else {
    status.messages.push('❌ YouTube API key missing');
  }

  // Check Redis connection
  try {
    const Queue = require('bull');
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    };
    const testQueue = new Queue('test', { redis: redisConfig });
    await testQueue.client.ping();
    status.checks.redis = true;
    status.messages.push('✅ Redis is running and connected');
    await testQueue.close();
  } catch (error: any) {
    status.messages.push('❌ Redis not available');
    status.messages.push('ℹ️  Scans will run in synchronous mode (browser must stay open)');
  }

  // Check Firestore
  try {
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      status.checks.firestore = true;
      status.messages.push('✅ Firestore configured');
    } else {
      status.messages.push('❌ Firestore not configured');
    }
  } catch (error) {
    status.messages.push('❌ Firestore not configured');
  }

  return NextResponse.json(status);
}
