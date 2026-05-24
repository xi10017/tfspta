import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

let client = null;
let configured = false;

function isUsableSupabaseKey(key) {
  const value = String(key || '');
  if (!value || value.includes('YOUR_')) {
    return false;
  }
  // Supabase → Project Settings → API: legacy anon JWT (eyJ…) or publishable key (sb_publishable_…).
  return value.startsWith('eyJ') || value.startsWith('sb_publishable_');
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
