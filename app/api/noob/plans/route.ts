import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from "firebase/firestore";

// Plan visibility types
export type PlanVisibility = "all" | "referred" | "non-referred";

// Plan interface
export interface Plan {
  id: string;
  name: string;
  description: string;
  icon: string; // Icon name from lucide-react (e.g., "zap", "crown", "rocket")
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: number;
  popular: boolean;
  popularForReferred: boolean; // Different popular badge for referred users
  order: number;
  active: boolean;
  // Visibility settings
  visibility: PlanVisibility; // Who can see this plan
  referralDiscount: number; // Additional discount percentage for referred users
  referralBadge?: string; // Special badge text for referred users (e.g., "Referral Special")
  // Policy limits
  maxChannels: number | "unlimited";
  maxVideosPerScan: number | "unlimited";
  maxBulkVideosPerRun: number | "unlimited";
  maxScans: number | "unlimited";
  maxChannelExtracts: number | "unlimited";
  // Display features
  features: {
    channels: string;
    scans: string;
    extract: string;
    videos: string;
    bulkScan: string;
    support: string;
  };
  additionalFeatures: string[];
  limitations: string[];
  // Stripe
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Default plans to seed if none exist
const DEFAULT_PLANS: Omit<Plan, "createdAt" | "updatedAt">[] = [
  {
    id: "free",
    name: "Free Trial",
    description: "Perfect for trying out LinkGuard",
    icon: "zap",
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyDiscount: 0,
    popular: false,
    popularForReferred: false,
    order: 0,
    active: true,
    visibility: "all",
    referralDiscount: 0,
    referralBadge: "",
    maxChannels: 1,
    maxVideosPerScan: 50,
    maxBulkVideosPerRun: 10,
    maxScans: 2,
    maxChannelExtracts: 2,
    features: {
      channels: "1 Channel",
      scans: "2 Scans",
      extract: "2 Channel Extracts",
      videos: "50 Videos per scan",
      bulkScan: "2x Bulk Scan (10 videos each)",
      support: "Basic Email Support",
    },
    additionalFeatures: [
      "Link health monitoring",
      "Basic analytics",
      "CSV export",
    ],
    limitations: [
      "Limited scan history",
      "No API access",
      "Community support only",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    description: "Great for individual creators",
    icon: "youtube",
    monthlyPrice: 19,
    yearlyPrice: 182,
    yearlyDiscount: 20,
    popular: false,
    popularForReferred: false,
    order: 1,
    active: true,
    visibility: "all",
    referralDiscount: 10,
    referralBadge: "Referral Bonus",
    maxChannels: 2,
    maxVideosPerScan: 1000,
    maxBulkVideosPerRun: 1000,
    maxScans: "unlimited",
    maxChannelExtracts: 2,
    features: {
      channels: "2 Channels",
      scans: "Unlimited Scans",
      extract: "2 Channel Extracts",
      videos: "1000 Videos per scan",
      bulkScan: "10x Bulk Scan",
      support: "Priority Email Support",
    },
    additionalFeatures: [
      "Advanced link analytics",
      "Excel & PDF export",
      "Email notifications",
      "30-day scan history",
      "Weekly reports",
    ],
    limitations: ["No API access", "Limited bulk operations"],
    stripePriceIdMonthly: "price_basic_monthly",
    stripePriceIdYearly: "price_basic_yearly",
  },
  {
    id: "pro",
    name: "Pro",
    description: "Best for growing channels",
    icon: "crown",
    monthlyPrice: 29,
    yearlyPrice: 278,
    yearlyDiscount: 20,
    popular: true,
    popularForReferred: true,
    order: 2,
    active: true,
    visibility: "all",
    referralDiscount: 15,
    referralBadge: "Best Value",
    maxChannels: 5,
    maxVideosPerScan: 2000,
    maxBulkVideosPerRun: 2000,
    maxScans: "unlimited",
    maxChannelExtracts: 10,
    features: {
      channels: "5 Channels",
      scans: "Unlimited Scans",
      extract: "10 Channel Extracts",
      videos: "2000 Videos per scan",
      bulkScan: "Unlimited Bulk Scan",
      support: "Premium Support (24-48h)",
    },
    additionalFeatures: [
      "Everything in Basic",
      "Advanced filtering",
      "Custom scan schedules",
      "Automated monitoring",
      "90-day scan history",
      "Priority processing",
      "Team collaboration (up to 3 users)",
    ],
    limitations: [],
    stripePriceIdMonthly: "price_pro_monthly",
    stripePriceIdYearly: "price_pro_yearly",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For agencies and large teams",
    icon: "building2",
    monthlyPrice: 49,
    yearlyPrice: 470,
    yearlyDiscount: 20,
    popular: false,
    popularForReferred: false,
    order: 3,
    active: true,
    visibility: "all",
    referralDiscount: 20,
    referralBadge: "VIP Deal",
    maxChannels: "unlimited",
    maxVideosPerScan: "unlimited",
    maxBulkVideosPerRun: "unlimited",
    maxScans: "unlimited",
    maxChannelExtracts: "unlimited",
    features: {
      channels: "Unlimited Channels",
      scans: "Unlimited Scans",
      extract: "Unlimited Extracts",
      videos: "Unlimited Videos",
      bulkScan: "Unlimited Bulk Scan",
      support: "24/7 Premium Support + API Access",
    },
    additionalFeatures: [
      "Everything in Pro",
      "Full API access",
      "Custom integrations",
      "Dedicated account manager",
      "Unlimited scan history",
      "White-label options",
      "SLA guarantee",
      "Custom reporting",
      "Unlimited team members",
      "Advanced security features",
    ],
    limitations: [],
    stripePriceIdMonthly: "price_enterprise_monthly",
    stripePriceIdYearly: "price_enterprise_yearly",
  },
];

// GET /api/noob/plans - Get all plans
// Query params:
// - active=true: Only active plans
// - includeInactive=true: Include inactive plans (for admin)
// - isReferred=true/false: Filter by referral visibility
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const includeInactive = searchParams.get("includeInactive") === "true";
    const isReferredParam = searchParams.get("isReferred");
    const isReferred = isReferredParam === "true";
    const filterByReferral = isReferredParam !== null;

    const plansRef = collection(db, "plans");
    const q = query(plansRef, orderBy("order", "asc"));
    const snapshot = await getDocs(q);

    let plans: Plan[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Plan[];

    // If no plans exist, seed with defaults
    if (plans.length === 0) {
      const now = new Date().toISOString();
      for (const plan of DEFAULT_PLANS) {
        await setDoc(doc(db, "plans", plan.id), {
          ...plan,
          createdAt: now,
          updatedAt: now,
        });
      }
      // Fetch again
      const newSnapshot = await getDocs(q);
      plans = newSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Plan[];
    }

    // Filter by active status
    if (activeOnly) {
      plans = plans.filter((p) => p.active !== false);
    } else if (!includeInactive) {
      // Default: show active plans for public
      plans = plans.filter((p) => p.active !== false);
    }

    // Filter by referral visibility
    if (filterByReferral) {
      plans = plans.filter((p) => {
        // Normalize visibility - default to "all" if not set
        const visibility = p.visibility || "all";
        
        // "all" plans are visible to everyone
        if (visibility === "all") return true;
        
        // "referred" plans are ONLY visible to referred users
        if (visibility === "referred") {
          return isReferred === true;
        }
        
        // "non-referred" plans are ONLY visible to non-referred users
        if (visibility === "non-referred") {
          return isReferred === false;
        }
        
        // Default: show the plan
        return true;
      });
    }

    // Normalize plan data to ensure all required fields exist
    const normalizedPlans = plans.map((p) => ({
      ...p,
      icon: p.icon || "zap",
      visibility: p.visibility || "all",
      referralDiscount: p.referralDiscount || 0,
      referralBadge: p.referralBadge || "",
      popularForReferred: p.popularForReferred || false,
    }));

    return NextResponse.json({ plans: normalizedPlans, isReferred: filterByReferral ? isReferred : null });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

// POST /api/noob/plans - Create a new plan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan } = body;

    if (!plan || !plan.id || !plan.name) {
      return NextResponse.json(
        { error: "Plan ID and name are required" },
        { status: 400 }
      );
    }

    // Check if plan ID already exists
    const existingPlan = await getDoc(doc(db, "plans", plan.id));
    if (existingPlan.exists()) {
      return NextResponse.json(
        { error: "Plan with this ID already exists" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newPlan: Plan = {
      id: plan.id,
      name: plan.name,
      description: plan.description || "",
      icon: plan.icon || "zap",
      monthlyPrice: plan.monthlyPrice || 0,
      yearlyPrice: plan.yearlyPrice || 0,
      yearlyDiscount: plan.yearlyDiscount || 20,
      popular: plan.popular || false,
      popularForReferred: plan.popularForReferred || false,
      order: plan.order || 99,
      active: plan.active !== false,
      visibility: plan.visibility || "all",
      referralDiscount: plan.referralDiscount || 0,
      referralBadge: plan.referralBadge || "",
      maxChannels: plan.maxChannels || 1,
      maxVideosPerScan: plan.maxVideosPerScan || 50,
      maxBulkVideosPerRun: plan.maxBulkVideosPerRun || 10,
      maxScans: plan.maxScans || 2,
      maxChannelExtracts: plan.maxChannelExtracts || 2,
      features: plan.features || {
        channels: "1 Channel",
        scans: "2 Scans",
        extract: "2 Extracts",
        videos: "50 Videos",
        bulkScan: "10 Videos",
        support: "Email Support",
      },
      additionalFeatures: plan.additionalFeatures || [],
      limitations: plan.limitations || [],
      stripePriceIdMonthly: plan.stripePriceIdMonthly || "",
      stripePriceIdYearly: plan.stripePriceIdYearly || "",
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, "plans", plan.id), newPlan);

    return NextResponse.json({ success: true, plan: newPlan });
  } catch (error) {
    console.error("Error creating plan:", error);
    return NextResponse.json(
      { error: "Failed to create plan" },
      { status: 500 }
    );
  }
}

// PATCH /api/noob/plans - Update a plan
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, updates } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    const planRef = doc(db, "plans", planId);
    const planDoc = await getDoc(planRef);

    if (!planDoc.exists()) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Don't allow changing the plan ID
    const { id, createdAt, ...allowedUpdates } = updates;

    await updateDoc(planRef, {
      ...allowedUpdates,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Plan updated successfully",
    });
  } catch (error) {
    console.error("Error updating plan:", error);
    return NextResponse.json(
      { error: "Failed to update plan" },
      { status: 500 }
    );
  }
}

// DELETE /api/noob/plans - Delete a plan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Prevent deleting the free plan
    if (planId === "free") {
      return NextResponse.json(
        { error: "Cannot delete the free plan" },
        { status: 400 }
      );
    }

    const planRef = doc(db, "plans", planId);
    const planDoc = await getDoc(planRef);

    if (!planDoc.exists()) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    await deleteDoc(planRef);

    return NextResponse.json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return NextResponse.json(
      { error: "Failed to delete plan" },
      { status: 500 }
    );
  }
}
