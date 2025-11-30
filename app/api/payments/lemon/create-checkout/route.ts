import { NextResponse } from 'next/server';
import { getLemonVariantId, getLemonCheckoutUrl, createPaymentRecord, convertFromUSD } from '@/lib/payments';
import { getPlanPriceFromFirestore } from '@/lib/plans';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, planId, cycle, email, currency = 'USD' } = body as { 
      userId: string; 
      planId: string;  // Accept any plan ID
      cycle: 'monthly'|'yearly'; 
      email?: string; 
      currency?: 'USD'|'INR'|'EUR' 
    };
    
    if (!userId || !planId || !cycle) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    if (planId === 'free') {
      return NextResponse.json({ error: 'Free plan does not require checkout' }, { status: 400 });
    }
    
    // Get variant ID for payment gateway
    const variantId = getLemonVariantId(planId, cycle);
    if (!variantId) {
      return NextResponse.json({ error: 'Lemon Squeezy variant not configured for this plan' }, { status: 500 });
    }
    
    // Fetch plan price from Firestore
    const usd = await getPlanPriceFromFirestore(planId, cycle === 'yearly');
    if (usd <= 0) {
      return NextResponse.json({ error: 'Invalid plan price' }, { status: 400 });
    }
    
    const amount = convertFromUSD(usd, currency);
    const { paymentId, token } = await createPaymentRecord(userId, 'lemon', currency, amount, { planId, cycle });
    const url = getLemonCheckoutUrl(variantId, userId, paymentId, token, email);
    return NextResponse.json({ url, paymentId });
  } catch (err: any) {
    console.error('Lemon checkout error:', err);
    return NextResponse.json({ error: err?.message || 'Checkout initialization failed' }, { status: 500 });
  }
}
