"use client";

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import Header from '@/components/Header';
import { Shield, ArrowRight, CreditCard } from 'lucide-react';

function PaymentContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateway, setGateway] = useState<'lemon'|'razorpay'>('lemon');
  const planId = params.get('planId') || 'free';  // Accept any plan ID from Firestore
  const cycle = (params.get('cycle') || 'monthly') as 'monthly'|'yearly';
  const [planDetails, setPlanDetails] = useState<{ name: string; monthlyPrice: number; yearlyPrice: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending'|'succeeded'|'failed'|null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        router.push('/login?redirect=/payment');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  // Fetch plan details from Firestore
  useEffect(() => {
    const fetchPlanDetails = async () => {
      if (!planId || planId === 'free') {
        setPlanDetails({ name: 'Free', monthlyPrice: 0, yearlyPrice: 0 });
        return;
      }
      try {
        const planDoc = await getDoc(doc(db, 'plans', planId));
        if (planDoc.exists()) {
          const data = planDoc.data();
          setPlanDetails({
            name: data.name || planId,
            monthlyPrice: data.monthlyPrice || 0,
            yearlyPrice: data.yearlyPrice || 0
          });
        } else {
          // Fallback: try to find by name
          setPlanDetails({ name: planId.charAt(0).toUpperCase() + planId.slice(1), monthlyPrice: 0, yearlyPrice: 0 });
        }
      } catch (error) {
        console.error('Error fetching plan details:', error);
        setPlanDetails({ name: planId, monthlyPrice: 0, yearlyPrice: 0 });
      }
    };
    fetchPlanDetails();
  }, [planId]);

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

  const startLemon = async () => {
    if (!user) return;
    setPaying(true); setError('');
    try {
      const res = await fetch('/api/payments/lemon/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, planId, cycle, email: user.email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      setPaymentId(data.paymentId);
      setPaymentStatus('pending');
      window.open(data.url, '_blank');
    } catch (e: any) {
      setError(e.message || 'Checkout failed');
    } finally {
      setPaying(false);
    }
  };

  const ensureRazorpayScript = async () => {
    return new Promise<void>((resolve, reject) => {
      if (typeof window !== 'undefined' && (window as any).Razorpay) return resolve();
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(s);
    });
  };

  const startRazorpay = async () => {
    if (!user) return;
    setPaying(true); setError('');
    try {
      await ensureRazorpayScript();
      const res = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, planId, cycle, currency: 'INR' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');
      setPaymentId(data.paymentId);
      setPaymentStatus('pending');
      const options: any = {
        key: data.keyId,
        amount: data.amountMinor,
        currency: data.currency,
        name: 'LinkGuard',
        description: `${planId} – ${cycle}`,
        order_id: data.orderId,
        prefill: { name: user.displayName || '', email: user.email || '' },
        notes: { planId, cycle, paymentId: data.paymentId, token: data.token },
        theme: { color: '#1d4ed8' },
      };
      const rz = new (window as any).Razorpay(options);
      rz.on('payment.failed', (resp: any) => {
        setError(resp.error?.description || 'Payment failed');
      });
      rz.open();
    } catch (e: any) {
      setError(e.message || 'Checkout failed');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-primary-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading payment…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={() => router.push('/')} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Secure Payment</h1>
        <p className="text-gray-600 mb-6">Select your preferred gateway to complete the upgrade.</p>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600">Plan</p>
              <p className="text-lg font-semibold text-gray-900">
                {planDetails?.name || planId} – {cycle === 'yearly' ? 'Yearly' : 'Monthly'}
                {planDetails && planDetails.monthlyPrice > 0 && (
                  <span className="text-primary-600 ml-2">
                    ${cycle === 'yearly' ? planDetails.yearlyPrice : planDetails.monthlyPrice}
                  </span>
                )}
              </p>
            </div>
            <CreditCard className="w-8 h-8 text-primary-600" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">Payment Gateway</div>
              <select
                value={gateway}
                onChange={(e) => setGateway(e.target.value as any)}
                className="text-sm border rounded px-3 py-2"
              >
                <option value="lemon">Lemon Squeezy</option>
                <option value="razorpay">Razorpay</option>
              </select>
            </div>
            <button
              onClick={() => (gateway === 'lemon' ? startLemon() : startRazorpay())}
              disabled={paying}
              className="w-full py-3 px-4 rounded-lg font-semibold bg-primary-600 text-white hover:bg-primary-700"
            >
              {paying ? 'Processing…' : 'Continue to Payment'}
            </button>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {paymentStatus && (
              <div className={`text-sm ${paymentStatus === 'succeeded' ? 'text-green-700' : paymentStatus === 'failed' ? 'text-red-700' : 'text-yellow-700'}`}>
                {paymentStatus === 'succeeded' ? 'Payment successful' : paymentStatus === 'failed' ? 'Payment failed' : 'Payment pending'}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => router.push('/pricing')} className="text-primary-600 hover:underline inline-flex items-center">
            <ArrowRight className="w-4 h-4 mr-1 rotate-180" /> Back to Pricing
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}
