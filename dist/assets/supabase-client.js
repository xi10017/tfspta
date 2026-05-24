import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

let client = null;
let configured = false;

try {
  const { supabaseConfig } = await import('./supabase-config.js');
  if (supabaseConfig?.url && supabaseConfig?.anonKey && !supabaseConfig.url.includes('YOUR_PROJECT')) {
    client = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    configured = true;
  }
} catch {
  configured = false;
}

export const supabase = client;
export const isSupabaseConfigured = configured;

export function requireSupabase() {
  if (!client) {
    throw new Error('Supabase is not configured. Copy supabase-config.example.js to supabase-config.js.');
  }
  return client;
}
