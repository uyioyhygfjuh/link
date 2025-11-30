import { db } from './firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';

export type PlanId = 'free' | 'basic' | 'pro' | 'enterprise' | string;

export interface PlanPolicy {
  maxChannels: number | 'unlimited';
  maxVideosPerScan: number | 'unlimited';
  maxBulkVideosPerRun: number | 'unlimited';
  maxScans: number | 'unlimited';
  maxChannelExtracts?: number | 'unlimited';
}

export type PlanVisibility = 'all' | 'referred' | 'non-referred';

export interface PlanData {
  id: string;
  name: string;
  description: string;
  icon: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: number;
  popular: boolean;
  popularForReferred: boolean;
  order: number;
  active: boolean;
  visibility: PlanVisibility;
  referralDiscount: number;
  referralBadge?: string;
  maxChannels: number | 'unlimited';
  maxVideosPerScan: number | 'unlimited';
  maxBulkVideosPerRun: number | 'unlimited';
  maxScans: number | 'unlimited';
  maxChannelExtracts: number | 'unlimited';
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
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

// Default fallback policies (used if Firestore fetch fails)
const DEFAULT_PLAN_POLICIES: Record<string, PlanPolicy> = {
  free: {
    maxChannels: 1,
    maxVideosPerScan: 50,
    maxBulkVideosPerRun: 10,
    maxScans: 2,
    maxChannelExtracts: 2,
  },
  basic: {
    maxChannels: 2,
    maxVideosPerScan: 1000,
    maxBulkVideosPerRun: 1000,
    maxScans: 'unlimited',
    maxChannelExtracts: 2,
  },
  pro: {
    maxChannels: 5,
    maxVideosPerScan: 2000,
    maxBulkVideosPerRun: 2000,
    maxScans: 'unlimited',
    maxChannelExtracts: 10,
  },
  enterprise: {
    maxChannels: 'unlimited',
    maxVideosPerScan: 'unlimited',
    maxBulkVideosPerRun: 'unlimited',
    maxScans: 'unlimited',
    maxChannelExtracts: 'unlimited',
  },
};

const DEFAULT_PLAN_PRICES: Record<string, number> = {
  free: 0,
  basic: 19,
  pro: 29,
  enterprise: 49,
};

// Cache for plans data
let plansCache: PlanData[] | null = null;
let plansCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch all plans from Firestore
export const fetchPlansFromFirestore = async (): Promise<PlanData[]> => {
  // Check cache
  if (plansCache && Date.now() - plansCacheTime < CACHE_TTL) {
    return plansCache;
  }

  try {
    const plansRef = collection(db, 'plans');
    const q = query(plansRef, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      // Return empty array - API will seed defaults
      return [];
    }

    const plans = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PlanData[];

    // Update cache
    plansCache = plans.filter(p => p.active !== false);
    plansCacheTime = Date.now();

    return plansCache;
  } catch (error) {
    console.error('Error fetching plans from Firestore:', error);
    return [];
  }
};

// Clear plans cache (call after admin updates)
export const clearPlansCache = () => {
  plansCache = null;
  plansCacheTime = 0;
};

// Get plan policy from Firestore or fallback
export const getPlanPolicyFromFirestore = async (planId: string): Promise<PlanPolicy> => {
  try {
    const plans = await fetchPlansFromFirestore();
    const plan = plans.find(p => p.id === planId);
    
    if (plan) {
      return {
        maxChannels: plan.maxChannels,
        maxVideosPerScan: plan.maxVideosPerScan,
        maxBulkVideosPerRun: plan.maxBulkVideosPerRun,
        maxScans: plan.maxScans,
        maxChannelExtracts: plan.maxChannelExtracts,
      };
    }
  } catch (error) {
    console.error('Error getting plan policy:', error);
  }

  // Fallback to defaults
  return DEFAULT_PLAN_POLICIES[planId] || DEFAULT_PLAN_POLICIES.free;
};

// Get plan price from Firestore or fallback
export const getPlanPriceFromFirestore = async (planId: string, yearly: boolean = false): Promise<number> => {
  try {
    const plans = await fetchPlansFromFirestore();
    const plan = plans.find(p => p.id === planId);
    
    if (plan) {
      return yearly ? plan.yearlyPrice : plan.monthlyPrice;
    }
  } catch (error) {
    console.error('Error getting plan price:', error);
  }

  // Fallback to defaults
  const monthlyPrice = DEFAULT_PLAN_PRICES[planId] || 0;
  return yearly ? Math.floor(monthlyPrice * 12 * 0.8) : monthlyPrice;
};

// Get full plan details from Firestore
export interface PlanDetails {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxChannels: number | 'unlimited';
  maxVideosPerScan: number | 'unlimited';
  maxBulkVideosPerRun: number | 'unlimited';
  maxScans: number | 'unlimited';
  maxChannelExtracts: number | 'unlimited';
  features: {
    channels: string;
    scans: string;
    extract: string;
    videos: string;
    bulkScan: string;
    support: string;
  };
}

export const getPlanDetailsFromFirestore = async (planId: string): Promise<PlanDetails | null> => {
  try {
    if (!planId || planId === 'free') {
      return {
        id: 'free',
        name: 'Free Trial',
        monthlyPrice: 0,
        yearlyPrice: 0,
        maxChannels: 1,
        maxVideosPerScan: 50,
        maxBulkVideosPerRun: 10,
        maxScans: 2,
        maxChannelExtracts: 2,
        features: {
          channels: '1 Channel',
          scans: '2 Scans',
          extract: '2 Extracts',
          videos: '50 Videos per scan',
          bulkScan: '10 Videos',
          support: 'Basic Support',
        },
      };
    }

    const plans = await fetchPlansFromFirestore();
    const plan = plans.find(p => p.id === planId);
    
    if (plan) {
      return {
        id: plan.id,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        maxChannels: plan.maxChannels,
        maxVideosPerScan: plan.maxVideosPerScan,
        maxBulkVideosPerRun: plan.maxBulkVideosPerRun,
        maxScans: plan.maxScans,
        maxChannelExtracts: plan.maxChannelExtracts,
        features: plan.features,
      };
    }
  } catch (error) {
    console.error('Error getting plan details:', error);
  }

  // Return null if plan not found
  return null;
};

// Legacy exports for backward compatibility
export const PLAN_POLICIES = DEFAULT_PLAN_POLICIES;
export const PLAN_PRICES = DEFAULT_PLAN_PRICES;

export const getYearlyPrice = (monthly: number, discount: number = 20): number => {
  return Math.floor(monthly * 12 * (1 - discount / 100));
};

export const getEffectivePlanId = (userData: any): PlanId => {
  try {
    const now = Date.now();
    const trialEnd = userData?.trialEnd ? Date.parse(userData.trialEnd) : 0;
    
    // If user is in trial period, return free
    if (userData?.planStatus === 'Trial' && trialEnd && now <= trialEnd) return 'free';
    
    // Return the actual planId from user data if it exists and is not empty
    const planId = (userData?.planId || '').toLowerCase().trim();
    if (planId && planId !== 'free') {
      return planId;
    }
    
    // Fallback: try to derive plan ID from plan name
    const name = String(userData?.plan || '').toLowerCase();
    if (name && name !== 'free trial' && name !== 'free') {
      // Convert plan name to ID format (e.g., "Professional Plan" -> "professional")
      const derivedId = name.replace(/\s+plan$/i, '').replace(/\s+/g, '-').toLowerCase();
      if (derivedId) return derivedId;
    }
    
    return 'free';
  } catch {
    return 'free';
  }
};

export const getPolicy = (planId: PlanId): PlanPolicy => {
  // Return policy if it exists in defaults, otherwise return free policy as fallback
  return PLAN_POLICIES[planId] || PLAN_POLICIES.free;
};

export const applyPlanIfTrialEnded = async (userId: string): Promise<PlanId> => {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return 'free';
  const data = snap.data() as any;
  const now = Date.now();
  const trialEnd = data?.trialEnd ? Date.parse(data.trialEnd) : 0;
  const inTrial = data?.planStatus === 'Trial' && trialEnd && now <= trialEnd;
  if (inTrial) return 'free';
  const pending: PlanId | undefined = (data?.pendingPlanId || '').toLowerCase();
  if (pending && (pending === 'basic' || pending === 'pro' || pending === 'enterprise')) {
    const period = (data?.subscriptionPeriod === 'yearly') ? 'yearly' : 'monthly';
    // verify successful payment exists for this intent
    try {
      const paymentsCol = collection(db, 'payments');
      const snap = await getDocs(query(
        paymentsCol,
        where('userId', '==', userId),
        where('status', '==', 'succeeded'),
        where('planId', '==', pending),
        where('cycle', '==', period),
      ));
      const hasPaid = !snap.empty && snap.docs.some(d => (d.data() as any)?.flagged !== true);
      if (!hasPaid) {
        return getEffectivePlanId(data);
      }
    } catch {}
    const renewalMs = period === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const renewalDate = new Date(Date.now() + renewalMs).toISOString();
    await updateDoc(userRef, {
      plan: pending === 'basic' ? 'Basic' : pending === 'pro' ? 'Pro' : 'Enterprise',
      planId: pending,
      planStatus: 'Active',
      renewalDate,
      pendingPlanId: null,
    });
    return pending;
  }
  return getEffectivePlanId(data);
};

export const capByPolicy = (value: number, limit: number | 'unlimited'): number => {
  if (limit === 'unlimited') return value;
  return Math.min(value, limit);
};
