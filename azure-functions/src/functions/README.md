# Azure Functions Backend for Authentication & Usage Tracking

This directory contains the Azure Functions code needed to support user authentication and usage tracking.

## Prerequisites

1. **Clerk Account** - Sign up at https://clerk.com
2. **CosmosDB Account** - Use your existing `moodboardlab-cosmos` account
3. **Install additional npm packages** in your Azure Functions project:
   ```bash
   npm install jsonwebtoken jwks-rsa uuid @azure/cosmos
   npm install -D @types/jsonwebtoken
   ```

## Clerk Setup

### 1. Create Clerk Application
- Go to https://dashboard.clerk.com
- Create a new application
- Choose sign-in options (Email, Google, Microsoft, etc.)

### 2. Enable Microsoft Login (Recommended for UWE users)
- Go to Configure → SSO Connections
- Add Microsoft connection
- Enable it

### 3. Get Your Keys
- **Publishable Key**: For frontend (starts with `pk_`)
- **Secret Key**: For backend verification (starts with `sk_`)
- **JWKS URL**: `https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json`

## CosmosDB Setup

Using your existing `moodboardlab-cosmos` account:

### 1. Database
- Database name: `moodboardlab`

### 2. Containers

**users** container:
- Partition key: `/userId`

**usage** container:
- Partition key: `/userId`

**generations** container:
- Partition key: `/userId`

**materials** container:
- Partition key: `/category` (recommended) or `/id`
- Store one material document per item (same shape as frontend `MaterialOption`)

Storage container for material icons:
- Container name: `material-icons`
- Upload default icon assets (`.webp` + `.png`) and keep container private
- API can return SAS-backed URLs for these icons

## Environment Variables

### Azure Functions (Application Settings)

You already have these CosmosDB variables:
- `COSMOS_DB_URI` - Your CosmosDB endpoint
- `COSMOS_DB_KEY` - Your CosmosDB primary key
- `COSMOS_DB_NAME` - Database name (moodboardlab)

Add this for Clerk token validation:
```
CLERK_JWKS_URL=https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json
```

Optional (recommended) for stricter token validation:
```
CLERK_ISSUER=https://<your-clerk-instance>.clerk.accounts.dev
CLERK_AUDIENCE=<your-expected-audience>
```

Optional for material icon URL generation:
```
MATERIAL_ICON_BLOB_CONTAINER=material-icons
# Or set full base (container included), e.g.
# MATERIAL_ICON_BLOB_BASE_URL=https://<account>.blob.core.windows.net/material-icons
```

### Frontend (.env.local)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx
```

## Files Structure

```
your-azure-functions-project/
├── src/
│   ├── functions/
│   │   ├── check-quota.ts
│   │   ├── usage.ts
│   │   └── generations.ts
│   └── shared/
│       ├── validateToken.ts
│       ├── cosmosClient.ts
│       └── usageHelpers.ts
├── host.json
└── package.json
```

## Testing

1. Start your frontend: `npm run dev`
2. Deploy Azure Functions or run locally: `func start`
3. Sign in using the Clerk modal (Email, Google, or Microsoft)
4. Generate a moodboard and verify:
   - Usage count increments
   - Generation appears in dashboard
   - Quota is enforced after 10 generations
5. Verify materials API:
   - `GET /api/materials` returns `{ items: [...] }` from CosmosDB

## Troubleshooting

### Token Validation Fails
- Verify CLERK_JWKS_URL is correct
- Check that your Clerk application is active
- Ensure token hasn't expired

### CosmosDB Errors
- Verify COSMOS_DB_URI and COSMOS_DB_KEY are correct
- Check that database and containers exist
- Verify partition key paths are `/userId`

### CORS Issues
- Ensure your Azure Functions have CORS configured
- In Azure Portal: Function App → CORS → Add your frontend origins
