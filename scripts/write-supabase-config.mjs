/**
 * Writes dist/assets/supabase-config.js from env (used in GitHub Actions).
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '..', 'dist', 'assets', 'supabase-config.js');

const url = process.env.SUPABASE_URL?.trim();
const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

if (!url || !anonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const contents = `// Generated at deploy time — do not commit.
export const supabaseConfig = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)},
};
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, contents, 'utf8');
console.log('Wrote dist/assets/supabase-config.js');
