import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const router = Router();

// Plan → price data mapping
const PLAN_PRICES: Record<string, Record<string, { unit_amount: number; interval: 'month' | 'year'; name: string }>> = {
  starter: {
    monthly: { unit_amount: 900,  interval: 'month', name: 'DraftRoom Starter (Monthly)' },
    yearly:  { unit_amount: 7900, interval: 'year',  name: 'DraftRoom Starter (Yearly)' },
  },
  pro: {
    monthly: { unit_amount: 2900,  interval: 'month', name: 'DraftRoom Pro (Monthly)' },
    yearly:  { unit_amount: 23900, interval: 'year',  name: 'DraftRoom Pro (Yearly)' },
  },
  studio: {
    monthly: { unit_amount: 7900,  interval: 'month', name: 'DraftRoom Studio (Monthly)' },
    yearly:  { unit_amount: 69900, interval: 'year',  name: 'DraftRoom Studio (Yearly)' },
  },
};

// POST /api/stripe/create-checkout-session
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  const { planKey, interval, userId, userEmail } = req.body as {
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
      metadata: {
        userId,
        planKey,
        interval,
      },
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?upgraded=${planKey}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/pricing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] create-checkout-session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/create-portal-session
// Redirects the user to Stripe's Customer Portal to manage billing, cancel, etc.
router.post('/create-portal-session', async (req: Request, res: Response) => {
  const { userId } = req.body as { userId: string };

  if (!userId) {
    res.status(400).json({ error: 'userId required' });
    return;
  }

  // Look up the Stripe customer ID from our database
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (!profile?.stripe_customer_id) {
    res.status(404).json({ error: 'No billing account found for this user' });
    return;
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      configuration: 'bpc_1TDqyVJ5qUBw52DMj4UF6tfm',
      return_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/pricing`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    console.error('[stripe] create-portal-session error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// POST /api/stripe/webhook
// Must use raw body — registered separately in index.ts
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error('[stripe] webhook signature error:', err);
    res.status(400).send('Webhook signature verification failed');
    return;
  }

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
    const { error } = await supabase
      .from('profiles')
      .update({ plan: 'free', stripe_subscription_id: null, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id);

    if (error) console.error('[stripe] failed to downgrade profile:', error);
    else console.log(`[stripe] downgraded subscription ${sub.id} to free`);
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    // When a user changes plan via the portal, update their plan in our DB.
    // The plan key is stored in the subscription's metadata if we set it on checkout.
    const planKey = sub.metadata?.planKey;
    if (planKey) {
      await supabase
        .from('profiles')
        .update({ plan: planKey, updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.id);
    }
  }

  res.json({ received: true });
});

export default router;
