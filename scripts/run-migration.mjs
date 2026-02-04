// Run the user system migration against Supabase
// Uses the Supabase Management API (pg-meta) or direct connection
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nzmhfborsapbnlckufrx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY env var is required');
  process.exit(1);
}

// Read the migration SQL
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250725000000_user_system.sql');
const sql = fs.readFileSync(migrationPath, 'utf-8');

// Split into individual statements
const statements = sql
  .split(/;\s*$/m)
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--'));

console.log(`Found ${statements.length} SQL statements to execute`);

// We'll try to execute via the Supabase REST /sql endpoint
// This is available in newer Supabase versions
async function runMigration() {
  // Try the pg-meta SQL endpoint
  const response = await fetch(`${SUPABASE_URL}/pg/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (response.ok) {
    const result = await response.json();
    console.log('Migration executed successfully via pg-meta!');
    console.log(JSON.stringify(result, null, 2));
    return true;
  }

  console.log(`pg-meta response: ${response.status} ${response.statusText}`);
  const text = await response.text();
  console.log(text);
  return false;
}

async function verifyTables() {
  // Verify the interests table exists
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/interests?select=id,name,is_predefined&limit=5`,
    {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  const data = await response.json();
  console.log('\nVerification - interests table:', JSON.stringify(data, null, 2));
}

const success = await runMigration();
if (success) {
  await verifyTables();
}
