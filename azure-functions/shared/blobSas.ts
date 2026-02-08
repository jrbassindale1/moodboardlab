/**
 * Blob SAS URL helper
 *
 * Generates short-lived SAS URLs for private blobs so they can be
 * loaded directly by the frontend (e.g. <img src="...">).
 */

import {
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  SASProtocol,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';

let cachedCredential: StorageSharedKeyCredential | null | undefined;

function getStorageCredential(): StorageSharedKeyCredential | null {
  if (cachedCredential !== undefined) return cachedCredential;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
  if (!connectionString) {
    cachedCredential = null;
    return cachedCredential;
  }

  const parts = connectionString.split(';');
  const entries: Record<string, string> = {};
  for (const part of parts) {
    if (!part) continue;
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex);
    const value = part.slice(eqIndex + 1);
    entries[key] = value;
  }

  const accountName = entries.AccountName;
  const accountKey = entries.AccountKey;
  if (!accountName || !accountKey) {
    cachedCredential = null;
    return cachedCredential;
  }

  cachedCredential = new StorageSharedKeyCredential(accountName, accountKey);
  return cachedCredential;
}

export function getSasUrlForBlob(blobUrl: string, expiresInMinutes = 60): string {
  if (!blobUrl || blobUrl.startsWith('data:')) return blobUrl;

  try {
    const url = new URL(blobUrl);
    if (url.search) return blobUrl; // Already has a query string (likely SAS)

    const path = url.pathname.replace(/^\/+/, '');
    const [containerName, ...blobParts] = path.split('/');
    if (!containerName || blobParts.length === 0) return blobUrl;

    const blobName = decodeURIComponent(blobParts.join('/'));
    const credential = getStorageCredential();
    if (!credential) return blobUrl;

    const now = Date.now();
    const startsOn = new Date(now - 5 * 60 * 1000); // clock skew buffer
    const expiresOn = new Date(now + Math.max(1, expiresInMinutes) * 60 * 1000);

    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse('r'),
        startsOn,
        expiresOn,
        protocol: SASProtocol.Https,
      },
      credential
    ).toString();

    const baseUrl = new URL(url.toString());
    baseUrl.search = '';
    baseUrl.hash = '';
    baseUrl.pathname = `/${containerName}/${blobName}`;
    return `${baseUrl.toString()}?${sas}`;
  } catch {
    return blobUrl;
  }
}
