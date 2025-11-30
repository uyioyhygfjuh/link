import { NextRequest, NextResponse } from 'next/server';

// This hybrid API tries async first, falls back to sync if Redis unavailable
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Try to use async API first
    try {
      const asyncResponse = await fetch(`${request.nextUrl.origin}/api/scan-channel-async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (asyncResponse.ok) {
        const data = await asyncResponse.json();
        return NextResponse.json({
          ...data,
          mode: 'async',
          message: 'Scan queued successfully. Running in background.',
        });
      }
    } catch (asyncError) {
      console.log('Async API unavailable, falling back to sync scan...');
    }
    
    // Fallback to synchronous scan
    console.log('Using synchronous scan mode...');
    const syncResponse = await fetch(`${request.nextUrl.origin}/api/scan-channel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await syncResponse.json();
    
    if (!syncResponse.ok) {
      throw new Error(data.message || 'Scan failed');
    }
    
    return NextResponse.json({
      ...data,
      mode: 'sync',
      message: 'Scan completed successfully.',
    });
    
  } catch (error: any) {
    console.error('Hybrid scan error:', error);
    return NextResponse.json(
      { 
        error: 'Scan failed',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
