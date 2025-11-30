'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { applyPlanIfTrialEnded, getYearlyPrice } from '@/lib/plans';
import { logOut } from '@/lib/auth';
import Link from 'next/link';
import Header from '@/components/Header';
import { 
  Shield, 
  Check,
  X,
  Zap,
  Crown,
  Rocket,
  Building2,
  ArrowRight,
  Star,
  Youtube,
  Video,
  FileText,
  Headphones,
  Loader2,
  Sparkles,
  Gem,
  Award,
  Target,
  Flame,
  Briefcase,
  Globe,
  Heart,
  Users,
  Gift,
  CreditCard,
  type LucideIcon
} from 'lucide-react';

// Available icons mapping (must match admin page)
const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  youtube: Youtube,
  crown: Crown,
  building2: Building2,
  rocket: Rocket,
  shield: Shield,
  sparkles: Sparkles,
  gem: Gem,
  award: Award,
  target: Target,
  flame: Flame,
  star: Star,
  briefcase: Briefcase,
  globe: Globe,
  heart: Heart,
  users: Users,
  gift: Gift,
  "credit-card": CreditCard,
};

// Helper to get icon component by name
const getIconByName = (iconName: string): LucideIcon => {
  return ICON_MAP[iconName] || Zap;
};

interface PricingPlan {
  id: string;
  name: string;
  icon: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: number;
  description: string;
  popular: boolean;
  popularForReferred: boolean;
  visibility: "all" | "referred" | "non-referred";
  referralDiscount: number;
  referralBadge?: string;
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

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currentPlanId, setCurrentPlanId] = useState<string>('free');
  const [planStatus, setPlanStatus] = useState<'Active' | 'Trial'>('Active');
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending'|'succeeded'|'failed'|null>(null);
  const [isReferred, setIsReferred] = useState<boolean>(false);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  // Fetch plans based on referral status
  const fetchPlans = async (userIsReferred: boolean) => {
    try {
      setPlansLoading(true);
      const response = await fetch(`/api/noob/plans?active=true&isReferred=${userIsReferred}`);
      const data = await response.json();
      if (data.plans) {
        // API already filters by visibility, just set the plans
        // visibility='all' plans are shown to everyone
        // visibility='referred' plans are only shown to referred users
        // visibility='non-referred' plans are only shown to non-referred users
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      let wasReferred = false;
      
      if (currentUser) {
        try {
          const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
          const userData = userSnap.exists() ? (userSnap.data() as any) : {};
          const effective = await applyPlanIfTrialEnded(currentUser.uid);
          setCurrentPlanId(effective);
          const now = Date.now();
          const trialEndMs = userData?.trialEnd ? Date.parse(userData.trialEnd) : 0;
          const inTrial = userData?.planStatus === 'Trial' && trialEndMs && now <= trialEndMs;
          setPlanStatus(inTrial ? 'Trial' : (userData?.planStatus || 'Active'));
          
          // Check if user was referred - check users collection first, then referrals collection as fallback
          let userReferredBy = userData?.referredBy || null;
          
          // Fallback: Check referrals collection for existing users who signed up before the fix
          if (!userReferredBy) {
            try {
              const referralSnap = await getDoc(doc(db, 'referrals', currentUser.uid));
              if (referralSnap.exists()) {
                const referralData = referralSnap.data();
                // referredBy in referrals collection stores the referrer's user ID, not the code
                // But if it exists, it means this user was referred
                if (referralData?.referredBy) {
                  userReferredBy = referralData.referredBy;
                  // Update users collection for future lookups
                  await updateDoc(doc(db, 'users', currentUser.uid), { referredBy: userReferredBy });
                }
              }
            } catch (e) {
              console.error('Error checking referrals collection:', e);
            }
          }
          
          wasReferred = !!userReferredBy;
          setIsReferred(wasReferred);
          setReferredBy(userReferredBy);
          
          let pending = userData?.pendingPlanId || null;
          const cycle = userData?.subscriptionPeriod === 'yearly' ? 'yearly' : 'monthly';
          if (pending) {
            try {
              const paymentsCol = collection(db, 'payments');
              const snapPay = await getDocs(query(
                paymentsCol,
                where('userId', '==', currentUser.uid),
                where('status', '==', 'succeeded'),
                where('planId', '==', pending),
                where('cycle', '==', cycle)
              ));
              const hasPaid = !snapPay.empty && snapPay.docs.some(d => (d.data() as any)?.flagged !== true);
              if (!hasPaid) {
                await updateDoc(doc(db, 'users', currentUser.uid), { pendingPlanId: null });
                pending = null;
              }
            } catch {}
          }
          setPendingPlanId(pending);
        } catch {}
      }
      
      // Fetch plans based on referral status (after we know the user's status)
      await fetchPlans(wasReferred);
      setAuthChecked(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await logOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSelectPlan = async (plan: PricingPlan) => {
    if (!user) {
      router.push('/login?redirect=/pricing');
      return;
    }

    if (plan.id === currentPlanId) {
      alert('This is your current plan.');
      return;
    }
    if (pendingPlanId && plan.id === pendingPlanId) {
      alert('This plan is already selected and will be applied after your current period ends.');
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        updatedAt: new Date().toISOString()
      });
      router.push(`/payment?planId=${plan.id}&cycle=${billingCycle}`);
    } catch (err: any) {
      console.error('Failed to proceed to payment:', err);
      alert('Failed to proceed to payment. Please try again.');
    }

    // Example Stripe redirect (to be implemented):
    // const response = await fetch('/api/create-checkout-session', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     priceId: plan.stripePriceId,
    //     userId: user.uid
    //   })
    // });
    // const { url } = await response.json();
    // window.location.href = url;
  };

  // Payment handled on dedicated page

  useEffect(() => {
    if (!paymentId) return;
    const ref = doc(db, 'payments', paymentId);
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.data() as any;
      if (!d) return;
      setPaymentStatus(d.status);
    });
    return () => unsub();
  }, [paymentId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50">
      {/* Unified Header */}
      {user ? (
        <Header user={user} onLogout={handleLogout} />
      ) : (
        <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="flex items-center space-x-2">
                <Shield className="w-8 h-8 text-primary-600" />
                <span className="text-xl font-bold text-gray-900">LinkGuard</span>
              </Link>
              
              <div className="flex items-center space-x-3">
                <Link
                  href="/login"
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Sign Up
                </Link>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        {/* Payment status banner removed; handled on payment page */}
        <div className="inline-flex items-center space-x-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <Star className="w-4 h-4" />
          <span>Simple, transparent pricing</span>
        </div>
        
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Choose Your Perfect Plan
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Start with our free trial and upgrade as you grow. All plans include our core link monitoring features.
        </p>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center space-x-4 mb-12">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              billingCycle === 'yearly' ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
            Yearly
          </span>
          {billingCycle === 'yearly' && (
            <span className="inline-flex items-center bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
              Save 20%
            </span>
          )}
        </div>
      </div>

      {/* Loading State */}
      {plansLoading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 flex justify-center">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading plans...</p>
          </div>
        </div>
      )}

      {/* Referral Banner */}
      {isReferred && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-white flex items-center justify-center space-x-3">
            <Star className="w-5 h-5" />
            <span className="font-medium">You're eligible for exclusive referral discounts on all plans!</span>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      {!plansLoading && (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const Icon = getIconByName(plan.icon || 'zap');
            
            // Calculate prices with referral discount
            const referralDiscountMultiplier = isReferred && plan.referralDiscount > 0 
              ? (1 - plan.referralDiscount / 100) 
              : 1;
            
            const basePrice = billingCycle === 'yearly' && plan.monthlyPrice > 0 
              ? plan.yearlyPrice 
              : plan.monthlyPrice;
            
            const displayPrice = Math.round(basePrice * referralDiscountMultiplier);
            const originalPrice = basePrice;
            const hasReferralDiscount = isReferred && plan.referralDiscount > 0 && plan.monthlyPrice > 0;
            
            const displayPeriod = billingCycle === 'yearly' && plan.monthlyPrice > 0 ? 'year' : 'month';
            const isCurrent = plan.id === currentPlanId;
            const isPending = pendingPlanId === plan.id;
            
            // Use popularForReferred for referred users
            const isPopular = isReferred ? plan.popularForReferred : plan.popular;
            
            const buttonLabel = isCurrent
              ? 'Current Plan'
              : isPending
              ? 'Selected'
              : plan.id === 'free'
              ? 'Get Started'
              : 'Upgrade Now';
            const buttonDisabled = isCurrent || isPending;

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border-2 transition-all hover:shadow-2xl ${
                  isPopular
                    ? 'border-primary-500 shadow-xl scale-105'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg flex items-center space-x-1">
                      <Star className="w-4 h-4 fill-current" />
                      <span>Most Popular</span>
                    </div>
                  </div>
                )}

                {/* Referral Badge */}
                {hasReferralDiscount && plan.referralBadge && (
                  <div className="absolute -top-4 right-4">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                      {plan.referralBadge}
                    </div>
                  </div>
                )}

                {(isCurrent || isPending) && (
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      isCurrent ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {isCurrent ? 'Active Plan' : 'Selected'}
                    </span>
                  </div>
                )}

                <div className="p-6">
                  {/* Plan Header */}
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`p-2 rounded-lg ${isPopular ? 'bg-primary-100' : 'bg-gray-100'}`}>
                      <Icon className={`w-6 h-6 ${isPopular ? 'text-primary-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-6">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline">
                      {hasReferralDiscount && (
                        <span className="text-lg text-gray-400 line-through mr-2">${originalPrice}</span>
                      )}
                      <span className={`text-4xl font-bold ${hasReferralDiscount ? 'text-purple-600' : 'text-gray-900'}`}>
                        ${displayPrice}
                      </span>
                      <span className="text-gray-600 ml-2">/{displayPeriod}</span>
                    </div>
                    {billingCycle === 'yearly' && plan.monthlyPrice > 0 && !hasReferralDiscount && (
                      <p className="text-sm text-green-600 mt-1">
                        ${plan.monthlyPrice}/mo billed yearly ({plan.yearlyDiscount}% off)
                      </p>
                    )}
                    {hasReferralDiscount && (
                      <p className="text-sm text-purple-600 mt-1 font-medium">
                        🎉 {plan.referralDiscount}% referral discount applied!
                      </p>
                    )}
                  </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => {
                        if (buttonDisabled) return;
                      handleSelectPlan(plan);
                      }}
                      disabled={buttonDisabled}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${
                        buttonDisabled
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : isPopular
                            ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl'
                            : hasReferralDiscount
                              ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg hover:shadow-xl'
                              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      <span>{buttonLabel}</span>
                      {!buttonDisabled && <ArrowRight className="w-4 h-4" />}
                    </button>

                    {/* Payment controls removed; users proceed on the dedicated payment page */}

                  {/* Features */}
                  <div className="mt-8 space-y-4">
                    <div className="border-t border-gray-200 pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4">Core Features</h4>
                      <ul className="space-y-3">
                        <li className="flex items-start space-x-3">
                          <Youtube className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{plan.features.channels}</span>
                        </li>
                        <li className="flex items-start space-x-3">
                          <Shield className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{plan.features.scans}</span>
                        </li>
                        <li className="flex items-start space-x-3">
                          <FileText className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{plan.features.extract}</span>
                        </li>
                        <li className="flex items-start space-x-3">
                          <Video className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{plan.features.videos}</span>
                        </li>
                        <li className="flex items-start space-x-3">
                          <Zap className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{plan.features.bulkScan}</span>
                        </li>
                        <li className="flex items-start space-x-3">
                          <Headphones className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{plan.features.support}</span>
                        </li>
                      </ul>
                    </div>

                    {/* Additional Features */}
                    {plan.additionalFeatures.length > 0 && (
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">Additional Features</h4>
                        <ul className="space-y-2">
                          {plan.additionalFeatures.map((feature, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-gray-600">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Limitations */}
                    {plan.limitations.length > 0 && (
                      <div className="border-t border-gray-200 pt-4">
                        <ul className="space-y-2">
                          {plan.limitations.map((limitation, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <X className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-gray-500">{limitation}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Detailed Plan Comparison
          </h2>
          
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Feature</th>
                    {plans.map((plan) => (
                      <th key={plan.id} className={`px-6 py-4 text-center text-sm font-semibold ${
                        plan.popular ? 'bg-primary-50 text-primary-900' : 'text-gray-900'
                      }`}>
                        {plan.name}
                        {plan.popular && (
                          <div className="text-xs font-normal text-primary-600 mt-1">Recommended</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Channels</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className={`px-6 py-4 text-center text-sm ${
                        plan.popular ? 'bg-primary-50/30' : ''
                      }`}>
                        {plan.features.channels}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Scans</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className={`px-6 py-4 text-center text-sm ${
                        plan.popular ? 'bg-primary-50/30' : ''
                      }`}>
                        {plan.features.scans}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Channel Extract</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className={`px-6 py-4 text-center text-sm ${
                        plan.popular ? 'bg-primary-50/30' : ''
                      }`}>
                        {plan.features.extract}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Videos per Scan</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className={`px-6 py-4 text-center text-sm ${
                        plan.popular ? 'bg-primary-50/30' : ''
                      }`}>
                        {plan.features.videos}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Bulk Scan</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className={`px-6 py-4 text-center text-sm ${
                        plan.popular ? 'bg-primary-50/30' : ''
                      }`}>
                        {plan.features.bulkScan}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Support</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className={`px-6 py-4 text-center text-sm ${
                        plan.popular ? 'bg-primary-50/30' : ''
                      }`}>
                        {plan.features.support}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-24 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-600 mb-12 max-w-2xl mx-auto">
            Have questions? We're here to help. Contact our support team for more information.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Can I change plans later?</h3>
              <p className="text-sm text-gray-600">Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
              <p className="text-sm text-gray-600">We accept all major credit cards through Stripe's secure payment processing.</p>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Is there a free trial?</h3>
              <p className="text-sm text-gray-600">Yes! Our Free Trial plan is available forever with limited features. No credit card required.</p>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-gray-600">Absolutely. Cancel your subscription anytime from your account settings. No questions asked.</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-primary-100 mb-8 max-w-2xl mx-auto">
            Join thousands of content creators who trust LinkGuard to monitor their YouTube links.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Link
              href="/signup"
              className="px-8 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="px-8 py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-400 transition-colors border-2 border-white"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
