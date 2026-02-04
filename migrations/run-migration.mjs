// Run migration against Supabase using pg
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Supabase connection - direct postgres connection
// Supabase project: nzmhfborsapbnlckufrx
const connectionString = `postgresql://postgres.nzmhfborsapbnlckufrx:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;

async function runMigration() {
  const sql = fs.readFileSync(path.join(__dirname, '001_user_system.sql'), 'utf8');
  
  console.log('Connecting to Supabase...');
  const client = new pg.Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected! Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');
    
    // Verify
    const result = await client.query('SELECT count(*) FROM interests WHERE is_predefined = true');
    console.log(`✅ Predefined interests seeded: ${result.rows[0].count}`);
    
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('user_profiles', 'interests', 'user_interests')
    `);
    console.log('✅ Tables created:', tables.rows.map(r => r.table_name).join(', '));
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
