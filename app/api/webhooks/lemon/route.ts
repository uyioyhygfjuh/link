import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, updateDoc, where, doc } from 'firebase/firestore';

const webhookSecret = process.env.LEMON_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const signature = req.headers.get('x-signature') || '';
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    const digest = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
    if (digest !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
    const event = JSON.parse(raw);
    const type = event?.meta?.event_name || '';
    const data = event?.data || {};
    const order = data?.order || data;
    const status = order?.status || 'paid';
    const amount = order?.total || order?.subtotal || undefined;
    const currency = order?.currency || 'USD';
    const metadata = order?.first_order_item?.product_id ? order?.first_order_item : (order?.attributes || {});
    const metaCustom = (metadata?.custom ? metadata?.custom?.metadata : undefined) || metadata?.metadata || {};
    const userId = metaCustom?.userId;
    const paymentIdMeta = metaCustom?.paymentId as string | undefined;
    const tokenMeta = metaCustom?.token as string | undefined;
    const signingSecret = process.env.PAYMENT_SIGNING_SECRET || '';
    const verifyToken = (pid?: string, tok?: string) => {
      if (!signingSecret || !pid || !tok) return false;
      const digest = crypto.createHmac('sha256', signingSecret).update(pid).digest('hex');
      return digest === tok;
    };

    if (userId) {
      const paymentsCol = collection(db, 'payments');
      const q = paymentIdMeta
        ? query(paymentsCol, where('id', '==', paymentIdMeta))
        : query(paymentsCol, where('userId', '==', userId), where('gateway', '==', 'lemon'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        try {
          const flagged = !verifyToken(paymentIdMeta || docSnap.id, tokenMeta);
          await updateDoc(docSnap.ref, {
            status: (status === 'paid' || type.includes('subscription_payment_success')) ? 'succeeded' : status,
            amount: amount ?? undefined,
            currency,
            providerPaymentId: order?.id || order?.order_id,
            receiptUrl: order?.invoice_url || order?.urls?.invoice_url || undefined,
            updatedAt: new Date().toISOString(),
            flagged,
          } as any);
          const dataDoc = docSnap.data() as any;
          if (!flagged && dataDoc?.userId && dataDoc?.planId && dataDoc?.cycle && (status === 'paid')) {
            const renewalMs = dataDoc.cycle === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
            const renewalDate = new Date(Date.now() + renewalMs).toISOString();
            const userRef = doc(db, 'users', dataDoc.userId);
            await updateDoc(userRef, {
              plan: dataDoc.planId === 'basic' ? 'Basic' : dataDoc.planId === 'pro' ? 'Pro' : 'Enterprise',
              planId: dataDoc.planId,
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
