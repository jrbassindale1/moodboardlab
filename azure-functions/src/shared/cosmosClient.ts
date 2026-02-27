/**
 * CosmosDB Client Configuration
 *
 * Required environment variables (using your existing setup):
 * - COSMOS_DB_URI: Your CosmosDB endpoint
 * - COSMOS_DB_KEY: Your CosmosDB primary key
 * - COSMOS_DB_NAME: Your database name (moodboardlab)
 *
 * Database structure:
 * - Database: moodboardlab
 * - Containers: users, usage, generations, materials, finishes, finish_sets,
 *               material_finish_links, material_finish_set_links, lifecycle_profiles
 */

import { CosmosClient, Container, Database, type OperationInput, type PatchOperation } from '@azure/cosmos';

let client: CosmosClient | null = null;
let database: Database | null = null;

const containers: Record<string, Container> = {};

function getClient(): CosmosClient {
  if (!client) {
    const endpoint = process.env.COSMOS_DB_URI;
    const key = process.env.COSMOS_DB_KEY;

    if (!endpoint || !key) {
      throw new Error('COSMOS_DB_URI and COSMOS_DB_KEY environment variables are required');
    }

    client = new CosmosClient({ endpoint, key });
  }
  return client;
}

function getDatabase(): Database {
  if (!database) {
    const dbName = process.env.COSMOS_DB_NAME || 'moodboardlab';
    database = getClient().database(dbName);
  }
  return database;
}

export function getContainer(
  containerName:
    | 'users'
    | 'usage'
    | 'generations'
    | 'materials'
    | 'finishes'
    | 'finish_sets'
    | 'material_finish_links'
    | 'material_finish_set_links'
    | 'lifecycle_profiles'
): Container {
  if (!containers[containerName]) {
    containers[containerName] = getDatabase().container(containerName);
  }
  return containers[containerName];
}

// Type definitions for documents

export interface UserDocument {
  id: string;
  userId: string; // Partition key
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string;
  tier: 'free' | 'pro';
}

export interface CreditAccountDocument {
  id: 'credit-account';
  userId: string; // Partition key
  docType: 'creditAccount';
  balance: number;
  lifetimePurchased: number;
  lifetimeSpent: number;
  currency: 'gbp';
  createdAt: string;
  updatedAt: string;
  _etag?: string;
}

