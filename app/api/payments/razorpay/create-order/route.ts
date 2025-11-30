import { NextResponse } from 'next/server';
import { createPaymentRecord, convertFromUSD } from '@/lib/payments';
import { getPlanPriceFromFirestore } from '@/lib/plans';

const keyId = process.env.RAZORPAY_KEY_ID || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, planId, cycle, currency = 'INR' } = body as { 
      userId: string; 
      planId: string;  // Accept any plan ID
      cycle: 'monthly'|'yearly'; 
      currency?: 'INR'|'USD'|'EUR' 
    };
    
    if (!userId || !planId || !cycle) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay keys not configured' }, { status: 500 });
    }
    if (planId === 'free') {
      return NextResponse.json({ error: 'Free plan does not require checkout' }, { status: 400 });
    }

    // Fetch plan price from Firestore
    const usd = await getPlanPriceFromFirestore(planId, cycle === 'yearly');
    if (usd <= 0) {
      return NextResponse.json({ error: 'Invalid plan price' }, { status: 400 });
    }
    
    const amountCurrency = convertFromUSD(usd, currency as any);
    const amountMinor = Math.round(amountCurrency * 100); // paise for INR, cents for USD/EUR

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency,
        receipt: `rcpt_${userId}_${Date.now()}`,
        notes: { planId, cycle },
        payment_capture: 1,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: 'Failed to create order', details: text }, { status: res.status });
    }
    const data = await res.json();
    const { id: orderId } = data;
    const { paymentId, token } = await createPaymentRecord(userId, 'razorpay', currency as any, amountCurrency, { planId, cycle, orderId });
    return NextResponse.json({ orderId, amountMinor, currency, keyId, paymentId, token });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Order creation failed' }, { status: 500 });
  }
}
