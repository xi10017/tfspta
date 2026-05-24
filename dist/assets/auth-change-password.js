import { changePassword } from './auth.js';

export function initChangePassword({ toggleBtn, panel, form, messageEl, showMessage }) {
  toggleBtn?.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      form?.reset();
      showMessage(messageEl, '');
      panel.querySelector('#new-password')?.focus();
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage(messageEl, '');

    const formData = new FormData(form);
    const newPassword = formData.get('new-password');
    const confirmPassword = formData.get('confirm-password');

    if (newPassword !== confirmPassword) {
      showMessage(messageEl, 'New passwords do not match.', 'error');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      await changePassword(newPassword);
      form.reset();
      showMessage(messageEl, 'Password updated.', 'success');
    } catch (error) {
      showMessage(messageEl, error.message, 'error');
    } finally {
      submitButton.disabled = false;
    }
  });
}
