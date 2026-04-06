/**
 * Stripe Webhook Handler
 *
 * POST /api/stripe-webhook
 *
 * Handles Stripe webhooks for payment events.
 * Credits are added to the user's account upon successful payment.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Stripe from 'stripe';
import {
  getContainer,
  CreditsDocument,
  CreditTransactionDocument,
  isCosmosConflict,
  isCosmosNotFound,
  getCreditPackage,
} from '../shared/cosmosClient';
import { requireAuth, ValidatedUser } from '../shared/validateToken';

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

function getTransactionId(sessionId: string): string {
  return `txn_${sessionId}`;
}

async function tryReservePurchaseTransaction(
  userId: string,
  credits: number,
  sessionId: string,
  paymentIntentId: string | null,
  amountPence: number,
  context: InvocationContext
): Promise<boolean> {
  const transactionsContainer = getContainer('credit_transactions');
  const transactionId = getTransactionId(sessionId);

  try {
    await transactionsContainer.items.create<CreditTransactionDocument>({
      id: transactionId,
      userId,
      type: 'purchase',
      credits,
      amountPence,
      stripeSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      createdAt: new Date().toISOString(),
    });
    context.log(`Reserved transaction ${transactionId} for user ${userId}`);
    return true;
  } catch (error) {
    if (isCosmosConflict(error)) {
      context.log(`Transaction ${transactionId} already exists for user ${userId}`);
      return false;
    }
    throw error;
  }
}

async function releaseReservedPurchaseTransaction(
  userId: string,
  sessionId: string,
  context: InvocationContext
): Promise<void> {
  const transactionsContainer = getContainer('credit_transactions');
  const transactionId = getTransactionId(sessionId);

  try {
    await transactionsContainer.item(transactionId, userId).delete();
    context.warn(`Rolled back transaction ${transactionId} for user ${userId}`);
  } catch (error) {
    if (!isCosmosNotFound(error)) {
      context.warn(`Failed to roll back transaction ${transactionId}:`, error);
    }
  }
}

async function addCreditsToUser(
  userId: string,
  credits: number,
  sessionId: string,
  paymentIntentId: string | null,
  amountPence: number,
  context: InvocationContext
): Promise<{ processed: boolean; alreadyProcessed: boolean }> {
  const creditsContainer = getContainer('credits');
  const now = new Date().toISOString();

  const transactionReserved = await tryReservePurchaseTransaction(
    userId,
    credits,
    sessionId,
    paymentIntentId,
    amountPence,
    context
  );

  if (!transactionReserved) {
    return {
      processed: false,
      alreadyProcessed: true,
    };
  }

  const createCreditsDocument = async () => {
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
  };

  const incrementExistingCreditsDocument = async () => {
    const { resource: updatedCredits } = await creditsContainer
      .item(userId, userId)
      .patch<CreditsDocument>([
        {
          op: 'incr',
          path: '/purchasedCredits',
          value: credits,
        },
        {
          op: 'incr',
          path: '/totalPurchased',
          value: credits,
        },
        {
          op: 'set',
          path: '/lastPurchaseAt',
          value: now,
        },
        {
          op: 'set',
          path: '/updatedAt',
          value: now,
        },
      ]);

    context.log(
      `Updated credits for user ${userId}: +${credits} (total: ${updatedCredits?.purchasedCredits ?? 'unknown'})`
    );
  };

  try {
    await incrementExistingCreditsDocument();
  } catch (error) {
    if (isCosmosNotFound(error)) {
      try {
        await createCreditsDocument();
      } catch (createError) {
        if (isCosmosConflict(createError)) {
          try {
            await incrementExistingCreditsDocument();
          } catch (patchError) {
            await releaseReservedPurchaseTransaction(userId, sessionId, context);
            throw patchError;
          }
          return {
            processed: true,
            alreadyProcessed: false,
          };
        }
        await releaseReservedPurchaseTransaction(userId, sessionId, context);
        throw createError;
      }
    } else {
      await releaseReservedPurchaseTransaction(userId, sessionId, context);
      throw error;
    }
  }

  return {
    processed: true,
    alreadyProcessed: false,
  };
}

function getCheckoutSessionPurchaseDetails(session: Stripe.Checkout.Session): {
  userId: string;
  credits: number;
  amountPence: number;
  paymentIntentId: string | null;
} {
  const userId = session.metadata?.userId?.trim() || '';
  const packageId = session.metadata?.packageId?.trim() || '';
  const creditsFromMetadata = session.metadata?.credits;

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

  const amountPence = session.amount_total || 0;
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || null;

  return {
    userId,
    credits,
    amountPence,
    paymentIntentId,
  };
}

async function processCheckoutSessionPurchase(
  session: Stripe.Checkout.Session,
  context: InvocationContext
): Promise<{ processed: boolean; alreadyProcessed: boolean }> {
  if (session.payment_status !== 'paid') {
    context.log(`Session ${session.id} not paid, skipping.`);
    return {
      processed: false,
      alreadyProcessed: false,
    };
  }

  const { userId, credits, amountPence, paymentIntentId } = getCheckoutSessionPurchaseDetails(session);

  if (!userId) {
    throw new Error('Missing userId in session metadata');
  }

  if (!credits || credits <= 0) {
    throw new Error('Invalid credits amount');
  }

  return addCreditsToUser(
    userId,
    credits,
    session.id,
    paymentIntentId,
    amountPence,
    context
  );
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

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      const result = await processCheckoutSessionPurchase(session, context);
      context.log(
        result.alreadyProcessed
          ? `Stripe session ${session.id} was already processed.`
          : `Stripe session ${session.id} processed successfully.`
      );
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

export async function confirmCheckoutSession(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Checkout session confirmation received.');

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  const authResult = await requireAuth(req);
  if ('status' in authResult) {
    return {
      status: authResult.status,
      body: authResult.body,
      headers,
    };
  }

  const user = authResult as ValidatedUser;

  try {
    const body = await req.json() as { sessionId?: string };
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';

    if (!sessionId) {
      return {
        status: 400,
        body: JSON.stringify({ error: 'sessionId is required' }),
        headers,
      };
    }

    // Validate session ID format - Stripe session IDs start with cs_ (or cs_test_ in test mode)
    if (!sessionId.startsWith('cs_')) {
      return {
        status: 400,
        body: JSON.stringify({ error: 'Invalid session ID format' }),
        headers,
      };
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionUserId = session.metadata?.userId?.trim() || '';

    if (!sessionUserId) {
      return {
        status: 400,
        body: JSON.stringify({ error: 'Missing userId in session metadata' }),
        headers,
      };
    }

    if (sessionUserId !== user.userId) {
      return {
        status: 403,
        body: JSON.stringify({ error: 'Checkout session does not belong to the authenticated user' }),
        headers,
      };
    }

    const result = await processCheckoutSessionPurchase(session, context);
    return {
      status: 200,
      body: JSON.stringify({
        success: true,
        processed: result.processed,
        alreadyProcessed: result.alreadyProcessed,
      }),
      headers,
    };
  } catch (error) {
    context.error('Failed to confirm checkout session:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Failed to confirm checkout session' }),
      headers,
    };
  }
}

app.http('stripe-webhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: stripeWebhook,
});

app.http('confirm-checkout-session', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: confirmCheckoutSession,
});
