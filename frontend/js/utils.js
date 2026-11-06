// utils.js — shared utilities
const utils = {
  fmtMoney(cents) {
    if (cents === null || cents === undefined) return '$0.00';
    return '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  },
  timeAgo(ts) {
    if (!ts) return '';
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
    return Math.floor(diff / 86400) + ' days ago';
  },
  applySiteFont(font) {
    if (!font) return;
    const fam = String(font).trim();
    if (!fam) return;
    if (fam !== 'Inter' && !document.getElementById('site-font-link')) {
      const l = document.createElement('link');
      l.id = 'site-font-link'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + fam.replace(/ /g, '+') + ':wght@400;500;600;700;800&display=swap';
      document.head.appendChild(l);
    }
    document.body.style.fontFamily = "'" + fam + "', Inter, ui-sans-serif, system-ui, sans-serif";
  },
  applyLoaderSetting(enabled) {
    document.body.classList.toggle('no-loader', String(enabled) === '0');
  },
  applyFavicon(url) {
    // Browser tab icon from Admin > Site Settings / CMS > Media Library > Favicon.
    // Empty url = keep the default /assets/favicon.ico from the HTML.
    if (!url) return;
    let l = document.querySelector('link[rel="icon"]');
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
    l.href = String(url);
  },
  statusBadge(status) {
    const map = {
      pending: 'badge badge-orange', approved: 'badge badge-green', paid: 'badge badge-green',
      rejected: 'badge badge-red', active: 'badge badge-green', stopped: 'badge badge-gray',
      open: 'badge badge-orange', answered: 'badge badge-green', closed: 'badge badge-gray',
      not_submitted: 'badge badge-gray', verified: 'badge badge-green', processing: 'badge badge-gray',
    };
    return `<span class="${map[status]||'badge badge-gray'}">${status}</span>`;
  },
  avatar(name, photo, size = 40) {
    const initials = name ? name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase() : 'NX';
    if (photo) return `<img src="${photo}" class="rounded-full object-cover" style="width:${size}px;height:${size}px;" alt="${name}">`;
    return `<div class="rounded-full flex items-center justify-center text-white font-bold text-sm" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#1E2329,#3A3F48);font-size:${Math.round(size*0.35)}px">${initials}</div>`;
  },
  toast(message, type = 'info') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    el.innerHTML = `<span style="color:${type==='error'?'#EF4444':type==='success'?'#10B981':'#3B82F6'};font-weight:700">${icons[type]||'ℹ'}</span><span>${message}</span>`;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  },
  showModal(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="overlay" id="modal-overlay">${html}</div>`;
    root.querySelector('.overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') utils.closeModal();
    });
  },
  closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  },
  confirm(message, onConfirm, confirmText = 'Confirm') {
    utils.showModal(`
      <div class="modal">
        <p class="text-base font-medium mb-6">${message}</p>
        <div class="flex gap-3">
          <button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button>
          <button id="confirm-btn" class="btn-primary flex-1">${confirmText}</button>
        </div>
      </div>
    `);
    document.getElementById('confirm-btn').onclick = () => { utils.closeModal(); onConfirm(); };
  },
  loading(el, show) {
    if (!el) return;
    if (show) { el._origHTML = el.innerHTML; el.innerHTML = '<span class="spinner"></span>'; el.disabled = true; }
    else { el.innerHTML = el._origHTML || el.innerHTML; el.disabled = false; }
  },
  isLoggedIn() { return !!localStorage.getItem('nx_token'); },
  isAdminLoggedIn() { return !!localStorage.getItem('nx_admin_token'); },
};
