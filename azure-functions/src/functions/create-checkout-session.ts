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
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://moodboard-lab.com';
const DEFAULT_RETURN_PATH = '/apply';

function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });
}

function sanitizeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_RETURN_PATH;

  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_RETURN_PATH;

  try {
    const frontendUrl = new URL(FRONTEND_URL);
    const resolvedUrl = new URL(trimmed, FRONTEND_URL);

    if (resolvedUrl.origin !== frontendUrl.origin) {
      return DEFAULT_RETURN_PATH;
    }

    resolvedUrl.searchParams.delete('credits_purchased');
    resolvedUrl.searchParams.delete('credits_cancelled');
    resolvedUrl.searchParams.delete('session_id');

    const nextPath = `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
    return nextPath.startsWith('/') ? nextPath : DEFAULT_RETURN_PATH;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}

function buildCheckoutRedirectUrl(
  returnPath: string,
  searchParams: Record<string, string>
): string {
  const redirectUrl = new URL(returnPath, FRONTEND_URL);

  for (const [key, value] of Object.entries(searchParams)) {
    redirectUrl.searchParams.set(key, value);
  }

  return redirectUrl.toString();
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
    const body = await req.json() as { packageId?: string; returnPath?: string };
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
    const returnPath = sanitizeReturnPath(body.returnPath);

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
      success_url: buildCheckoutRedirectUrl(returnPath, {
        credits_purchased: 'true',
        session_id: '{CHECKOUT_SESSION_ID}',
      }),
      cancel_url: buildCheckoutRedirectUrl(returnPath, {
        credits_cancelled: 'true',
      }),
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
