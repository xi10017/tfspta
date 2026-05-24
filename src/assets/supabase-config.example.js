// Copy this file to supabase-config.js and fill in your Supabase project values.
// Project Settings → API → Project URL and the legacy anon public key (JWT, starts with eyJ).
// Do not use the newer "publishable" key (sb_publishable_...) here — it will not work with this site yet.
//
// For password reset emails, add your site URL under Authentication → URL Configuration
// (Site URL and Redirect URLs must include .../reset-password.html).
export const supabaseConfig = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_ANON_KEY',
};
