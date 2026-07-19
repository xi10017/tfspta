import { getSession, getProfile, isAdmin, signIn, signUp, signOut, ensureProfile, ensureAuthenticatedSession } from './auth.js';
import { initPasswordResetRequest } from './auth-reset-request.js';
import { initChangePassword } from './auth-change-password.js';
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
  INTENT_LABELS,
} from './submission-workflow.js';
import { notifyPendingContentChanged } from './pending-live.js';
import { applyConfigNoticeContent } from './config-notice.js';
import { requireSupabase, isSupabaseConfigured } from './supabase-client.js';
import {
  loadSubmissionEventsMap,
  recordSubmissionEvent,
  renderEventTimeline,
} from './submission-events.js';

const authPanel = document.getElementById('auth-panel');
const signinBlock = document.getElementById('signin-block');
const resetPanel = document.getElementById('reset-panel');
const submitPanel = document.getElementById('submit-panel');
const configNotice = document.getElementById('config-notice');
applyConfigNoticeContent(configNotice);
const authForm = document.getElementById('auth-form');
const resetForm = document.getElementById('reset-form');
const submitForm = document.getElementById('submit-form');
const contentTypeSelect = document.getElementById('content-type');
const typeFields = document.getElementById('type-fields');
const tabSignIn = document.getElementById('tab-signin');
const tabSignUp = document.getElementById('tab-signup');
const authHeading = document.getElementById('auth-heading');
const authIntro = document.getElementById('auth-intro');
const authSubmit = document.getElementById('auth-submit');
const authMessage = document.getElementById('auth-message');
const resetMessage = document.getElementById('reset-message');
const submitMessage = document.getElementById('submit-message');
const signOutBtn = document.getElementById('sign-out-btn');
const userLabel = document.getElementById('user-label');
const forgotPasswordWrap = document.getElementById('forgot-password-wrap');
const changePasswordMessage = document.getElementById('change-password-message');
const mySubmissionsEl = document.getElementById('my-submissions');
const tabSubmitNew = document.getElementById('tab-submit-new');
const tabMySubmissions = document.getElementById('tab-my-submissions');
const submitNewPanel = document.getElementById('submit-new-panel');
const mySubmissionsPanel = document.getElementById('my-submissions-panel');
const submitPreviewCard = document.getElementById('submit-preview-card');
const submitDraftNotice = document.getElementById('submit-draft-notice');
const submitFormSubmit = document.getElementById('submit-form-submit');
const submitDraftCancel = document.getElementById('submit-draft-cancel');

const STATUS_LABELS = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Not approved',
  archived: 'Archived',
};

let authMode = 'signin';
let draftMode = null;

function showDraftNotice(message) {
  if (!submitDraftNotice) {
    return;
  }
  submitDraftNotice.textContent = message;
  submitDraftNotice.hidden = false;
}

function clearDraft() {
  draftMode = null;
  if (contentTypeSelect) {
    contentTypeSelect.disabled = false;
  }
  if (submitDraftNotice) {
    submitDraftNotice.hidden = true;
    submitDraftNotice.textContent = '';
  }
  if (submitFormSubmit) {
    submitFormSubmit.textContent = 'Submit for review';
  }
  if (submitDraftCancel) {
    submitDraftCancel.hidden = true;
  }
  submitForm?.reset();
  renderTypeFields();
}

function startEditingSubmission(item, action) {
  draftMode = {
    action,
    submissionId: item.id,
    contentType: item.content_type,
    priorIntent: item.intent || 'create',
  };

  contentTypeSelect.value = item.content_type;
  contentTypeSelect.disabled = true;
  renderTypeFields();
  fillFormFromPayload(submitForm, item.content_type, item.payload);
  syncSubmissionImageField(submitForm);
  updateSubmitPreview();

  const title = submissionDisplayTitle(item.payload);
  if (action === 'resubmit') {
    showDraftNotice(`Editing “${title}” to resubmit after rejection. Your changes go back into the review queue.`);
    submitFormSubmit.textContent = 'Resubmit for review';
  } else {
    showDraftNotice(`Editing “${title}” while it is still in review.`);
    submitFormSubmit.textContent = 'Save changes';
  }

  submitDraftCancel.hidden = false;
  setSubmitTab('new');
  submitForm?.querySelector('[name="title"], [name="name"]')?.focus();
}

const SUBMIT_TYPE_KEY = 'submit-content-type';
const SUBMIT_TYPES = new Set(['announcement', 'event', 'competition', 'club']);

function submissionDisplayTitle(payload) {
  return payload?.title || payload?.name || 'Untitled';
}

