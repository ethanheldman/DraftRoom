// Vercel serverless function for Stripe billing portal sessions.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: 'Server env vars not configured' });
    return;
  }

  const { userId } = (req.body ?? {}) as { userId: string };
  if (!userId) {
    res.status(400).json({ error: 'userId required' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (!profile?.stripe_customer_id) {
    res.status(404).json({ error: 'No billing account found for this user' });
    return;
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
  const origin =
    process.env.CLIENT_URL ||
    (req.headers.origin as string | undefined) ||
    'https://draft-room-wine.vercel.app';

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/pricing`,
    });
    res.json({ url: portalSession.url });
  } catch (err) {
    console.error('[stripe] create-portal-session error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
}
