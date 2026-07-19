import { ensureAuthenticatedSession } from './auth.js';
import { isSupabaseConfigured, requireSupabase } from './supabase-client.js';
import { showMessage } from './ui-messages.js';
import {
  buildSubmissionPayload,
  escapeHtml,
  getSubmissionFormHtml,
  readPreviewValues,
  renderSubmissionPreview,
} from './submission-form.js';
import {
  attachSubmissionImage,
  initSubmissionImageField,
  syncSubmissionImageField,
} from './submission-images.js';
import {
  buildSubmissionInsertRecord,
  fillFormFromPayload,
  targetPublishedIdForType,
} from './submission-workflow.js';
import { notifyPendingContentChanged } from './pending-live.js';
import { recordSubmissionEvent } from './submission-events.js';
import { findPublishedRowByStaticEntryId } from './static-entry-supersede.js';

const controllers = new Map();

export function getContextualSubmitController(contentType) {
  return controllers.get(contentType);
}

function setHiddenField(form, name, value) {
  const field = form?.querySelector(`[name="${name}"]`);
  if (field) {
    field.value = value ?? '';
  }
}

async function resolveLiveTarget(supabase, contentType, payload, staticEntryId, explicitTargetId) {
  if (explicitTargetId) {
    return explicitTargetId;
  }

  if (contentType !== 'competition' && contentType !== 'club') {
    return null;
  }

  const existing = await findPublishedRowByStaticEntryId(supabase, contentType, staticEntryId, payload);
  return existing?.id || null;
}