function submissionDisplayMeta(item) {
  const payload = item.payload || {};
  if (item.content_type === 'competition') {
    return payload.category || 'MISC';
  }
  if (item.content_type === 'club') {
    return payload.school || 'District-wide';
  }
  return payload.school || 'District-wide';
}

function renderTypeFields() {
  const type = contentTypeSelect.value;
  typeFields.innerHTML = getSubmissionFormHtml(type, { idPrefix: '' });
  initSubmissionImageField(submitForm, {
    onPreviewChange: updateSubmitPreview,
    onError: (error) => showMessage(submitMessage, error.message, 'error'),
  });
  updateSubmitPreview();
}

function updateSubmitPreview() {
  if (!submitPreviewCard || !submitForm) {
    return;
  }

  const type = contentTypeSelect.value;
  const values = readPreviewValues(submitForm, type);
  submitPreviewCard.innerHTML = renderSubmissionPreview(type, values, { ghost: true });
}

function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

let mySubmissionsCache = [];

function renderMySubmissions(items, eventsBySubmission = new Map()) {
  if (!mySubmissionsEl) {
    return;
  }

  mySubmissionsCache = items;

  if (!items.length) {
    mySubmissionsEl.innerHTML = '<p class="empty-inbox">You have not submitted anything yet.</p>';
    return;
  }

  mySubmissionsEl.innerHTML = items
    .map((item) => {
      const title = submissionDisplayTitle(item.payload);
      const campus = submissionDisplayMeta(item);
      const statusLabel = STATUS_LABELS[item.status] || item.status;
      const intentLabel = item.intent && item.intent !== 'create' ? INTENT_LABELS[item.intent] : '';
      const timeline = renderEventTimeline(eventsBySubmission.get(item.id) || [], { forParent: true });

      return `
        <article class="submission-card" data-id="${item.id}">
          <div class="submission-card-header">
            <div>
              <span class="inbox-type">${escapeHtml(item.content_type)}</span>
              <span class="inbox-status inbox-status--${escapeHtml(item.status)}">${escapeHtml(statusLabel)}</span>
              ${intentLabel ? `<span class="submission-intent">${escapeHtml(intentLabel)}</span>` : ''}
            </div>
            <time datetime="${item.created_at}">${formatDate(item.created_at)}</time>
          </div>
          <h4 class="submission-card-title">${escapeHtml(title)}</h4>
          <p class="submission-card-meta">${escapeHtml(campus)}</p>
          ${
            item.status === 'approved' && item.intent === 'edit_published'
              ? '<p class="submission-card-note submission-card-note--success">Change request approved — the live item was updated.</p>'
              : item.status === 'approved'
                ? '<p class="submission-card-note submission-card-note--success">Published on the site after admin approval.</p>'
                : ''
          }
          ${
            item.status === 'pending' && item.intent === 'edit_published'
              ? '<p class="submission-card-note">Waiting for admin approval to update a live item on the site.</p>'
              : ''
          }
          ${
            item.status === 'archived'
              ? '<p class="submission-card-note">Archived by PTA — no longer on the public site.</p>'
              : ''
          }
          ${timeline}
          ${
            item.review_notes
              ? `<p class="submission-card-note"><strong>Latest note from PTA:</strong> ${escapeHtml(item.review_notes)}</p>`
              : ''
          }
          ${
            item.status === 'pending'
              ? `<div class="submission-card-actions">
                  <button type="button" class="btn btn-secondary btn-sm" data-action="edit-submission" data-id="${item.id}">Edit</button>
                  <button type="button" class="btn btn-secondary btn-sm" data-action="withdraw-submission" data-id="${item.id}">Withdraw</button>
                </div>`
              : item.status === 'rejected' && item.intent !== 'edit_published'
                ? `<div class="submission-card-actions">
                    <button type="button" class="btn btn-secondary btn-sm" data-action="resubmit-submission" data-id="${item.id}">Edit and resubmit</button>
                  </div>`
                : ''
          }
        </article>
      `;
    })
    .join('');
}

