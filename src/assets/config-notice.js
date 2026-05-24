/** Fills #config-notice with local vs GitHub Pages setup instructions. */
export function applyConfigNoticeContent(noticeEl) {
  if (!noticeEl) {
    return;
  }

  const onGitHubPages = /\.github\.io$/i.test(window.location.hostname);

  if (onGitHubPages) {
    const onWrongPath = /\/dist\//i.test(window.location.pathname);
    noticeEl.innerHTML = `
      <h2>Setup required</h2>
      ${
        onWrongPath
          ? `<p>You are on <code>/dist/…</code> from an old branch deploy. Use <a href="${window.location.pathname.replace(/\/dist\/.*/, '/submit.html')}">the Actions-built URL</a> after fixing Pages (below).</p>`
          : ''
      }
      <ol>
        <li><strong>Settings → Pages</strong> → Build and deployment → Source must be <strong>GitHub Actions</strong> (not “Deploy from a branch”).</li>
        <li><strong>Settings → Secrets → Actions</strong>: <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> (Supabase → API → Project URL + legacy <strong>anon</strong> JWT starting with <code>eyJ</code>, not <code>sb_publishable_</code>).</li>
        <li><strong>Actions → Deploy GitHub Pages → Run workflow</strong> until green.</li>
        <li>Open <a href="https://xi10017.github.io/tfspta/submit.html">https://xi10017.github.io/tfspta/submit.html</a> (no <code>/dist/</code> in the path).</li>
      </ol>
    `;
    return;
  }

  noticeEl.innerHTML = `
    <h2>Setup required</h2>
    <p>Copy <code>src/assets/supabase-config.example.js</code> to <code>src/assets/supabase-config.js</code>. Use the legacy <strong>anon</strong> JWT (<code>eyJ…</code>) from Supabase → API, then run <code>npm run build</code>.</p>
    <p>Also run <code>supabase/schema.sql</code> in your Supabase SQL editor.</p>
  `;
}
