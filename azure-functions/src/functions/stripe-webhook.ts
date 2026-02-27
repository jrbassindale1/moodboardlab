/**
 * Stripe Webhook Function
 *
 * POST /api/stripe-webhook
 *
 * Verifies Stripe webhook signatures and credits user accounts
 * for completed checkout sessions.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import crypto from 'node:crypto';
import { grantPurchasedCredits } from '../shared/cosmosClient';

const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = Math.max(
  60,
  Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS || 300)
);

type StripeSignatureParts = {
  timestamp: number;
  signatures: string[];
};

type StripeCheckoutSession = {
  id?: string;
  client_reference_id?: string | null;
  metadata?: Record<string, unknown> | null;
  amount_total?: number | null;
  currency?: string | null;
};

const knownPackCredits: Record<string, number> = {
  credits_50: 50,
  credits_100: 110,
};

function parseStripeSignature(header: string | null): StripeSignatureParts | null {
  if (!header) return null;
  const parts = header.split(',').map((part) => part.trim()).filter(Boolean);

  let timestamp = 0;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    if (key === 't') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        timestamp = Math.trunc(parsed);
      }
      continue;
    }
    if (key === 'v1') {
      signatures.push(value);
    }
  }

  if (!timestamp || !signatures.length) return null;
  return { timestamp, signatures };
}

function verifyStripeSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!STRIPE_WEBHOOK_SECRET) return false;
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - parsed.timestamp);
  if (ageSeconds > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const payload = `${parsed.timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  return parsed.signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, 'utf8');
    if (signatureBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  });
}

function resolveCreditsFromSession(session: StripeCheckoutSession): number {
  const metadata = session.metadata || {};
  const fromMetadata = Number(metadata.credits);
  if (Number.isFinite(fromMetadata) && fromMetadata > 0) {
    return Math.round(fromMetadata);
  }

  const packId = typeof metadata.packId === 'string' ? metadata.packId : '';
  if (packId && knownPackCredits[packId]) {
    return knownPackCredits[packId];
  }

  return 0;
}

export async function stripeWebhook(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!STRIPE_WEBHOOK_SECRET) {
    context.error('Stripe webhook secret is not configured.');
    return {
      status: 500,
      jsonBody: { error: 'STRIPE_WEBHOOK_SECRET is not configured.' },
    };
  }

  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('stripe-signature');

    const signatureValid = verifyStripeSignature(rawBody, signatureHeader);
    if (!signatureValid) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid Stripe signature.' },
      };
    }

    let event: { id?: string; type?: string; data?: { object?: unknown } } = {};
    if (rawBody) {
      try {
        event = JSON.parse(rawBody) as { id?: string; type?: string; data?: { object?: unknown } };
      } catch {
        return {
          status: 400,
          jsonBody: { error: 'Invalid webhook payload.' },
        };
      }
    }
    const eventType = event?.type || '';
    if (eventType !== 'checkout.session.completed' && eventType !== 'checkout.session.async_payment_succeeded') {
      return {
        status: 200,
        jsonBody: { received: true, ignored: true, eventType },
      };
    }

    const session = (event?.data?.object || {}) as StripeCheckoutSession;
    const sessionId = typeof session.id === 'string' ? session.id : '';
    const metadata = session.metadata || {};
    const userId =
      (typeof metadata.userId === 'string' && metadata.userId.trim()) ||
      (typeof session.client_reference_id === 'string' && session.client_reference_id.trim()) ||
      '';
    const credits = resolveCreditsFromSession(session);

    if (!sessionId || !userId || credits <= 0) {
      context.warn('Stripe checkout session missing required credit metadata', {
        sessionId,
        userId,
        credits,
      });
      return {
        status: 400,
        jsonBody: { error: 'Webhook payload missing required credit purchase metadata.' },
      };
    }

    const grantResult = await grantPurchasedCredits({
      userId,
      sourceId: sessionId,
      credits,
      amountPence: typeof session.amount_total === 'number' ? Math.max(0, Math.round(session.amount_total)) : undefined,
      currency: typeof session.currency === 'string' ? session.currency : 'gbp',
      metadata: {
        eventId: event.id || '',
        eventType,
        packId: typeof metadata.packId === 'string' ? metadata.packId : '',
      },
    });

    return {
      status: 200,
      jsonBody: {
        received: true,
        processed: grantResult.applied,
        duplicate: !grantResult.applied,
        userId,
        sessionId,
        credits,
        balance: grantResult.balance,
      },
    };
  } catch (error) {
    context.error('Stripe webhook processing failed:', error);
    return {
      status: 500,
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to process Stripe webhook',
      },
    };
  }
}

app.http('stripe-webhook', {
  route: 'stripe-webhook',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: stripeWebhook,
});
