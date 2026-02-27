/**
 * Create Checkout Session Function
 *
 * POST /api/create-checkout-session
 *
 * Creates a Stripe Checkout Session for one-time credit pack purchases.
 * Requires authentication.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, ValidatedUser } from '../shared/validateToken';

type CreditPackId = 'credits_50' | 'credits_100';

type CreditPackConfig = {
  id: CreditPackId;
  credits: number;
  amountPence: number;
  displayName: string;
  description: string;
  priceIdEnvVar?: string;
};

const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_API_BASE = (process.env.STRIPE_API_BASE || 'https://api.stripe.com/v1').replace(/\/+$/, '');
const APP_BASE_URL = (process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');

const CREDIT_PACKS: Record<CreditPackId, CreditPackConfig> = {
  credits_50: {
    id: 'credits_50',
    credits: 50,
    amountPence: 1000,
    displayName: '50 Credits',
    description: '50 rendering credits',
    priceIdEnvVar: (process.env.STRIPE_PRICE_ID_CREDITS_50 || '').trim() || undefined,
  },
  credits_100: {
    id: 'credits_100',
    credits: 110,
    amountPence: 2000,
    displayName: '110 Credits',
    description: '110 rendering credits',
    priceIdEnvVar: (process.env.STRIPE_PRICE_ID_CREDITS_100 || '').trim() || undefined,
  },
};

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function normalizePackId(value: unknown): CreditPackId | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'credits_50' || normalized === '50' || normalized === 'credits50') return 'credits_50';
  if (
    normalized === 'credits_100' ||
    normalized === '100' ||
    normalized === 'credits100' ||
    normalized === '110' ||
    normalized === 'credits110'
  ) {
    return 'credits_100';
  }
  return null;
}

function getRequestOrigin(req: HttpRequest): string {
  const directOrigin = (req.headers.get('origin') || '').trim().replace(/\/+$/, '');
  if (directOrigin) return directOrigin;

  const forwardedHost = (req.headers.get('x-forwarded-host') || '').split(',')[0]?.trim();
  const forwardedProto = (req.headers.get('x-forwarded-proto') || '').split(',')[0]?.trim();
  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
  }

  return APP_BASE_URL;
}

function resolveReturnUrl(
  value: unknown,
  fallbackPath: string,
  origin: string
): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${origin}${raw}`;
  }
  return `${origin}${fallbackPath}`;
}

function buildStripeSessionBody(
  pack: CreditPackConfig,
  user: ValidatedUser,
  successUrl: string,
  cancelUrl: string
): string {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('client_reference_id', user.userId);
  params.set('metadata[userId]', user.userId);
  if (user.email) {
    params.set('customer_email', user.email);
    params.set('metadata[email]', user.email);
  }
  params.set('metadata[packId]', pack.id);
  params.set('metadata[credits]', String(pack.credits));
  params.set('metadata[amountPence]', String(pack.amountPence));
  params.set('metadata[currency]', 'gbp');
  params.set('metadata[source]', 'moodboard-lab');
  params.set('line_items[0][quantity]', '1');
  params.set('allow_promotion_codes', 'true');

  if (pack.priceIdEnvVar) {
    params.set('line_items[0][price]', pack.priceIdEnvVar);
  } else {
    params.set('line_items[0][price_data][currency]', 'gbp');
    params.set('line_items[0][price_data][unit_amount]', String(pack.amountPence));
    params.set('line_items[0][price_data][product_data][name]', pack.displayName);
    params.set('line_items[0][price_data][product_data][description]', pack.description);
  }

  return params.toString();
}

export async function createCheckoutSession(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Create checkout session request received.');

  if (req.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders };
  }

  if (!STRIPE_SECRET_KEY) {
    return {
      status: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'STRIPE_SECRET_KEY is not configured.' }),
    };
  }

  const authResult = await requireAuth(req);
  if ('status' in authResult) {
    return {
      status: authResult.status,
      headers: corsHeaders,
      body: authResult.body,
    };
  }
  const user = authResult as ValidatedUser;

  try {
    let body: {
      packId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };
    try {
      body = await req.json() as {
        packId?: string;
        successUrl?: string;
        cancelUrl?: string;
      };
    } catch {
      return {
        status: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid JSON body.' }),
      };
    }

    const packId = normalizePackId(body.packId);
    if (!packId) {
      return {
        status: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid packId. Use credits_50 or credits_100.' }),
      };
    }

    const pack = CREDIT_PACKS[packId];
    const origin = getRequestOrigin(req);
    if (!origin) {
      return {
        status: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unable to resolve app origin for checkout redirect URLs.' }),
      };
    }

    const successUrl = resolveReturnUrl(body.successUrl, '/?billing=success', origin);
    const cancelUrl = resolveReturnUrl(body.cancelUrl, '/?billing=cancel', origin);

    const stripeResponse = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildStripeSessionBody(pack, user, successUrl, cancelUrl),
    });

    const stripeRawBody = await stripeResponse.text();
    let stripePayload: any = {};
    if (stripeRawBody) {
      try {
        stripePayload = JSON.parse(stripeRawBody);
      } catch {
        stripePayload = {};
      }
    }

    if (!stripeResponse.ok) {
      const stripeMessage =
        stripePayload?.error?.message ||
        stripePayload?.message ||
        `Stripe checkout session creation failed with status ${stripeResponse.status}`;
      return {
        status: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: stripeMessage }),
      };
    }

    const checkoutUrl = stripePayload?.url;
    const sessionId = stripePayload?.id;

    if (!checkoutUrl || !sessionId) {
      return {
        status: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Stripe did not return a valid checkout session URL.' }),
      };
    }

    return {
      status: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        url: checkoutUrl,
        sessionId,
        packId,
        credits: pack.credits,
        amountPence: pack.amountPence,
        currency: 'gbp',
      }),
    };
  } catch (error) {
    context.error('Failed to create checkout session:', error);
    return {
      status: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
      }),
    };
  }
}

app.http('create-checkout-session', {
  route: 'create-checkout-session',
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: createCheckoutSession,
});
