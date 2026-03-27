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

import { CosmosClient, Container, Database } from '@azure/cosmos';

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
    | 'credits'
    | 'credit_transactions'
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

export interface UsageDocument {
  id: string; // Format: "userId:YYYY-MM"
  userId: string; // Partition key
  yearMonth: string;
  generationCounts: {
    moodboard: number;
    applyMaterials: number;
    upscale: number;
    materialIcon: number;
    materialDetection: number;
    sustainabilityBriefing: number;
    precedentSearch: number;
  };
  totalGenerations: number;
  lastUpdatedAt: string;
}

/**
 * Document for tracking purchased credits (non-expiring)
 * Stored in the 'credits' container with userId as partition key
 */
export interface CreditsDocument {
  id: string; // Same as userId
  userId: string; // Partition key
  purchasedCredits: number; // Total purchased credits remaining
  totalPurchased: number; // Lifetime total purchased (for analytics)
  lastPurchaseAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Document for tracking credit purchase transactions
 * Stored in the 'credit_transactions' container
 */
export interface CreditTransactionDocument {
  id: string; // Stripe session ID or transaction ID
  userId: string; // Partition key
  type: 'purchase' | 'consume' | 'refund' | 'bonus';
  credits: number; // Positive for purchase/bonus, negative for consume
  amountPence: number; // Amount in pence (GBP)
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface GenerationDocument {
  id: string;
  userId: string; // Partition key
  type: 'moodboard' | 'applyMaterials' | 'upscale' | 'materialIcon' | 'materialDetection' | 'sustainabilityBriefing' | 'precedentSearch';
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

/**
 * Credit pricing tiers (amounts in pence GBP)
 * "Credits start at £0.20 each, with better value on larger bundles."
 */
export const CREDIT_PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 25, pricePence: 500, priceDisplay: '£5' },
  { id: 'standard', name: 'Standard', credits: 50, pricePence: 1000, priceDisplay: '£10' },
  { id: 'pro', name: 'Pro', credits: 150, pricePence: 2500, priceDisplay: '£25' },
] as const;

export type CreditPackageId = typeof CREDIT_PACKAGES[number]['id'];

export function getCreditPackage(packageId: string) {
  return CREDIT_PACKAGES.find(p => p.id === packageId) || null;
}

/**
 * Credit costs for different generation modes
 */
export const CREDIT_COSTS = {
  /** Generate a new moodboard image */
  MOODBOARD_GENERATION: 1,
  /** Generate or refine a render */
  RENDER_GENERATION: 2,
  /** Turn-by-turn / iterative image generation (multi-step workflow) */
  ITERATIVE_GENERATION: 2,
  /** 4K image generation (paid users only) */
  FOUR_K_GENERATION: 5,
} as const;

/**
 * Generation modes that determine credit cost
 */
export type GenerationMode = 'standard' | 'iterative' | '4k';

/**
 * Get the credit cost for a generation mode
 */
export function getGenerationCost(mode: GenerationMode): number {
  switch (mode) {
    case 'standard':
      return CREDIT_COSTS.MOODBOARD_GENERATION;
    case 'iterative':
      return CREDIT_COSTS.ITERATIVE_GENERATION;
    case '4k':
      return CREDIT_COSTS.FOUR_K_GENERATION;
    default:
      return CREDIT_COSTS.MOODBOARD_GENERATION;
  }
}

/**
 * Check if a user is a paid user (has purchased credits or has active subscription)
 * Paid users unlock 4K generation
 */
export function isPaidUser(creditsDoc: CreditsDocument | null): boolean {
  if (!creditsDoc) return false;
  // User is "paid" if they have ever purchased credits
  return creditsDoc.totalPurchased > 0;
}

/**
 * Check if 4K generation is allowed for a user
 * 4K requires at least 5 purchased credits available
 */
export function canGenerate4K(creditsDoc: CreditsDocument | null, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  return (creditsDoc?.purchasedCredits || 0) >= CREDIT_COSTS.FOUR_K_GENERATION;
}

// Admin users with unlimited credits
export const ADMIN_EMAILS: string[] = [
  'jrbassindale@yahoo.co.uk',
];

const ADMIN_USER_IDS: string[] = (process.env.ADMIN_USER_IDS || '')
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
