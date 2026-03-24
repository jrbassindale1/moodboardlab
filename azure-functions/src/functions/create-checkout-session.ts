/**
 * Create Checkout Session Function
 *
 * POST /api/create-checkout-session
 *
 * Creates a Stripe checkout session for purchasing credits.
 * Requires authentication.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, ValidatedUser } from '../shared/validateToken';
import { getCreditPackage, CREDIT_PACKAGES } from '../shared/cosmosClient';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://moodboardlab.com';

function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });
}

export async function createCheckoutSession(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Create checkout session function processed a request.');

  // Require authentication
  const authResult = await requireAuth(req);
  if ('status' in authResult) {
    return {
      status: authResult.status,
      body: authResult.body,
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const user = authResult as ValidatedUser;

  try {
    const body = await req.json() as { packageId?: string };
    const { packageId } = body;

    if (!packageId) {
      return {
        status: 400,
        body: JSON.stringify({ error: 'packageId is required' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const creditPackage = getCreditPackage(packageId);
    if (!creditPackage) {
      return {
        status: 400,
        body: JSON.stringify({
          error: 'Invalid package',
          availablePackages: CREDIT_PACKAGES.map(p => p.id),
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const stripe = getStripe();

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `${creditPackage.name} Credit Pack`,
              description: `${creditPackage.credits} generation credits for Moodboard Lab`,
              metadata: {
                packageId: creditPackage.id,
                credits: String(creditPackage.credits),
              },
            },
            unit_amount: creditPackage.pricePence,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${FRONTEND_URL}?credits_purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}?credits_cancelled=true`,
      customer_email: user.email || undefined,
      metadata: {
        userId: user.userId,
        packageId: creditPackage.id,
        credits: String(creditPackage.credits),
      },
    });

    return {
      status: 200,
      body: JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    context.error('Error creating checkout session:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Failed to create checkout session' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

app.http('create-checkout-session', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: createCheckoutSession,
});
