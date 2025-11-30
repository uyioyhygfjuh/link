import { NextRequest, NextResponse } from 'next/server';
import { scanQueue, ScanJobData } from '@/lib/queue';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId, channelName, firestoreDocId, userId, videoCount, startDate, endDate, scanMode } = body;

    // Validation
    if (!channelId || !userId || !firestoreDocId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!videoCount || videoCount < 1 || videoCount > 10000) {
      return NextResponse.json(
        { error: 'Video count must be between 1 and 10,000' },
        { status: 400 }
      );
    }

    // Generate unique job ID
    const jobId = uuidv4();

    // Create job data
    const jobData: ScanJobData = {
      jobId,
      userId,
      channelId,
      channelName: channelName || 'Unknown Channel',
      firestoreDocId,
      videoCount,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      scanMode: scanMode || 'count',
    };

    // Create job document in Firestore for tracking
    await setDoc(doc(db, 'scanJobs', jobId), {
      jobId,
      userId,
      channelId,
      channelName: jobData.channelName,
      firestoreDocId,
      status: 'queued',
      progress: 0,
      videoCount,
      startDate: startDate || null,
      endDate: endDate || null,
      scanMode: scanMode || 'count',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      result: null,
      error: null,
    });

    // Add job to Bull queue
    const job = await scanQueue.add(jobData, {
      jobId: jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    console.log(`✅ Scan job created: ${jobId}`);
    console.log(`   Channel: ${jobData.channelName}`);
    console.log(`   Videos: ${videoCount}`);
    console.log(`   Mode: ${scanMode}`);

    return NextResponse.json({
      success: true,
      jobId: jobId,
      message: 'Scan job queued successfully. The scan will continue in the background.',
      status: 'queued',
    });

  } catch (error: any) {
    console.error('Error creating scan job:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create scan job',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
