let toastHost = null;

function ensureToastHost() {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    toastHost.setAttribute('aria-live', 'polite');
    toastHost.setAttribute('aria-relevant', 'additions');
    document.body.appendChild(toastHost);
  }

  return toastHost;
}

export function showToast(text, type = 'info', { duration = 5000 } = {}) {
  if (!text) {
    return;
  }

  const host = ensureToastHost();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = text;

  const dismiss = () => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 250);
  };

  toast.addEventListener('click', dismiss);
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  if (duration > 0) {
    window.setTimeout(dismiss, duration);
  }
}

export function showUndoToast(message, onUndo, { duration = 10000 } = {}) {
  if (!message || typeof onUndo !== 'function') {
    return;
  }

  const host = ensureToastHost();
  const toast = document.createElement('div');
  toast.className = 'toast toast--success toast--with-action';
  toast.setAttribute('role', 'status');

  let dismissed = false;
  let timeoutId = null;

  const dismiss = () => {
    if (dismissed) {
      return;
    }
    dismissed = true;
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 250);
  };

  const textEl = document.createElement('span');
  textEl.className = 'toast-text';
  textEl.textContent = message;

  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.className = 'toast-undo-btn';
  undoBtn.textContent = 'Undo';

  undoBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    dismiss();
    onUndo();
  });

  toast.addEventListener('click', dismiss);
  toast.append(textEl, undoBtn);
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  if (duration > 0) {
    timeoutId = window.setTimeout(dismiss, duration);
  }
}

export function showMessage(el, text, type = 'info') {
  if (!text) {
    if (el) {
      el.hidden = true;
      el.textContent = '';
      el.removeAttribute('role');
    }
    return;
  }

  if (type === 'success' || type === 'info') {
    showToast(text, type);
    if (el) {
      el.hidden = true;
      el.textContent = '';
      el.removeAttribute('role');
    }
    return;
  }

  if (!el) {
    showToast(text, type, { duration: 8000 });
    return;
  }

  el.textContent = text;
  el.className = `alert-banner alert-banner--${type}`;
  el.hidden = false;
  el.setAttribute('role', 'alert');
}
