/**
 * Manual script to add credits to a user's account
 *
 * Usage: npx tsx scripts/add-credits-manual.ts
 *
 * Requires environment variables:
 * - COSMOS_DB_URI
 * - COSMOS_DB_KEY
 * - COSMOS_DB_NAME (defaults to 'moodboardlab')
 */

import { CosmosClient } from '@azure/cosmos';

// Configuration - update these values
const USER_ID = 'user_39OJVJHEAsR1y9chFtFYIGdhuy1';
const CREDITS_TO_ADD = 25;
const STRIPE_SESSION_ID = 'cs_live_a1KBgbK4PDHBD5FuqZRtTE83A4ImPWWywwvPDiyg4wp1IYVO6KBUtFvll0';
const AMOUNT_PENCE = 500;

async function main() {
  const endpoint = process.env.COSMOS_DB_URI;
  const key = process.env.COSMOS_DB_KEY;
  const dbName = process.env.COSMOS_DB_NAME || 'moodboardlab';

  if (!endpoint || !key) {
    console.error('Missing COSMOS_DB_URI or COSMOS_DB_KEY environment variables');
    console.log('Set them in your terminal before running:');
    console.log('  export COSMOS_DB_URI="your-uri"');
    console.log('  export COSMOS_DB_KEY="your-key"');
    process.exit(1);
  }

  const client = new CosmosClient({ endpoint, key });
  const database = client.database(dbName);
  const creditsContainer = database.container('credits');
  const transactionsContainer = database.container('credit_transactions');

  const now = new Date().toISOString();

  console.log(`Adding ${CREDITS_TO_ADD} credits to user ${USER_ID}...`);

  // Check if user already has a credits document
  try {
    const { resource: existingCredits } = await creditsContainer
      .item(USER_ID, USER_ID)
      .read();

    if (existingCredits) {
      // Update existing
      const updated = {
        ...existingCredits,
        purchasedCredits: existingCredits.purchasedCredits + CREDITS_TO_ADD,
        totalPurchased: existingCredits.totalPurchased + CREDITS_TO_ADD,
        lastPurchaseAt: now,
        updatedAt: now,
      };
      await creditsContainer.item(USER_ID, USER_ID).replace(updated);
      console.log(`Updated credits: ${existingCredits.purchasedCredits} -> ${updated.purchasedCredits}`);
    }
  } catch (error: any) {
    if (error.code === 404) {
      // Create new
      await creditsContainer.items.create({
        id: USER_ID,
        userId: USER_ID,
        purchasedCredits: CREDITS_TO_ADD,
        totalPurchased: CREDITS_TO_ADD,
        lastPurchaseAt: now,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`Created new credits document with ${CREDITS_TO_ADD} credits`);
    } else {
      throw error;
    }
  }

  // Record the transaction
  const transactionId = `txn_manual_${STRIPE_SESSION_ID}`;
  try {
    await transactionsContainer.items.create({
      id: transactionId,
      userId: USER_ID,
      type: 'purchase',
      credits: CREDITS_TO_ADD,
      amountPence: AMOUNT_PENCE,
      stripeSessionId: STRIPE_SESSION_ID,
      stripePaymentIntentId: 'pi_3TES5hCgfEJ4IUPV13lOolLr',
      createdAt: now,
      metadata: { source: 'manual_script' },
    });
    console.log(`Recorded transaction ${transactionId}`);
  } catch (error: any) {
    if (error.code === 409) {
      console.log('Transaction already exists (idempotent)');
    } else {
      throw error;
    }
  }

  console.log('Done! Credits added successfully.');
}

main().catch(console.error);
