import { escapeHtml } from './submission-form.js';
import { getContextualSubmitController } from './contextual-submit.js';
import { isSupersededStaticEntry } from './static-entry-supersede.js';

function isEditableStaticEntry(article) {
  if (!article) {
    return false;
  }

  if (isSupersededStaticEntry(article)) {
    return false;
  }

  if (article.classList.contains('live-injected') || article.classList.contains('ghost-preview-card')) {
    return false;
  }

  if (article.dataset.publishedId) {
    return false;
  }

  if (article.querySelector('[data-action="request-change"], [data-action="request-change-static"]')) {
    return false;
  }

  return true;
}

export function addStaticEntryChangeButtons(root, articleSelector, parsePayload) {
  if (!root) {
    return;
  }

  root.querySelectorAll(articleSelector).forEach((article) => {
    if (!isEditableStaticEntry(article)) {
      return;
    }

    const payload = parsePayload(article);
    const title = payload.name || '';
    const encodedPayload = encodeURIComponent(JSON.stringify(payload));

    const actions = document.createElement('div');
    actions.className = 'published-item-actions';
    actions.innerHTML = `
      <button
        type="button"
        class="text-link published-change-link"
        data-action="request-change-static"
        data-title="${escapeHtml(title)}"
        data-payload="${encodedPayload}"
      >Request a change</button>
    `;

    article.appendChild(actions);
  });
}

export function bindStaticEntryChangeRequests(root, contentType) {
  if (!root) {
    return;
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="request-change-static"]');
    if (!button) {
      return;
    }

    const controller = getContextualSubmitController(contentType);
    if (!controller?.openPrefilledCreate) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(decodeURIComponent(button.dataset.payload || '%7B%7D'));
    } catch {
      payload = {};
    }

    controller.openPrefilledCreate({
      payload,
      title: button.dataset.title || '',
    });
  });
}