export async function initContextualSubmit({ contentType, buttonLabel }) {
  const mount = document.getElementById('contextual-submit');
  if (!mount) {
    return null;
  }

  if (!isSupabaseConfigured) {
    mount.hidden = true;
    return null;
  }

  const session = await ensureAuthenticatedSession();
  if (!session) {
    mount.hidden = true;
    return null;
  }

  mount.hidden = false;
  mount.innerHTML = `
    <div class="contextual-submit-inner">
      <div class="contextual-submit-copy">
        <p class="contextual-submit-title" id="contextual-submit-title">Propose an update for this page</p>
        <p class="contextual-submit-text" id="contextual-submit-text">Draft it here and see a preview of how it will look after approval.</p>
      </div>
      <button type="button" class="btn btn-primary contextual-submit-btn" id="contextual-submit-open" aria-expanded="false">${escapeHtml(buttonLabel)}</button>
    </div>

    <div id="contextual-compose" class="contextual-compose" hidden>
      <div id="contextual-compose-message" class="alert-banner" hidden></div>
      <div class="contextual-compose-layout">
        <form id="contextual-compose-form" class="stack-form contextual-compose-form">
          <input type="hidden" name="_static_entry_id" value="">
          <input type="hidden" name="_target_published_id" value="">
          ${getSubmissionFormHtml(contentType)}
          <div class="contextual-compose-actions">
            <button class="btn btn-primary" type="submit" id="contextual-compose-submit">Submit for review</button>
            <button class="btn btn-secondary contextual-compose-cancel" type="button">Cancel</button>
          </div>
        </form>
        <div class="contextual-preview">
          <p class="contextual-preview-label">Preview on this page</p>
          <div id="contextual-preview-card" class="contextual-preview-card"></div>
        </div>
      </div>
      <p class="contextual-compose-footnote">Track status anytime on the <a href="submit.html">Submit page</a> under My submissions.</p>
    </div>
  `;

  const openBtn = mount.querySelector('#contextual-submit-open');
  const composePanel = mount.querySelector('#contextual-compose');
  const form = mount.querySelector('#contextual-compose-form');
  const previewCard = mount.querySelector('#contextual-preview-card');
  const messageEl = mount.querySelector('#contextual-compose-message');
  const cancelBtn = mount.querySelector('.contextual-compose-cancel');
  const submitBtn = mount.querySelector('#contextual-compose-submit');
  const titleEl = mount.querySelector('#contextual-submit-title');
  const textEl = mount.querySelector('#contextual-submit-text');

  initSubmissionImageField(form, {
    onPreviewChange: updatePreview,
    onError: (error) => showMessage(messageEl, error.message, 'error'),
  });

  let composeOpen = false;
  let composeMode = 'create';
  let changeRequestPublishedId = null;
  let staticEntryId = null;

  function resetComposeMode() {
    composeMode = 'create';
    changeRequestPublishedId = null;
    staticEntryId = null;
    setHiddenField(form, '_static_entry_id', '');
    setHiddenField(form, '_target_published_id', '');
    titleEl.textContent = 'Propose an update for this page';
    textEl.textContent = 'Draft it here and see a preview of how it will look after approval.';
    submitBtn.textContent = 'Submit for review';
    openBtn.textContent = buttonLabel;
  }

  function setChangeRequestContext({ publishedId, payload }) {
    composeMode = 'change_request';
    changeRequestPublishedId = publishedId;
    staticEntryId = payload?.static_entry_id || null;
    setHiddenField(form, '_static_entry_id', staticEntryId);
    setHiddenField(form, '_target_published_id', publishedId);
  }

  function updatePreview() {
    if (!previewCard || !form) {
      return;
    }
    const values = readPreviewValues(form, contentType);
    previewCard.innerHTML = renderSubmissionPreview(contentType, values, { ghost: true });
  }

  function scrollToCompose() {
    requestAnimationFrame(() => {
      mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function openCompose({ scroll = false } = {}) {
    composeOpen = true;
    composePanel.hidden = false;
    openBtn.textContent = 'Close';
    openBtn.setAttribute('aria-expanded', 'true');
    showMessage(messageEl, '');
    updatePreview();
    if (scroll) {
      scrollToCompose();
    }
    form.querySelector('[name="title"], [name="name"]')?.focus({ preventScroll: true });
  }

  function closeCompose() {
    composeOpen = false;
    composePanel.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
    form.reset();
    showMessage(messageEl, '');
    resetComposeMode();
    syncSubmissionImageField(form);
    updatePreview();
  }

  function toggleCompose() {
    if (composeOpen) {
      closeCompose();
    } else {
      resetComposeMode();
      openCompose();
    }
  }

  function openChangeRequest({ publishedId, payload, title }) {
    resetComposeMode();
    setChangeRequestContext({ publishedId, payload });
    titleEl.textContent = 'Request a change to a live item';
    textEl.textContent = title
      ? `Propose updates to “${title}”. A PTA admin will review before anything changes on the site.`
      : 'Propose updates to a published item. A PTA admin will review before anything changes on the site.';
    submitBtn.textContent = 'Submit change request';
    fillFormFromPayload(form, contentType, payload);
    syncSubmissionImageField(form);
    openCompose({ scroll: true });
  }

  async function openPrefilledCreate({ payload, title }) {
    resetComposeMode();
    staticEntryId = payload?.static_entry_id || null;

    if (staticEntryId && (contentType === 'competition' || contentType === 'club')) {
      try {
        const supabase = requireSupabase();
        const existing = await findPublishedRowByStaticEntryId(supabase, contentType, staticEntryId, payload);
        if (existing?.id) {
          openChangeRequest({
            publishedId: existing.id,
            payload,
            title,
          });
          return;
        }
      } catch {
        // Fall through to first-time static replacement flow.
      }
    }

    setHiddenField(form, '_static_entry_id', staticEntryId);
    titleEl.textContent = 'Request a change to a listing';
    textEl.textContent = title
      ? `Propose updates to “${title}”. A PTA admin will review before anything changes on the site.`
      : 'Propose updates to this listing. A PTA admin will review before anything changes on the site.';
    submitBtn.textContent = 'Submit change request';
    fillFormFromPayload(form, contentType, payload);
    syncSubmissionImageField(form);
    openCompose({ scroll: true });
  }

  openBtn?.addEventListener('click', toggleCompose);
  cancelBtn?.addEventListener('click', closeCompose);
  form?.addEventListener('input', updatePreview);
  form?.addEventListener('change', updatePreview);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage(messageEl, '');

    const activeSession = await ensureAuthenticatedSession();
    if (!activeSession) {
      showMessage(messageEl, 'Please sign in to submit.', 'error');
      return;
    }

    const payload = buildSubmissionPayload(new FormData(form), contentType);
    const hiddenStaticId = form.querySelector('[name="_static_entry_id"]')?.value || '';
    const hiddenTargetId = form.querySelector('[name="_target_published_id"]')?.value || '';
    staticEntryId = staticEntryId || hiddenStaticId || null;
    changeRequestPublishedId = changeRequestPublishedId || hiddenTargetId || null;

    if (staticEntryId) {
      payload.static_entry_id = staticEntryId;
    }

    submitBtn.disabled = true;

    try {
      await attachSubmissionImage(payload, form, {
        submitterId: activeSession.user.id,
        contentType,
      });

      const supabase = requireSupabase();
      const resolvedTargetId = await resolveLiveTarget(
        supabase,
        contentType,
        payload,
        staticEntryId,
        changeRequestPublishedId,
      );

      const targetId = resolvedTargetId || changeRequestPublishedId;
      const useEditPublished =
        composeMode === 'change_request' || Boolean(targetId);

      const record = buildSubmissionInsertRecord({
        contentType,
        payload,
        submitterId: activeSession.user.id,
        intent: useEditPublished ? 'edit_published' : 'create',
        ...targetPublishedIdForType(contentType, useEditPublished ? targetId : null),
      });

      const { data: created, error } = await supabase.from('submissions').insert(record).select('id').single();

      if (error) {
        throw error;
      }

      await recordSubmissionEvent(created.id, 'submitted', activeSession.user.id);

      form.reset();
      syncSubmissionImageField(form);
      updatePreview();
      showMessage(
        messageEl,
        useEditPublished
          ? 'Change request submitted for review.'
          : 'Submitted for review. It will appear on this page after a PTA admin approves it.',
        'success',
      );
      resetComposeMode();
      notifyPendingContentChanged();
    } catch (error) {
      showMessage(messageEl, error.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  updatePreview();

  const controller = { openChangeRequest, openPrefilledCreate, closeCompose };
  controllers.set(contentType, controller);
  return controller;
}

export function bindPublishedChangeRequests(root, contentType) {
  if (!root) {
    return;
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="request-change"]');
    if (!button) {
      return;
    }

    const controller = getContextualSubmitController(contentType);
    if (!controller) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(decodeURIComponent(button.dataset.payload || '%7B%7D'));
    } catch {
      payload = {};
    }

    const article = button.closest('article[data-published-id]');
    const publishedId = button.dataset.publishedId || article?.dataset.publishedId || '';

    if (!publishedId) {
      return;
    }

    controller.openChangeRequest({
      publishedId,
      payload,
      title: button.dataset.title || '',
    });
  });
}
