/** Fills #config-notice with local vs GitHub Pages setup instructions. */
export function applyConfigNoticeContent(noticeEl) {
  if (!noticeEl) {
    return;
  }

  const onGitHubPages = /\.github\.io$/i.test(window.location.hostname);

  if (onGitHubPages) {
    noticeEl.innerHTML = `
      <h2>Setup required</h2>
      <p>This site is missing Supabase credentials in the last deploy.</p>
      <ol>
        <li>In GitHub: <strong>Settings → Secrets and variables → Actions</strong>, add <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> (from Supabase → Project Settings → API).</li>
        <li><strong>Actions → Deploy GitHub Pages → Run workflow</strong>, wait until it finishes green.</li>
        <li>Hard-refresh this page.</li>
      </ol>
      <p>If you already added secrets, the deploy may have run <em>before</em> they existed — run the workflow again.</p>
    `;
    return;
  }

  noticeEl.innerHTML = `
    <h2>Setup required</h2>
    <p>Copy <code>src/assets/supabase-config.example.js</code> to <code>src/assets/supabase-config.js</code>, add your Supabase URL and anon key, then run <code>npm run build</code>.</p>
    <p>Also run <code>supabase/schema.sql</code> in your Supabase SQL editor.</p>
  `;
}
