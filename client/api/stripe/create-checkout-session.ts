// Vercel serverless function for Stripe checkout.
//
// Ported from /screenwriter/server/src/routes/stripe.ts — the Express server
// is never deployed alongside the Vercel-hosted client, so /api/stripe/*
// requests were swallowed by the SPA's catch-all rewrite in production.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const PLAN_PRICES: Record<
  string,
  Record<string, { unit_amount: number; interval: 'month' | 'year'; name: string }>
> = {
  starter: {
    monthly: { unit_amount: 900, interval: 'month', name: 'DraftRoom Starter (Monthly)' },
    yearly: { unit_amount: 7900, interval: 'year', name: 'DraftRoom Starter (Yearly)' },
  },
  pro: {
    monthly: { unit_amount: 2900, interval: 'month', name: 'DraftRoom Pro (Monthly)' },
    yearly: { unit_amount: 23900, interval: 'year', name: 'DraftRoom Pro (Yearly)' },
  },
  studio: {
    monthly: { unit_amount: 7900, interval: 'month', name: 'DraftRoom Studio (Monthly)' },
    yearly: { unit_amount: 69900, interval: 'year', name: 'DraftRoom Studio (Yearly)' },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured on server' });
    return;
  }

  const { planKey, interval, userId, userEmail } = (req.body ?? {}) as {
    planKey: string;
    interval: 'monthly' | 'yearly';
    userId: string;
    userEmail: string;
  };

  const priceData = PLAN_PRICES[planKey]?.[interval];
  if (!priceData) {
    res.status(400).json({ error: 'Invalid plan or interval' });
    return;
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
  const origin =
    process.env.CLIENT_URL ||
    (req.headers.origin as string | undefined) ||
    'https://draft-room-wine.vercel.app';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: userEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: priceData.name },
            unit_amount: priceData.unit_amount,
            recurring: { interval: priceData.interval },
          },
          quantity: 1,
        },
      ],
      metadata: { userId, planKey, interval },
      success_url: `${origin}/dashboard?upgraded=${planKey}`,
      cancel_url: `${origin}/pricing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] create-checkout-session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
