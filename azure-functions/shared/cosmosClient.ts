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
 * - Containers: users, usage, generations (all with partition key /userId)
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

export function getContainer(containerName: 'users' | 'usage' | 'generations'): Container {
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

export function isAdminUser(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
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
