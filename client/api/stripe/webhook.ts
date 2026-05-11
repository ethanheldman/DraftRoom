// Vercel serverless function for Stripe webhook events.
// Requires bodyParser disabled so the raw body can be used for signature
// verification.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: 'Server env vars not configured' });
    return;
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const sig = req.headers['stripe-signature'] as string;
  const rawBody = await readRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe] webhook signature error:', err);
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, planKey } = session.metadata ?? {};
      if (userId && planKey) {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            user_id: userId,
            plan: planKey,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            updated_at: new Date().toISOString(),
          });
        if (error) {
          console.error('[stripe] failed to update profile:', error);
          res.status(500).send('DB update failed');
          return;
        }
        console.log(`[stripe] upgraded user ${userId} to ${planKey}`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from('profiles')
        .update({
          plan: 'free',
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', sub.id);
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const planKey = sub.metadata?.planKey;
      if (planKey) {
        await supabase
          .from('profiles')
          .update({ plan: planKey, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[stripe] webhook handler error:', err);
    res.status(500).send('Webhook handler failed');
  }
}
