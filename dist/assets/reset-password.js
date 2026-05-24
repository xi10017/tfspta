import { updatePassword, signOut } from './auth.js';
import { showMessage } from './ui-messages.js';
import { requireSupabase, isSupabaseConfigured } from './supabase-client.js';

const configNotice = document.getElementById('config-notice');
const resetPanel = document.getElementById('reset-panel');
const invalidPanel = document.getElementById('invalid-panel');
const resetForm = document.getElementById('reset-form');
const resetMessage = document.getElementById('reset-message');

let recoveryReady = false;

function showResetForm() {
  recoveryReady = true;
  configNotice.hidden = true;
  resetPanel.hidden = false;
  invalidPanel.hidden = true;
}

function showInvalidPanel() {
  configNotice.hidden = true;
  resetPanel.hidden = true;
  invalidPanel.hidden = false;
}

async function init() {
  if (!isSupabaseConfigured) {
    configNotice.hidden = false;
    resetPanel.hidden = true;
    invalidPanel.hidden = true;
    return;
  }

  const supabase = requireSupabase();
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const isRecoveryLink = hashParams.get('type') === 'recovery';

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      showResetForm();
    }
  });

  if (isRecoveryLink) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      showResetForm();
      return;
    }

    window.setTimeout(async () => {
      if (recoveryReady) {
        return;
      }
      const { data: { session: retrySession } } = await supabase.auth.getSession();
      if (retrySession) {
        showResetForm();
      } else {
        showInvalidPanel();
      }
    }, 750);
    return;
  }

  showInvalidPanel();
}

resetForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(resetMessage, '');

  const formData = new FormData(resetForm);
  const password = formData.get('new-password');
  const confirmPassword = formData.get('confirm-password');

  if (password !== confirmPassword) {
    showMessage(resetMessage, 'Passwords do not match.', 'error');
    return;
  }

  const submitButton = resetForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const { error } = await updatePassword(password);
    if (error) {
      const message = error.message?.toLowerCase() || '';
      if (!message.includes('different from the old') && !message.includes('same as')) {
        throw error;
      }
    }

    await signOut();
    window.location.href = 'submit.html?reset=success';
  } catch (error) {
    showMessage(resetMessage, error.message, 'error');
    submitButton.disabled = false;
  }
});

init();
