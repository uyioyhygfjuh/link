import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get job status from Firestore
    const jobDoc = await getDoc(doc(db, 'scanJobs', jobId));

    if (!jobDoc.exists()) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const jobData = jobDoc.data();

    // Get progress from Firestore (real-time progress updated by worker)
    let progress = jobData.progress || 0;

    return NextResponse.json({
      jobId: jobData.jobId,
      status: jobData.status,
      progress: progress,
      channelName: jobData.channelName,
      videoCount: jobData.videoCount,
      createdAt: jobData.createdAt,
      startedAt: jobData.startedAt,
      completedAt: jobData.completedAt,
      failedAt: jobData.failedAt,
      result: jobData.result,
      error: jobData.error,
    });

  } catch (error: any) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch job status',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
