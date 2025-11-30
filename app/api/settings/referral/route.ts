import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// Default referral commission settings
const DEFAULT_SETTINGS = {
  monthlyRate: 15, // 15%
  yearlyRate: 20,  // 20%
  minWithdrawal: 10, // $10 minimum
  pendingDays: 7,   // 7 days pending period
};

// GET - Fetch referral commission settings (public endpoint for users)
export async function GET(req: NextRequest) {
  try {
    const settingsRef = doc(db, "settings", "referral");
    const settingsDoc = await getDoc(settingsRef);

    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return NextResponse.json({
        success: true,
        settings: {
          monthlyRate: data.referralCommission?.monthlyRate ?? DEFAULT_SETTINGS.monthlyRate,
          yearlyRate: data.referralCommission?.yearlyRate ?? DEFAULT_SETTINGS.yearlyRate,
          minWithdrawal: data.referralCommission?.minWithdrawal ?? DEFAULT_SETTINGS.minWithdrawal,
          pendingDays: data.referralCommission?.pendingDays ?? DEFAULT_SETTINGS.pendingDays,
        },
      });
    }

    // Return default settings if not configured
    return NextResponse.json({
      success: true,
      settings: DEFAULT_SETTINGS,
    });
  } catch (error) {
    console.error("Error fetching referral settings:", error);
    // Return defaults on error to ensure UI always has values
    return NextResponse.json({
      success: true,
      settings: DEFAULT_SETTINGS,
    });
  }
}
