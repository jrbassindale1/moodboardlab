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
