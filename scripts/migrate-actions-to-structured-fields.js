#!/usr/bin/env node
/**
 * Migration script to convert 'actions' array to structured fields:
 * - actionDocumentation: EPD, certification, sourcing evidence requests
 * - actionVerification: Material property/specification verification
 * - actionCircularity: End-of-life, take-back, reuse actions
 *
 * Run with: node scripts/migrate-actions-to-structured-fields.js
 */

const API_URL = 'https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net/api/materials';
const ADMIN_KEY = '11NarrowPath';

/**
 * Ensure proper sentence formatting: capitalize first letter, end with period
 */
function formatSentence(text) {
  if (!text || typeof text !== 'string') return null;
  let formatted = text.trim();
  if (!formatted) return null;

  // Capitalize first letter
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  // Ensure ends with period (unless already has terminal punctuation)
  if (!/[.!?]$/.test(formatted)) {
    formatted += '.';
  }

  return formatted;
}

/**
 * Categorize an action string into one of the three types
 */
function categorizeAction(action) {
  if (!action) return null;

  const lower = action.toLowerCase();

  // Documentation: Requests for EPD, certification, sourcing evidence
  if (
    lower.startsWith('provide an epd') ||
    lower.startsWith('provide fsc or pefc') ||
    lower.startsWith('provide origin and responsible-sourcing') ||
    lower.includes('chain-of-custody proof')
  ) {
    return 'documentation';
  }

  // Circularity: End-of-life, take-back, reuse, disassembly
  if (
    lower.includes('take-back scheme') ||
    lower.includes('end-of-life') ||
    lower.includes('end of life') ||
    lower.includes('taken apart') ||
    lower.includes('be taken apart') ||
    lower.includes('can be reused') ||
    lower.includes('future reuse') ||
    lower.includes('future lifting') ||
    lower.includes('future removal') ||
    lower.includes('separation at end') ||
    lower.includes('material separation') ||
    lower.includes('manufacturer recycling scheme') ||
    lower.includes('recycling pathway') ||
    lower.includes('recyclability pathway') ||
    lower.includes('composting pathway') ||
    lower.includes('dry-laid') ||
    lower.includes('lime mortar bedding')
  ) {
    return 'circularity';
  }

  // Everything else is verification
  return 'verification';
}

/**
 * Process all materials and categorize their actions
 */
async function processMaterials() {
  console.log('Fetching all materials...');

  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch materials: ${response.status}`);
  }

  const data = await response.json();
  const materials = data.items || [];

  console.log(`Found ${materials.length} materials`);

  // Filter to materials with actions
  const materialsWithActions = materials.filter(m => m.actions && m.actions.length > 0);
  console.log(`${materialsWithActions.length} materials have actions to migrate`);

  let successCount = 0;
  let errorCount = 0;

  for (const material of materialsWithActions) {
    const { id, name, actions } = material;

    // Categorize each action
    const categorized = {
      documentation: [],
      verification: [],
      circularity: []
    };

    for (const action of actions) {
      const category = categorizeAction(action);
      if (category) {
        categorized[category].push(formatSentence(action));
      }
    }

    // Take the first (most important) action from each category
    const actionDocumentation = categorized.documentation[0] || null;
    const actionVerification = categorized.verification[0] || null;
    const actionCircularity = categorized.circularity[0] || null;

    // Log categorization for review
    console.log(`\n${name} (${id}):`);
    console.log(`  Documentation: ${actionDocumentation || '(none)'}`);
    console.log(`  Verification: ${actionVerification || '(none)'}`);
    console.log(`  Circularity: ${actionCircularity || '(none)'}`);

    // Update the material
    try {
      const updateResponse = await fetch(API_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY,
          'Origin': 'https://agreeable-river-02d882203-staging.westeurope.3.azurestaticapps.net'
        },
        body: JSON.stringify({
          id,
          actionDocumentation,
          actionVerification,
          actionCircularity
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error(`  ERROR updating ${id}: ${updateResponse.status} - ${errorText}`);
        errorCount++;
      } else {
        console.log(`  Updated successfully`);
        successCount++;
      }
    } catch (error) {
      console.error(`  ERROR updating ${id}:`, error.message);
      errorCount++;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n========== Summary ==========`);
  console.log(`Total processed: ${materialsWithActions.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

processMaterials().catch(console.error);
