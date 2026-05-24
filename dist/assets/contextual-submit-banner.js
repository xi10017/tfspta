import { ensureAuthenticatedSession } from './auth.js';
import { isSupabaseConfigured } from './supabase-client.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function initContextualSubmitBanner({ contentType, buttonLabel }) {
  const mount = document.getElementById('contextual-submit');
  if (!mount) {
    return;
  }

  if (!isSupabaseConfigured) {
    mount.hidden = true;
    return;
  }

  const session = await ensureAuthenticatedSession();
  if (!session) {
    mount.hidden = true;
    return;
  }

  mount.hidden = false;
  mount.innerHTML = `
    <div class="contextual-submit-inner">
      <div class="contextual-submit-copy">
        <p class="contextual-submit-title">Propose an update for this page</p>
        <p class="contextual-submit-text">You're signed in. Submit something here — a PTA admin will review it before it goes live.</p>
      </div>
      <a class="btn btn-primary contextual-submit-btn" href="submit.html?type=${encodeURIComponent(contentType)}">${escapeHtml(buttonLabel)}</a>
    </div>
  `;
}