async function loadMySubmissions() {
  if (!mySubmissionsEl) {
    return;
  }

  const session = await ensureAuthenticatedSession();
  if (!session) {
    mySubmissionsEl.innerHTML = '';
    return;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('submissions')
    .select('id, content_type, payload, status, review_notes, created_at, intent')
    .order('created_at', { ascending: false });

  if (error) {
    mySubmissionsEl.innerHTML = `<p class="form-message form-message--error">${escapeHtml(error.message)}</p>`;
    return;
  }

  const items = data || [];
  let eventsBySubmission = new Map();

  try {
    eventsBySubmission = await loadSubmissionEventsMap(items.map((item) => item.id));
  } catch (eventsError) {
    if (!eventsError.message?.includes('submission_events')) {
      mySubmissionsEl.innerHTML = `<p class="form-message form-message--error">${escapeHtml(eventsError.message)}</p>`;
      return;
    }
  }

  renderMySubmissions(items, eventsBySubmission);
}

async function updateSubmissionDraft({ submissionId, payload, intent }) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('submissions')
    .update({
      payload,
      intent,
      status: 'pending',
      review_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId);

  if (error) {
    throw error;
  }
}

async function withdrawSubmission(id) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('submissions').delete().eq('id', id).eq('status', 'pending');

  if (error) {
    throw error;
  }
}

async function refreshUI() {
  if (!isSupabaseConfigured) {
    configNotice.hidden = false;
    authPanel.hidden = true;
    submitPanel.hidden = true;
    return;
  }

  configNotice.hidden = true;
  const session = await ensureAuthenticatedSession();

  if (!session) {
    authPanel.hidden = false;
    submitPanel.hidden = true;
    userLabel.textContent = '';
    showSigninPanel();
    return;
  }

  const profile = await getProfile();
  authPanel.hidden = true;
  submitPanel.hidden = false;
  userLabel.textContent = profile?.full_name || session.user.email || 'Signed in';

  const adminLink = document.getElementById('admin-link');
  if (adminLink) {
    adminLink.hidden = !isAdmin(profile);
  }

  await loadMySubmissions();
  applyStoredSubmitType();
}

function captureSubmitTypeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  if (!SUBMIT_TYPES.has(type)) {
    return;
  }

  sessionStorage.setItem(SUBMIT_TYPE_KEY, type);
  params.delete('type');
  const qs = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
}

function applyStoredSubmitType() {
  const type = sessionStorage.getItem(SUBMIT_TYPE_KEY);
  if (!SUBMIT_TYPES.has(type)) {
    return;
  }

  contentTypeSelect.value = type;
  renderTypeFields();
  setSubmitTab('new');
  sessionStorage.removeItem(SUBMIT_TYPE_KEY);
}

function setSubmitTab(mode) {
  const isHistory = mode === 'history';

  tabSubmitNew?.classList.toggle('is-active', !isHistory);
  tabMySubmissions?.classList.toggle('is-active', isHistory);
  tabSubmitNew?.setAttribute('aria-selected', String(!isHistory));
  tabMySubmissions?.setAttribute('aria-selected', String(isHistory));

  if (submitNewPanel) {
    submitNewPanel.hidden = isHistory;
  }
  if (mySubmissionsPanel) {
    mySubmissionsPanel.hidden = !isHistory;
  }

  if (isHistory) {
    loadMySubmissions();
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignUp = mode === 'signup';

  tabSignIn?.classList.toggle('is-active', !isSignUp);
  tabSignUp?.classList.toggle('is-active', isSignUp);
  tabSignIn?.setAttribute('aria-selected', String(!isSignUp));
  tabSignUp?.setAttribute('aria-selected', String(isSignUp));

  authForm.querySelector('#full-name-wrap').hidden = !isSignUp;
  authHeading.textContent = isSignUp ? 'Create a parent account' : 'Sign in to contribute';
  authIntro.textContent = isSignUp
    ? 'New here? Sign up with your email to submit announcements and events for review.'
    : 'Enter your email and password to submit updates.';
  authSubmit.textContent = isSignUp ? 'Create account' : 'Sign in';
  if (forgotPasswordWrap) {
    forgotPasswordWrap.hidden = isSignUp;
  }
  showMessage(authMessage, '');
}

const { showSigninPanel } = initPasswordResetRequest({
  signinBlock,
  resetPanel,
  resetForm,
  resetMessage,
  forgotBtn: document.getElementById('forgot-password-btn'),
  backBtn: document.getElementById('reset-back-btn'),
  getEmailFallback: () => authForm?.querySelector('#email')?.value.trim(),
  showMessage,
});

document.getElementById('reset-back-btn')?.addEventListener('click', () => {
  setAuthMode('signin');
});

initChangePassword({
  toggleBtn: document.getElementById('change-password-toggle'),
  panel: document.getElementById('change-password-panel'),
  form: document.getElementById('change-password-form'),
  messageEl: changePasswordMessage,
  showMessage,
});

tabSignIn?.addEventListener('click', () => {
  showSigninPanel();
  setAuthMode('signin');
});
tabSignUp?.addEventListener('click', () => {
  showSigninPanel();
  setAuthMode('signup');
});

tabSubmitNew?.addEventListener('click', () => setSubmitTab('new'));
tabMySubmissions?.addEventListener('click', () => setSubmitTab('history'));

mySubmissionsEl?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }

  const id = button.dataset.id;
  if (!id) {
    return;
  }

  const action = button.dataset.action;

  if (action === 'edit-submission' || action === 'resubmit-submission') {
    const item = mySubmissionsCache.find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    startEditingSubmission(item, action === 'resubmit-submission' ? 'resubmit' : 'update_pending');
    return;
  }

  if (action !== 'withdraw-submission') {
    return;
  }

  const title = button.closest('.submission-card')?.querySelector('.submission-card-title')?.textContent || 'this submission';
  if (!window.confirm(`Withdraw "${title}"? It will be removed from the review queue.`)) {
    return;
  }

  button.disabled = true;
  try {
    await withdrawSubmission(id);
    if (draftMode?.submissionId === id) {
      clearDraft();
    }
    await loadMySubmissions();
    notifyPendingContentChanged();
  } catch (error) {
    showMessage(null, error.message, 'error');
    button.disabled = false;
  }
});

