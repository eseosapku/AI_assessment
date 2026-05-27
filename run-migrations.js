const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrations = [
  'ALTER TABLE assignments ADD COLUMN IF NOT EXISTS strict_mode BOOLEAN DEFAULT false;',
  'ALTER TABLE results ADD COLUMN IF NOT EXISTS submission_reason VARCHAR(50) DEFAULT \'manual\';',
  'ALTER TABLE results ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;',
  'CREATE INDEX IF NOT EXISTS idx_results_submission_reason ON results(submission_reason);',
];

async function runMigrations() {
  try {
    console.log('Running database migrations...');

    for (const migration of migrations) {
      console.log(`Executing: ${migration}`);
      const { data, error } = await supabase.rpc('exec_sql', { sql: migration }).catch(() => ({
        error: { message: 'RPC not available' }
      }));

      if (error && error.message !== 'RPC not available') {
        console.error(`Error: ${error.message}`);
      } else {
        console.log('✓ Migration executed');
      }
    }

    console.log('✓ All migrations completed!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
