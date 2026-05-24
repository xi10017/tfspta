import { resetPasswordForEmail } from './auth.js';

export function initPasswordResetRequest({
  signinBlock,
  resetPanel,
  resetForm,
  resetMessage,
  forgotBtn,
  backBtn,
  getEmailFallback,
  showMessage,
}) {
  function showResetPanel() {
    signinBlock.hidden = true;
    resetPanel.hidden = false;
    const resetEmailInput = resetForm?.querySelector('#reset-email');
    if (resetEmailInput && getEmailFallback) {
      resetEmailInput.value = getEmailFallback() || '';
    }
    showMessage(resetMessage, '');
  }

  function showSigninPanel() {
    signinBlock.hidden = false;
    resetPanel.hidden = true;
    showMessage(resetMessage, '');
  }

  forgotBtn?.addEventListener('click', showResetPanel);
  backBtn?.addEventListener('click', showSigninPanel);

  resetForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage(resetMessage, '');

    const email = new FormData(resetForm).get('reset-email')?.trim();
    if (!email) {
      showMessage(resetMessage, 'Enter your email address.', 'error');
      return;
    }

    const submitButton = resetForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const { error } = await resetPasswordForEmail(email);
      if (error) {
        throw error;
      }
      showMessage(resetMessage, 'Check your email for a reset link.', 'success');
    } catch (error) {
      showMessage(resetMessage, error.message, 'error');
    } finally {
      submitButton.disabled = false;
    }
  });

  return { showSigninPanel, showResetPanel };
}
