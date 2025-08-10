const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function ensureConstraints() {
  const sql = `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='subscription_plans_slug_key') THEN
        ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_slug_key UNIQUE (slug);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname='organizations_slug_key'
      ) THEN
        CREATE UNIQUE INDEX organizations_slug_key ON public.organizations(slug);
      END IF;
    END $$;`;

  // Prefer exec_sql RPC if present; otherwise log SQL for manual run
  try {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.log('Could not apply constraints via RPC. Run this SQL manually in Supabase SQL Editor:\n', sql);
    } else {
      console.log('Constraints ensured.');
    }
  } catch (_) {
    console.log('Please run this SQL manually in Supabase SQL Editor:\n', sql);
  }
}

async function seedPlans() {
  const plans = [
    { name: 'Starter', slug: 'starter', description: 'Perfect for small salons just getting started', price_monthly: 2900, price_yearly: 29000, max_users: 5, max_locations: 1, features: { appointments: true, clients: true, staff: true, services: true, basic_reports: true, inventory: false }, is_active: true, sort_order: 1 },
    { name: 'Professional', slug: 'professional', description: 'For growing salons with multiple staff members', price_monthly: 5900, price_yearly: 59000, max_users: 25, max_locations: 3, features: { appointments: true, clients: true, staff: true, services: true, inventory: true, basic_reports: true, advanced_reports: true, pos: true, accounting: true }, is_active: true, sort_order: 2 },
    { name: 'Enterprise', slug: 'enterprise', description: 'For large salon chains with advanced needs', price_monthly: 9900, price_yearly: 99000, max_users: 100, max_locations: 10, features: { appointments: true, clients: true, staff: true, services: true, inventory: true, basic_reports: true, advanced_reports: true, pos: true, accounting: true, api_access: true, white_label: true }, is_active: true, sort_order: 3 },
  ];

  const { error } = await supabase.from('subscription_plans').upsert(plans, { onConflict: 'slug' });
  if (error) console.error('Seed error', error);
  else console.log('Plans ensured');
}

(async () => {
  await ensureConstraints();
  await seedPlans();
})();