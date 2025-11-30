import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Default referral commission settings
const DEFAULT_SETTINGS = {
  referralCommission: {
    monthlyRate: 15, // 15%
    yearlyRate: 20,  // 20%
    minWithdrawal: 10, // $10 minimum
    pendingDays: 7,   // 7 days pending period
  },
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
};

// GET - Fetch settings
export async function GET(req: NextRequest) {
  try {
    const settingsRef = doc(db, "settings", "referral");
    const settingsDoc = await getDoc(settingsRef);

    if (!settingsDoc.exists()) {
      // Return default settings if not set
      return NextResponse.json({
        success: true,
        settings: DEFAULT_SETTINGS,
        isDefault: true,
      });
    }

    return NextResponse.json({
      success: true,
      settings: settingsDoc.data(),
      isDefault: false,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// POST - Update settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { monthlyRate, yearlyRate, minWithdrawal, pendingDays, adminId } = body;

    // Validate inputs
    if (monthlyRate === undefined || yearlyRate === undefined) {
      return NextResponse.json(
        { error: "Monthly and yearly rates are required" },
        { status: 400 }
      );
    }

    if (monthlyRate < 0 || monthlyRate > 100 || yearlyRate < 0 || yearlyRate > 100) {
      return NextResponse.json(
        { error: "Commission rates must be between 0 and 100" },
        { status: 400 }
      );
    }

    const settingsRef = doc(db, "settings", "referral");
    
    const updatedSettings = {
      referralCommission: {
        monthlyRate: Number(monthlyRate),
        yearlyRate: Number(yearlyRate),
        minWithdrawal: Number(minWithdrawal) || 10,
        pendingDays: Number(pendingDays) || 7,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: adminId || "admin",
    };

    await setDoc(settingsRef, updatedSettings, { merge: true });

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
