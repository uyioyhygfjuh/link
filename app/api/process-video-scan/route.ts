import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { videoId, sessionId, userId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    // Process video scan logic here
    // This is a placeholder - implement actual video scanning logic as needed
    
    console.log(`Processing video scan for: ${videoId}`);
    
    // Update session status if sessionId provided
    if (sessionId) {
      try {
        const sessionRef = doc(db, "scanSessions", sessionId);
        const sessionDoc = await getDoc(sessionRef);
        
        if (sessionDoc.exists()) {
          await updateDoc(sessionRef, {
            status: "processing",
            lastUpdated: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Error updating session:", error);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Video scan processing started",
      videoId,
      sessionId,
    });
  } catch (error: any) {
    console.error("Error processing video scan:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process video scan" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");
  const sessionId = searchParams.get("sessionId");

  if (!videoId && !sessionId) {
    return NextResponse.json(
      { error: "Video ID or Session ID is required" },
      { status: 400 }
    );
  }

  try {
    // Return scan status
    if (sessionId) {
      const sessionRef = doc(db, "scanSessions", sessionId);
      const sessionDoc = await getDoc(sessionRef);
      
      if (sessionDoc.exists()) {
        return NextResponse.json({
          success: true,
          session: {
            id: sessionDoc.id,
            ...sessionDoc.data(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      status: "unknown",
      message: "Scan status not found",
    });
  } catch (error: any) {
    console.error("Error getting scan status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get scan status" },
      { status: 500 }
    );
  }
}