submitDraftCancel?.addEventListener('click', () => {
  clearDraft();
  showMessage(submitMessage, '');
});

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(authMessage, '');

  const formData = new FormData(authForm);
  const email = formData.get('email').trim();
  const password = formData.get('password');
  const fullName = formData.get('full-name')?.trim() || '';

  try {
    if (authMode === 'signup') {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        throw error;
      }
      showMessage(authMessage, 'Account created. You can sign in now.', 'success');
      setAuthMode('signin');
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        throw error;
      }
      await ensureProfile((await getSession()));
      await refreshUI();
    }
  } catch (error) {
    showMessage(authMessage, error.message, 'error');
  }
});

signOutBtn?.addEventListener('click', async () => {
  await signOut();
  await refreshUI();
});

contentTypeSelect?.addEventListener('change', () => {
  if (!draftMode) {
    renderTypeFields();
  }
});
submitForm?.addEventListener('input', updateSubmitPreview);
submitForm?.addEventListener('change', updateSubmitPreview);

submitForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(submitMessage, '');

  const session = await getSession();
  if (!session) {
    showMessage(submitMessage, 'Please sign in first.', 'error');
    return;
  }

  const type = contentTypeSelect.value;
  const formData = new FormData(submitForm);
  const payload = buildSubmissionPayload(formData, type);
  const supabase = requireSupabase();
  const submitButton = submitFormSubmit || submitForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    await attachSubmissionImage(payload, submitForm, {
      submitterId: session.user.id,
      contentType: type,
    });

    if (draftMode) {
      const wasResubmit = draftMode.action === 'resubmit';
      const intent =
        draftMode.priorIntent === 'edit_published'
          ? 'edit_published'
          : wasResubmit
            ? 'resubmit'
            : 'update_pending';
      await updateSubmissionDraft({
        submissionId: draftMode.submissionId,
        payload,
        intent,
      });
      clearDraft();
      showMessage(
        submitMessage,
        wasResubmit
          ? 'Resubmitted for review. A PTA admin will take another look.'
          : 'Changes saved. Your submission is still in the review queue.',
        'success',
      );
    } else {
      const record = buildSubmissionInsertRecord({
        contentType: type,
        payload,
        submitterId: session.user.id,
      });
      const { data: created, error } = await supabase.from('submissions').insert(record).select('id').single();

      if (error) {
        throw error;
      }

      await recordSubmissionEvent(created.id, 'submitted', session.user.id);

      submitForm.reset();
      renderTypeFields();
      syncSubmissionImageField(submitForm);
      updateSubmitPreview();
      showMessage(submitMessage, 'Submitted for review. A PTA admin will approve it before it appears on the site.', 'success');
    }

    setSubmitTab('history');
    notifyPendingContentChanged();
  } catch (error) {
    showMessage(submitMessage, error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

renderTypeFields();
setAuthMode('signin');
setSubmitTab('new');
captureSubmitTypeFromUrl();

if (new URLSearchParams(window.location.search).get('reset') === 'success') {
  showMessage(authMessage, 'Password updated. Sign in with your new password.', 'success');
  showSigninPanel();
  window.history.replaceState({}, '', window.location.pathname);
}

refreshUI();

if (isSupabaseConfigured) {
  requireSupabase().auth.onAuthStateChange(() => {
    refreshUI();
  });
}