export interface CreditPurchaseDocument {
  id: string; // Format: "credit-purchase:stripe:<checkoutSessionId>"
  userId: string; // Partition key
  docType: 'creditPurchase';
  source: 'stripe';
  sourceId: string;
  credits: number;
  amountPence?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface UsageDocument {
  id: string; // Format: "userId:YYYY-MM"
  userId: string; // Partition key
  yearMonth: string;
  generationCounts: {
    moodboard: number;
    applyMaterials: number;
    upscale: number;
    materialIcon: number;
    sustainabilityBriefing: number;
  };
  totalGenerations: number;
  lastUpdatedAt: string;
}

export interface GenerationDocument {
  id: string;
  userId: string; // Partition key
  type: 'moodboard' | 'applyMaterials' | 'upscale' | 'materialIcon' | 'sustainabilityBriefing';
  prompt: string;
  blobUrl?: string;
  materials?: unknown;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MaterialDocument {
  id: string;
  pk: string; // category (partition key)
  docType: 'material';
  sortOrder: number;

  name: string;
  tone: string;
  finish: string;
  description: string;
  keywords: string[];
  category: string;

  colorOptions?: Array<{ label: string; tone: string }>;
  supportsColor?: boolean;
  finishOptions?: string[];
  varietyOptions?: string[];
  treePaths?: string[];
  carbonIntensity?: 'low' | 'medium' | 'high';
  tags?: string[];
  materialType?: string;
  finishFamily?: string;
  materialForm?: string[];
  materialFunction?: string[];
  manufacturingProcess?: string[];

  finishIds: string[];
  primaryFinishId: string | null;
  finishSetIds: string[];
  primaryFinishSetId: string | null;
  lifecycleProfileId: string | null;

  // Sustainability and specification data
  insight: string | null;
  actions: string[] | null; // Legacy field - being replaced by structured action fields
  actionDocumentation: string | null; // Request for EPD, certification, or sourcing evidence
  actionVerification: string | null; // Specification to verify (recycled content, VOC levels, etc.)
  actionCircularity: string | null; // End-of-life action (take-back, disassembly, reuse)
  strategicValue: string | null; // For low-carbon materials: why this is an excellent choice
  mitigationTip: string | null; // For high-carbon materials: practical tip to reduce impact
  healthRiskLevel: 'low' | 'medium' | 'high' | null;
  healthConcerns: string[] | null;
  healthNote: string | null;
  risks: Array<{ risk: string; mitigation: string }> | null;
  serviceLife: number | null;
}

export interface FinishDocument {
  id: string; // `finish:<normalized-label>`
  pk: 'finish';
  label: string;
  normalizedLabel: string;
  type: 'finish';
}

export interface FinishSetDocument {
  id: string; // `fs:<type>:<hash>`
  pk: 'finish_set';
  type: 'ral' | 'colorOptions' | 'textOptions' | 'single';
  name: string;
  options: Array<{ label: string; tone?: string }>;
  signature: string;
}

export interface MaterialFinishLinkDocument {
  id: string; // `mf:<materialId>:<finishId>`
  pk: string; // materialId
  materialId: string;
  finishId: string;
  isPrimary: boolean;
}

export interface MaterialFinishSetLinkDocument {
  id: string; // `mfs:<materialId>:<finishSetId>`
  pk: string; // materialId
  materialId: string;
  finishSetId: string;
  isDefault: boolean;
}

export interface LifecycleProfileDocument {
  id: string; // `lp:<materialId>`
  pk: string; // materialId
  docType: 'lifecycleProfile';
  materialId: string;
  stages: {
    raw: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    manufacturing: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    transport: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    installation: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    inUse: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    maintenance: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
    endOfLife: { impact: 1 | 2 | 3 | 4 | 5; confidence?: 'high' | 'medium' | 'low' };
  };
}

// Helper functions

export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getUsageDocumentId(userId: string, yearMonth?: string): string {
  return `${userId}:${yearMonth || getCurrentYearMonth()}`;
}

export const FREE_MONTHLY_LIMIT = 10;
const CREDIT_ACCOUNT_DOCUMENT_ID: CreditAccountDocument['id'] = 'credit-account';
const CREDIT_PURCHASE_DOCUMENT_PREFIX = 'credit-purchase:stripe:';
const MAX_CREDIT_MUTATION_RETRIES = 5;

// Admin users with unlimited credits
export const ADMIN_EMAILS: string[] = [
  'jrbassindale@yahoo.co.uk',
];

const ADMIN_USER_IDS: string[] = (process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const PRO_CUSTOMER_EMAILS: string[] = (process.env.PRO_CUSTOMER_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const PRO_CUSTOMER_USER_IDS: string[] = (process.env.PRO_CUSTOMER_USER_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export function isAdminUser(email?: string | null, userId?: string | null): boolean {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (normalizedEmail && ADMIN_EMAILS.includes(normalizedEmail)) {
    return true;
  }

  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  if (normalizedUserId && ADMIN_USER_IDS.includes(normalizedUserId)) {
    return true;
  }

  return false;
}

export function isProUser(email?: string | null, userId?: string | null): boolean {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (normalizedEmail && PRO_CUSTOMER_EMAILS.includes(normalizedEmail)) {
    return true;
  }

  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  if (normalizedUserId && PRO_CUSTOMER_USER_IDS.includes(normalizedUserId)) {
    return true;
  }

  return false;
}

export function isCosmosNotFound(error: unknown): boolean {
  const err = error as {
    code?: number | string;
    statusCode?: number;
    body?: { code?: string };
  };
  return (
    err.code === 404 ||
    err.code === 'NotFound' ||
    err.statusCode === 404 ||
    err.body?.code === 'NotFound'
  );
}

export function isCosmosConflict(error: unknown): boolean {
  const err = error as {
    code?: number | string;
    statusCode?: number;
    body?: { code?: string };
  };
  return (
    err.code === 409 ||
    err.code === 'Conflict' ||
    err.statusCode === 409 ||
    err.body?.code === 'Conflict'
  );
}

export function isCosmosPreconditionFailed(error: unknown): boolean {
  const err = error as {
    code?: number | string;
    statusCode?: number;
    body?: { code?: string };
  };
  return (
    err.code === 412 ||
    err.code === 'PreconditionFailed' ||
    err.statusCode === 412 ||
    err.body?.code === 'PreconditionFailed'
  );
}

function normalizeCredits(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function toCreditAccountDoc(userId: string, nowIso: string, initialBalance = 0): CreditAccountDocument {
  const initial = normalizeCredits(initialBalance);
  return {
    id: CREDIT_ACCOUNT_DOCUMENT_ID,
    userId,
    docType: 'creditAccount',
    balance: initial,
    lifetimePurchased: initial,
    lifetimeSpent: 0,
    currency: 'gbp',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function getCreditAccount(userId: string): Promise<CreditAccountDocument | null> {
  const usersContainer = getContainer('users');
  try {
    const { resource } = await usersContainer
      .item(CREDIT_ACCOUNT_DOCUMENT_ID, userId)
      .read<CreditAccountDocument>();
    return resource || null;
  } catch (error: unknown) {
    if (isCosmosNotFound(error)) return null;
    throw error;
  }
}

export async function getPaidCreditBalance(userId: string): Promise<number> {
  const account = await getCreditAccount(userId);
  return normalizeCredits(account?.balance);
}

async function mutateCreditBalance(userId: string, delta: number): Promise<{ success: boolean; balance: number }> {
  const usersContainer = getContainer('users');
  const roundedDelta = Math.trunc(delta);
  if (!Number.isFinite(roundedDelta) || roundedDelta === 0) {
    const balance = await getPaidCreditBalance(userId);
    return { success: true, balance };
  }

  for (let attempt = 0; attempt < MAX_CREDIT_MUTATION_RETRIES; attempt += 1) {
    const nowIso = new Date().toISOString();

    try {
      const readResponse = await usersContainer
        .item(CREDIT_ACCOUNT_DOCUMENT_ID, userId)
        .read<CreditAccountDocument>();
      const existing = readResponse.resource;

      if (!existing) {
        if (roundedDelta < 0) {
          return { success: false, balance: 0 };
        }

        try {
          const accountToCreate = toCreditAccountDoc(userId, nowIso, roundedDelta);
          await usersContainer.items.create(accountToCreate);
          return { success: true, balance: accountToCreate.balance };
        } catch (createError: unknown) {
          if (isCosmosConflict(createError)) {
            continue;
          }
          throw createError;
        }
      }

      const currentBalance = normalizeCredits(existing.balance);
      const nextBalance = currentBalance + roundedDelta;
      if (nextBalance < 0) {
        return { success: false, balance: currentBalance };
      }

      const etag = readResponse.etag || (existing as { _etag?: string })._etag;
      const patchOps: PatchOperation[] = [
        { op: 'incr', path: '/balance', value: roundedDelta },
        { op: 'set', path: '/updatedAt', value: nowIso },
      ];
      if (roundedDelta > 0) {
        patchOps.push({ op: 'incr', path: '/lifetimePurchased', value: roundedDelta });
      } else {
        patchOps.push({ op: 'incr', path: '/lifetimeSpent', value: Math.abs(roundedDelta) });
      }

      const patchOptions = etag
        ? { accessCondition: { type: 'IfMatch', condition: etag } }
        : undefined;

      try {
        await usersContainer.item(CREDIT_ACCOUNT_DOCUMENT_ID, userId).patch(patchOps, patchOptions);
        return { success: true, balance: nextBalance };
      } catch (patchError: unknown) {
        if (isCosmosPreconditionFailed(patchError) || isCosmosConflict(patchError)) {
          continue;
        }
        if (isCosmosNotFound(patchError)) {
          continue;
        }
        throw patchError;
      }
    } catch (readError: unknown) {
      if (!isCosmosNotFound(readError)) {
        throw readError;
      }

      if (roundedDelta < 0) {
        return { success: false, balance: 0 };
      }

      try {
        const newAccount = toCreditAccountDoc(userId, nowIso, roundedDelta);
        await usersContainer.items.create(newAccount);
        return { success: true, balance: newAccount.balance };
      } catch (createError: unknown) {
        if (isCosmosConflict(createError)) {
          continue;
        }
        throw createError;
      }
    }
  }

  throw new Error('Failed to update credit account after multiple retries');
}

export async function consumePaidCredits(
  userId: string,
  amount: number
): Promise<{ success: boolean; balance: number }> {
  const creditsToConsume = normalizeCredits(amount);
  if (creditsToConsume <= 0) {
    return { success: true, balance: await getPaidCreditBalance(userId) };
  }
  return mutateCreditBalance(userId, -creditsToConsume);
}

export async function grantPurchasedCredits(params: {
  userId: string;
  sourceId: string;
  credits: number;
  amountPence?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ applied: boolean; balance: number }> {
  const userId = params.userId?.trim();
  if (!userId) {
    throw new Error('userId is required to grant credits');
  }

  const sourceId = params.sourceId?.trim();
  if (!sourceId) {
    throw new Error('sourceId is required to grant credits');
  }

  const credits = normalizeCredits(params.credits);
  if (credits <= 0) {
    throw new Error('credits must be greater than 0');
  }

  const usersContainer = getContainer('users');
  const purchaseDocumentId = `${CREDIT_PURCHASE_DOCUMENT_PREFIX}${sourceId}`;
  const nowIso = new Date().toISOString();

  for (let attempt = 0; attempt < MAX_CREDIT_MUTATION_RETRIES; attempt += 1) {
    const existingAccount = await getCreditAccount(userId);
    const currentBalance = normalizeCredits(existingAccount?.balance);
    const txDocument: CreditPurchaseDocument = {
      id: purchaseDocumentId,
      userId,
      docType: 'creditPurchase',
      source: 'stripe',
      sourceId,
      credits,
      amountPence: typeof params.amountPence === 'number' ? Math.max(0, Math.round(params.amountPence)) : undefined,
      currency: params.currency ? String(params.currency).toLowerCase() : 'gbp',
      metadata: params.metadata,
      createdAt: nowIso,
    };

    const operations: OperationInput[] = [
      {
        operationType: 'Create',
        resourceBody: txDocument as any,
      },
    ];

    if (existingAccount) {
      const patchOps: PatchOperation[] = [
        { op: 'incr', path: '/balance', value: credits },
        { op: 'incr', path: '/lifetimePurchased', value: credits },
        { op: 'set', path: '/updatedAt', value: nowIso },
      ];
      operations.push({
        operationType: 'Patch',
        id: CREDIT_ACCOUNT_DOCUMENT_ID,
        resourceBody: patchOps,
      } as unknown as OperationInput);
    } else {
      operations.push({
        operationType: 'Create',
        resourceBody: toCreditAccountDoc(userId, nowIso, credits) as any,
      });
    }

    const batchResponse = await usersContainer.items.batch(operations, userId);
    const txStatus = batchResponse.result?.[0]?.statusCode ?? 500;
    const accountStatus = batchResponse.result?.[1]?.statusCode ?? 500;

    const txApplied = txStatus >= 200 && txStatus < 300;
    const accountApplied = accountStatus >= 200 && accountStatus < 300;

    if (txApplied && accountApplied) {
      return {
        applied: true,
        balance: currentBalance + credits,
      };
    }

    if (txStatus === 409) {
      const balance = await getPaidCreditBalance(userId);
      return { applied: false, balance };
    }

    if (accountStatus === 404 || accountStatus === 409) {
      continue;
    }

    throw new Error(
      `Failed to grant purchased credits (tx status ${txStatus}, account status ${accountStatus})`
    );
  }

  throw new Error('Failed to grant purchased credits after multiple retries');
}

export async function addPaidCredits(
  userId: string,
  amount: number
): Promise<{ success: boolean; balance: number }> {
  const creditsToAdd = normalizeCredits(amount);
  if (creditsToAdd <= 0) {
    return { success: true, balance: await getPaidCreditBalance(userId) };
  }
  return mutateCreditBalance(userId, creditsToAdd);
}
