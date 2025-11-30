import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';

const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    const digest = crypto
      .createHmac('sha256', webhookSecret)
      .update(raw)
      .digest('hex');
    if (digest !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(raw);
    const type = event.event as string;
    const payload = event.payload || {};
    const paymentEntity = payload?.payment?.entity || payload?.order?.entity || {};
    const orderId = paymentEntity.order_id || payload?.order?.entity?.id;
    const status = paymentEntity.status || 'created';
    const paymentId = paymentEntity.id || '';
    const amount = paymentEntity.amount ? paymentEntity.amount / 100 : undefined;
    const currency = paymentEntity.currency || 'INR';
    const notes = payload?.order?.entity?.notes || {};
    const notePaymentId = notes?.paymentId as string | undefined;
    const noteToken = notes?.token as string | undefined;
    const signingSecret = process.env.PAYMENT_SIGNING_SECRET || '';

    const verifyToken = (pid?: string, tok?: string) => {
      if (!signingSecret || !pid || !tok) return false;
      const digest = crypto.createHmac('sha256', signingSecret).update(pid).digest('hex');
      return digest === tok;
    };

    if (orderId) {
      const paymentsCol = collection(db, 'payments');
      const q = query(paymentsCol, where('orderId', '==', orderId));
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        try {
          const flagged = !verifyToken(notePaymentId, noteToken);
          await updateDoc(docSnap.ref, {
            status: status === 'captured' || type.includes('payment.authorized') || type.includes('payment.captured') ? 'succeeded' : status,
            providerPaymentId: paymentId,
            amount: amount ?? undefined,
            currency,
            receipt: payload?.order?.entity?.receipt || undefined,
            updatedAt: new Date().toISOString(),
            flagged,
          } as any);
          const data = docSnap.data() as any;
          if (!flagged && data?.userId && data?.planId && data?.cycle && (status === 'captured' || type.includes('payment.captured'))) {
            const renewalMs = data.cycle === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
            const renewalDate = new Date(Date.now() + renewalMs).toISOString();
            const userRef = doc(db, 'users', data.userId);
            await updateDoc(userRef, {
              plan: data.planId === 'basic' ? 'Basic' : data.planId === 'pro' ? 'Pro' : 'Enterprise',
              planId: data.planId,
              planStatus: 'Active',
              renewalDate,
            } as any);
          }
        } catch {}
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Webhook handling failed' }, { status: 500 });
  }
}
