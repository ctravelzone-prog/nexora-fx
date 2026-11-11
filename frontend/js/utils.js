/*
 * utils.js - Shared helpers for the Nexora FX user site and admin panel.
 * What it does: money and date formatting, site font/favicon/loader
 * settings, status badges, avatars, toasts, modals, confirm dialogs,
 * button loading state, and login-state checks.
 * Key functions: fmtMoney(), fmtDate(), fmtDateTime(), timeAgo(),
 * applySiteFont(), applyFavicon(), statusBadge(), avatar(), toast(),
 * showModal(), confirm(), loading(), isLoggedIn(), isAdminLoggedIn().
 * Important rule: money is integer cents everywhere - fmtMoney() divides
 * by 100 and adds thousand separators (e.g. 123456 -> $1,234.56).
 * Timestamps from the API are epoch seconds, so formatters multiply by 1000.
 */
// All country calling codes for the phone country-code dropdowns
// (registration + profile phone change). Siam 12 Nov 2026: the signup
// dropdown only had 5 codes (+1, +880, +44, +91, +92) — now it lists
// every country. Format: [dialing code, ISO country code].
const COUNTRY_CODES=[
["+93","AF"],["+355","AL"],["+213","DZ"],["+376","AD"],["+244","AO"],["+1-268","AG"],["+54","AR"],["+374","AM"],["+61","AU"],["+43","AT"],["+994","AZ"],["+1-242","BS"],["+973","BH"],["+880","BD"],["+1-246","BB"],["+375","BY"],["+32","BE"],["+501","BZ"],["+229","BJ"],["+975","BT"],["+591","BO"],["+387","BA"],["+267","BW"],["+55","BR"],["+673","BN"],["+359","BG"],["+226","BF"],["+257","BI"],["+855","KH"],["+237","CM"],["+1","CA"],["+238","CV"],["+236","CF"],["+235","TD"],["+56","CL"],["+86","CN"],["+57","CO"],["+269","KM"],["+242","CG"],["+243","CD"],["+506","CR"],["+385","HR"],["+53","CU"],["+357","CY"],["+420","CZ"],["+45","DK"],["+253","DJ"],["+1-767","DM"],["+1-809","DO"],["+593","EC"],["+20","EG"],["+503","SV"],["+240","GQ"],["+291","ER"],["+372","EE"],["+268","SZ"],["+251","ET"],["+679","FJ"],["+358","FI"],["+33","FR"],["+241","GA"],["+220","GM"],["+995","GE"],["+49","DE"],["+233","GH"],["+30","GR"],["+1-473","GD"],["+502","GT"],["+224","GN"],["+245","GW"],["+592","GY"],["+509","HT"],["+504","HN"],["+852","HK"],["+36","HU"],["+354","IS"],["+91","IN"],["+62","ID"],["+98","IR"],["+964","IQ"],["+353","IE"],["+972","IL"],["+39","IT"],["+225","CI"],["+1-876","JM"],["+81","JP"],["+962","JO"],["+7","KZ"],["+254","KE"],["+686","KI"],["+965","KW"],["+996","KG"],["+856","LA"],["+371","LV"],["+961","LB"],["+266","LS"],["+231","LR"],["+218","LY"],["+423","LI"],["+370","LT"],["+352","LU"],["+853","MO"],["+261","MG"],["+265","MW"],["+60","MY"],["+960","MV"],["+223","ML"],["+356","MT"],["+692","MH"],["+222","MR"],["+230","MU"],["+52","MX"],["+691","FM"],["+373","MD"],["+377","MC"],["+976","MN"],["+382","ME"],["+212","MA"],["+258","MZ"],["+95","MM"],["+264","NA"],["+674","NR"],["+977","NP"],["+31","NL"],["+64","NZ"],["+505","NI"],["+227","NE"],["+234","NG"],["+850","KP"],["+389","MK"],["+47","NO"],["+968","OM"],["+92","PK"],["+680","PW"],["+970","PS"],["+507","PA"],["+675","PG"],["+595","PY"],["+51","PE"],["+63","PH"],["+48","PL"],["+351","PT"],["+1-787","PR"],["+974","QA"],["+40","RO"],["+7","RU"],["+250","RW"],["+1-869","KN"],["+1-758","LC"],["+1-784","VC"],["+685","WS"],["+378","SM"],["+239","ST"],["+966","SA"],["+221","SN"],["+381","RS"],["+248","SC"],["+232","SL"],["+65","SG"],["+421","SK"],["+386","SI"],["+677","SB"],["+252","SO"],["+27","ZA"],["+82","KR"],["+211","SS"],["+34","ES"],["+94","LK"],["+249","SD"],["+597","SR"],["+46","SE"],["+41","CH"],["+963","SY"],["+886","TW"],["+992","TJ"],["+255","TZ"],["+66","TH"],["+228","TG"],["+676","TO"],["+1-868","TT"],["+216","TN"],["+90","TR"],["+993","TM"],["+688","TV"],["+256","UG"],["+380","UA"],["+971","AE"],["+44","UK"],["+1","US"],["+598","UY"],["+998","UZ"],["+678","VU"],["+379","VA"],["+58","VE"],["+84","VN"],["+967","YE"],["+260","ZM"],["+263","ZW"]
];
// Builds the <option> list for a country-code <select>. The default
// selected code is +1 (US), matching the old 5-option dropdown.
function countryCodeOptionsHTML(selected){
  const sel=selected||'+1';
  return COUNTRY_CODES.map(([code,iso])=>`<option value="${code}"${code===sel?' selected':''}>${code} ${iso}</option>`).join('');
}
const utils = {
  // Format integer cents as dollars (e.g. 123456 -> $1,234.56).
  fmtMoney(cents) {
    if (cents === null || cents === undefined) return '$0.00';
    return '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  // Format an epoch-seconds timestamp as e.g. 6 Nov 2026.
  fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  // Format an epoch-seconds timestamp as e.g. 6 Nov 2026, 06:30 AM.
  fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  },
  // Relative time (just now / N min ago / N hr ago / N days ago).
  // Thresholds: under 60s, under 1h (3600s), under 1 day (86400s).
  timeAgo(ts) {
    if (!ts) return '';
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
    return Math.floor(diff / 86400) + ' days ago';
  },
  // Apply the admin-chosen site font. Loads it once from Google Fonts
  // (Inter is the built-in default, so it is never loaded again).
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
  // Turn the page loader off when the admin disables it ('0' hides it).
  applyLoaderSetting(enabled) {
    document.body.classList.toggle('no-loader', String(enabled) === '0');
  },
  // Apply the admin-uploaded favicon; an empty URL keeps the default.
  applyFavicon(url) {
    // Browser tab icon from Admin > Site Settings / CMS > Media Library > Favicon.
    // Empty url = keep the default /assets/favicon.ico from the HTML.
    if (!url) return;
    let l = document.querySelector('link[rel="icon"]');
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
    l.href = String(url);
  },
  // Colored status pill (pending, approved/paid, rejected, active,
  // stopped, open, answered, closed, verified, etc.). Unknown statuses
  // fall back to grey so a new backend status never breaks the page.
  statusBadge(status) {
    const map = {
      pending: 'badge badge-orange', approved: 'badge badge-green', paid: 'badge badge-green',
      rejected: 'badge badge-red', active: 'badge badge-green', stopped: 'badge badge-gray',
      open: 'badge badge-orange', answered: 'badge badge-green', closed: 'badge badge-gray',
      not_submitted: 'badge badge-gray', verified: 'badge badge-green', processing: 'badge badge-gray',
    };
    return `<span class="${map[status]||'badge badge-gray'}">${status}</span>`;
  },
  // Round user avatar: photo when one exists, otherwise initials
  // (first letters of up to two words, fallback "NX") on a dark gradient.
  avatar(name, photo, size = 40) {
    const initials = name ? name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase() : 'NX';
    if (photo) return `<img src="${photo}" class="rounded-full object-cover" style="width:${size}px;height:${size}px;" alt="${name}">`;
    return `<div class="rounded-full flex items-center justify-center text-white font-bold text-sm" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#1E2329,#3A3F48);font-size:${Math.round(size*0.35)}px">${initials}</div>`;
  },
  // Small popup message (success / error / info). Removes itself
  // automatically after 4000 ms.
  toast(message, type = 'info') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    el.innerHTML = `<span style="color:${type==='error'?'#EF4444':type==='success'?'#10B981':'#3B82F6'};font-weight:700">${icons[type]||'ℹ'}</span><span>${message}</span>`;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  },
  // Show a modal dialog. Clicking the dark overlay behind it closes it.
  showModal(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="overlay" id="modal-overlay">${html}</div>`;
    root.querySelector('.overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') utils.closeModal();
    });
  },
  // Close (clear) the currently open modal.
  closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  },
  // Confirm dialog with Cancel and Confirm buttons. Runs onConfirm
  // only after the user taps Confirm.
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
  // Button loading state: swap the button content for a spinner and
  // disable it, then restore the saved original HTML afterwards.
  loading(el, show) {
    if (!el) return;
    if (show) { el._origHTML = el.innerHTML; el.innerHTML = '<span class="spinner"></span>'; el.disabled = true; }
    else { el.innerHTML = el._origHTML || el.innerHTML; el.disabled = false; }
  },
  // True when a user token is stored (does not check if it is still valid).
  isLoggedIn() { return !!localStorage.getItem('nx_token'); },
  // True when an admin token is stored (does not check if it is still valid).
  isAdminLoggedIn() { return !!localStorage.getItem('nx_admin_token'); },
};
