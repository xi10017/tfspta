import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

let client = null;
let configured = false;

function isUsableSupabaseKey(key) {
  if (!key || String(key).includes('YOUR_')) {
    return false;
  }
  // Use the legacy anon JWT from Supabase → Settings → API (starts with eyJ).
  return String(key).startsWith('eyJ');
}

try {
  const { supabaseConfig } = await import('./supabase-config.js');
  const url = supabaseConfig?.url;
  const key = supabaseConfig?.anonKey;
  if (url && key && !url.includes('YOUR_PROJECT') && isUsableSupabaseKey(key)) {
    client = createClient(url, key);
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
