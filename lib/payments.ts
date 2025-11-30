import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export type Currency = 'USD' | 'INR' | 'EUR';
export type Gateway = 'lemon' | 'razorpay';

export const PAYMENT_TEST_MODE = (process.env.NEXT_PUBLIC_PAYMENT_TEST_MODE === 'true');
const SIGNING_SECRET = process.env.PAYMENT_SIGNING_SECRET || '';

export const CURRENCY_RATES: Record<Currency, number> = {
  USD: 1,
  INR: 83,
  EUR: 0.92,
};

export const convertFromUSD = (amountUsd: number, currency: Currency): number => {
  const rate = CURRENCY_RATES[currency] || 1;
  return Math.round(amountUsd * rate * 100) / 100;
};

export const getLemonVariantId = (planId: string, cycle: 'monthly'|'yearly'): string | null => {
  const mapEnv = (key: string) => process.env[key] || '';
  
  // Predefined variant mappings for common plans
  const keys: Record<string, string> = {
    'basic_monthly': 'LEMON_VARIANT_BASIC_MONTHLY',
    'basic_yearly': 'LEMON_VARIANT_BASIC_YEARLY',
    'pro_monthly': 'LEMON_VARIANT_PRO_MONTHLY',
    'pro_yearly': 'LEMON_VARIANT_PRO_YEARLY',
    'enterprise_monthly': 'LEMON_VARIANT_ENTERPRISE_MONTHLY',
    'enterprise_yearly': 'LEMON_VARIANT_ENTERPRISE_YEARLY',
    'starter_monthly': 'LEMON_VARIANT_STARTER_MONTHLY',
    'starter_yearly': 'LEMON_VARIANT_STARTER_YEARLY',
    'professional_monthly': 'LEMON_VARIANT_PROFESSIONAL_MONTHLY',
    'professional_yearly': 'LEMON_VARIANT_PROFESSIONAL_YEARLY',
  };
  
  if (planId === 'free') return null;
  
  const key = `${planId.toLowerCase()}_${cycle}`;
  const envKey = keys[key];
  
  // First try predefined mapping
  if (envKey) {
    const val = mapEnv(envKey);
    if (val) return val;
  }
  
  // Then try dynamic env key (LEMON_VARIANT_{PLANID}_{CYCLE})
  const dynamicEnvKey = `LEMON_VARIANT_${planId.toUpperCase()}_${cycle.toUpperCase()}`;
  const dynamicVal = mapEnv(dynamicEnvKey);
  if (dynamicVal) return dynamicVal;
  
  // Return null if no variant configured
  return null;
};

export const getLemonCheckoutUrl = (variantId: string, userId: string, paymentId: string, token: string, email?: string): string => {
  const embed = '1';
  const storeUrl = 'https://app.lemonsqueezy.com/checkout/buy';
  const testFlag = PAYMENT_TEST_MODE ? '&test=1' : '';
  const metadata = encodeURIComponent(JSON.stringify({ userId, paymentId, token }));
  const emailParam = email ? `&checkout[email]=${encodeURIComponent(email)}` : '';
  return `${storeUrl}/${variantId}?embed=${embed}&checkout[custom][metadata]=${metadata}${emailParam}${testFlag}`;
};

export const createPaymentRecord = async (userId: string, gateway: Gateway, currency: Currency, amount: number, data: Record<string, any> = {}) => {
  const paymentId = uuidv4();
  const ref = doc(db, 'payments', paymentId);
  const token = SIGNING_SECRET ? crypto.createHmac('sha256', SIGNING_SECRET).update(paymentId).digest('hex') : '';
  const payload = {
    id: paymentId,
    userId,
    gateway,
    currency,
    amount,
    status: 'pending',
    createdAt: new Date().toISOString(),
    token,
    ...data,
  };
  await setDoc(ref, payload);
  return { paymentId, token, payload };
};
