// 轻量 UI 组件：toast、弹窗、确认框、输入框、进度

export function escapeHTML(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer = null;

export function toast(message, ms = 2200) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), ms);
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) {
    root.innerHTML = '';
    document.body.classList.remove('is-modal-open');
  }
}

export function openModal(html, { className = '', static: isStatic = false, onMount } = {}) {
  closeModal();
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${className}">${html}</div></div>`;
  const backdrop = root.firstElementChild;
  if (!isStatic) {
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) closeModal();
    });
  }
  document.body.classList.add('is-modal-open');
  if (onMount) onMount(backdrop.querySelector('.modal'));
  return {
    close: closeModal,
    modal: backdrop.querySelector('.modal')
  };
}

export function confirmDialog({ title, message = '', confirmText = '确定', cancelText = '取消', danger = false }) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      closeModal();
      resolve(value);
    };
    openModal(`
      <h3 class="modal-title">${escapeHTML(title)}</h3>
      ${message ? `<p class="modal-text">${escapeHTML(message)}</p>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-cancel>${escapeHTML(cancelText)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${escapeHTML(confirmText)}</button>
      </div>`,
    {
      static: true,
      onMount(modal) {
        modal.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
        modal.querySelector('[data-ok]').addEventListener('click', () => finish(true));
      }
    });
  });
}

export function promptDialog({ title, label = '', value = '', placeholder = '', maxlength = 20, confirmText = '保存' }) {
  return new Promise(resolve => {
    let done = false;
    const finish = result => {
      if (done) return;
      done = true;
      closeModal();
      resolve(result);
    };
    openModal(`
      <h3 class="modal-title">${escapeHTML(title)}</h3>
      ${label ? `<label class="modal-label" for="prompt-input">${escapeHTML(label)}</label>` : ''}
      <input id="prompt-input" class="modal-input" type="text" value="${escapeHTML(value)}"
        placeholder="${escapeHTML(placeholder)}" maxlength="${maxlength}" autocomplete="off">
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-cancel>取消</button>
        <button type="button" class="btn btn-primary" data-ok>${escapeHTML(confirmText)}</button>
      </div>`,
    {
      static: true,
      onMount(modal) {
        const input = modal.querySelector('#prompt-input');
        const submit = () => finish(input.value.trim());
        input.focus();
        input.select();
        input.addEventListener('keydown', event => {
          if (event.key === 'Enter') submit();
        });
        modal.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
        modal.querySelector('[data-ok]').addEventListener('click', submit);
      }
    });
  });
}

export function progressDialog(title, initialText = '请稍候…') {
  const { modal } = openModal(`
    <h3 class="modal-title">${escapeHTML(title)}</h3>
    <p class="modal-text progress-text">${escapeHTML(initialText)}</p>
    <div class="progress-track"><div class="progress-bar"></div></div>`,
  { static: true });
  const text = modal.querySelector('.progress-text');
  const bar = modal.querySelector('.progress-bar');
  return {
    update(message, percent) {
      text.textContent = message;
      if (typeof percent === 'number') bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    },
    close: closeModal
  };
}
