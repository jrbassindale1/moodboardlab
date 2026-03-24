/**
 * Stripe Webhook Handler
 *
 * POST /api/stripe-webhook
 *
 * Handles Stripe webhooks for payment events.
 * Credits are added to the user's account upon successful payment.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  getContainer,
  CreditsDocument,
  CreditTransactionDocument,
  isCosmosNotFound,
  getCreditPackage,
} from '../shared/cosmosClient';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });
}

async function addCreditsToUser(
  userId: string,
  credits: number,
  sessionId: string,
  paymentIntentId: string | null,
  amountPence: number,
  context: InvocationContext
): Promise<void> {
  const creditsContainer = getContainer('credits');
  const transactionsContainer = getContainer('credit_transactions');
  const now = new Date().toISOString();

  // Create or update the credits document
  try {
    const { resource: existingCredits } = await creditsContainer
      .item(userId, userId)
      .read<CreditsDocument>();

    if (existingCredits) {
      // Update existing credits
      await creditsContainer.item(userId, userId).replace<CreditsDocument>({
        ...existingCredits,
        purchasedCredits: existingCredits.purchasedCredits + credits,
        totalPurchased: existingCredits.totalPurchased + credits,
        lastPurchaseAt: now,
        updatedAt: now,
      });
      context.log(`Updated credits for user ${userId}: +${credits} (total: ${existingCredits.purchasedCredits + credits})`);
    }
  } catch (error) {
    if (isCosmosNotFound(error)) {
      // Create new credits document
      await creditsContainer.items.create<CreditsDocument>({
        id: userId,
        userId,
        purchasedCredits: credits,
        totalPurchased: credits,
        lastPurchaseAt: now,
        createdAt: now,
        updatedAt: now,
      });
      context.log(`Created credits for user ${userId}: ${credits}`);
    } else {
      throw error;
    }
  }

  // Record the transaction
  const transactionId = `txn_${sessionId}`;
  try {
    await transactionsContainer.items.create<CreditTransactionDocument>({
      id: transactionId,
      userId,
      type: 'purchase',
      credits,
      amountPence,
      stripeSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      createdAt: now,
    });
    context.log(`Recorded transaction ${transactionId} for user ${userId}`);
  } catch (error) {
    // Transaction might already exist (idempotency)
    context.warn(`Transaction ${transactionId} may already exist:`, error);
  }
}

export async function stripeWebhook(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Stripe webhook received.');

  if (!STRIPE_WEBHOOK_SECRET) {
    context.error('STRIPE_WEBHOOK_SECRET not configured');
    return {
      status: 500,
      body: JSON.stringify({ error: 'Webhook not configured' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const stripe = getStripe();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'Missing stripe-signature header' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    context.error('Webhook signature verification failed:', message);
    return {
      status: 400,
      body: JSON.stringify({ error: `Webhook Error: ${message}` }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  context.log(`Received Stripe event: ${event.type}`);

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Ensure payment was successful
    if (session.payment_status !== 'paid') {
      context.log(`Session ${session.id} not paid, skipping.`);
      return {
        status: 200,
        body: JSON.stringify({ received: true, processed: false }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const userId = session.metadata?.userId;
    const packageId = session.metadata?.packageId;
    const creditsFromMetadata = session.metadata?.credits;

    if (!userId) {
      context.error('No userId in session metadata');
      return {
        status: 400,
        body: JSON.stringify({ error: 'Missing userId in metadata' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Get credits from package or metadata
    let credits = 0;
    if (packageId) {
      const pkg = getCreditPackage(packageId);
      if (pkg) {
        credits = pkg.credits;
      }
    }
    if (!credits && creditsFromMetadata) {
      credits = parseInt(creditsFromMetadata, 10);
    }

    if (!credits || credits <= 0) {
      context.error('Could not determine credits from session');
      return {
        status: 400,
        body: JSON.stringify({ error: 'Invalid credits amount' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const amountPence = session.amount_total || 0;
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;

    try {
      await addCreditsToUser(
        userId,
        credits,
        session.id,
        paymentIntentId,
        amountPence,
        context
      );

      context.log(`Successfully added ${credits} credits to user ${userId}`);
    } catch (error) {
      context.error('Failed to add credits:', error);
      return {
        status: 500,
        body: JSON.stringify({ error: 'Failed to process payment' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }
  }

  return {
    status: 200,
    body: JSON.stringify({ received: true }),
    headers: { 'Content-Type': 'application/json' },
  };
}

app.http('stripe-webhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: stripeWebhook,
});
