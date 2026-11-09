/*
 * admin-app.js — Admin SPA router and login gate.
 *
 * Owns the AdminApp object: the route table, navigation, the admin login
 * screen, and the 1-second auto-refresh for request-list pages.
 * Key functions: init, navigate, route, _routes, showLogin, logout,
 * _startListRefresh, _stopListRefresh, _autoRefresh.
 * Pages themselves are rendered by AdminPages handlers defined in the other
 * admin-*.js files; this file only decides which handler runs for a URL.
 *
 * Gotchas:
 * - _gen is bumped on every route() call. Async page handlers capture it
 *   before their API call and skip rendering if it changed, so a stale
 *   auto-refresh can never overwrite a page the admin just opened.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they CAN log in and do everything, but
 *   their data lives in a separate showcase database and is excluded from
 *   all admin totals, ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
const AdminApp = {
  // Navigation generation: bumped on every route(). Async page handlers capture it
  // before their API call and skip rendering if it changed — so a stale auto-refresh
  // can never overwrite a page the admin just navigated to (first click looked dead).
  _gen: 0,
  state: { admin: null, notifCount: 0, sideBadges: {} },
  _listPoll: null,
  // Request-list pages that auto-refresh so new user requests appear without a manual reload
  _refreshable: ['/dashboard','/notifications','/transactions','/deposits','/withdrawals','/request-money','/tickets','/forget-requests','/profile-requests','/kyc'],
// Starts the 1s auto-refresh poll, but only on request-list pages.
  // Other pages never poll, so their forms and detail views stay stable.
  _startListRefresh(path) {
    AdminApp._stopListRefresh();
    if (!AdminApp._refreshable.includes(path)) return;
    AdminApp._listPoll = setInterval(() => AdminApp._autoRefresh(), 1000); // Poll every second so new requests appear without a manual reload.
  },
// Stops any running list poll (called before starting a new one and on logout).
  _stopListRefresh() {
    if (AdminApp._listPoll) { clearInterval(AdminApp._listPoll); AdminApp._listPoll = null; }
  },
// Re-runs the current list page handler once per second.
  // Skips while a modal is open, the admin is typing, a ticket is open
  // (it has its own 3s poll), or the tab is hidden. Scroll position is kept.
  async _autoRefresh() {
    // Skip while the admin is busy: a modal is open, typing in a field,
    // a ticket detail is open (its own 3s poll handles it), or the tab is hidden.
    const modal = document.getElementById('modal-root');
    if (modal && modal.innerHTML.trim()) return;
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    if (typeof AdminPages !== 'undefined' && (AdminPages._activeTicketId || AdminPages._activeForgetId)) return;
    if (document.hidden) return;
    const p = window.location.pathname.replace('/admin','') || '/dashboard';
    if (!AdminApp._refreshable.includes(p)) return;
    const handler = AdminApp._routes()[p];
    if (!handler) return;
    const y = window.scrollY;
    try { await handler(); } catch(e) {}
    window.scrollTo(0, y);
  },

// Boot: if there is no admin token, show the login screen. Otherwise
  // load the current admin and site settings, then route to the current URL.
  // First paint must never wait on the network: the admin page used to stay
  // blank for 20-45s when the settings call was slow, because init() awaited
  // it before routing. Now a loader shows instantly and settings load in the
  // background; the page re-renders once they land (within 5s of load only).
  async init() {
    if (!api.getAdminToken()) { AdminApp.showLogin(); return; }
    const _appEl = document.getElementById('app');
    if (_appEl) _appEl.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="text-center p-8"><div class="mx-auto mb-4" style="width:40px;height:40px;border:3px solid #FFE1CC;border-top-color:#FF6A00;border-radius:50%;animation:spin 0.8s linear infinite"></div><p class="text-gray-500">Loading…</p></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    const _initAt = Date.now();
    let _settingsApplied = false;
    const _settingsP = adminApi.getSettings().then((st) => {
      utils.applySiteFont(st.site_font || 'Plus Jakarta Sans');
      utils.applyLoaderSetting(st.site_loader || '1');
      utils.applyFavicon(st.favicon_url);
      if (!_settingsApplied) {
        _settingsApplied = true;
        if (Date.now() - _initAt < 5000 && AdminApp.state.admin) {
          try { AdminApp.route(window.location.pathname); } catch(e) {}
        }
      }
    }).catch(() => {});
    try {
      const a = await adminApi.me();
      AdminApp.state.admin = a;
      AdminApp.route(window.location.pathname);
      // Live admin notifications: user requests reach the bell + toast
      // instantly on every page (AdminComponents.startLivePush is
      // idempotent — it returns early if already running).
      try{AdminComponents.startLivePush();}catch(e){}
    } catch(e) {
      // Only a 401 means the admin token is bad. A timeout / network error
      // must NOT log the admin out — the token stays so a refresh retries.
      if (e && e.status === 401) api.clearAdminToken();
      AdminApp.showLogin();
    }
    window.onpopstate = () => AdminApp.route(window.location.pathname);
  },

// Pushes a new URL into history and routes to it without a page reload.
  navigate(path) {
    history.pushState({}, '', path);
    AdminApp.route(path);
  },

// Maps each admin URL path to the AdminPages handler that renders it.
  _routes() {
    return {
      '/': AdminPages.dashboard,
      '/dashboard': AdminPages.dashboard,
      '/notifications': AdminPages.notifications,
      '/transactions': AdminPages.transactions,
      '/deposits': AdminPages.deposits,
      '/withdrawals': AdminPages.withdrawals,
      '/referrals': AdminPages.referrals,
      '/request-money': AdminPages.requestMoney,
      '/users': AdminPages.users,
      '/traders': AdminPages.traders,
      '/copies': AdminPages.copies,
      '/profit': AdminPages.profit,
      '/kyc': AdminPages.kyc,
      '/kyc-control': AdminPages.kycControl,
      '/tickets': AdminPages.tickets,
      '/forget-requests': AdminPages.forgetRequests,
      '/profile-requests': AdminPages.profileRequests,
      '/profile': AdminPages.profile,
      '/settings': AdminPages.settings,
      '/money-settings': AdminPages.moneySettings,
      '/deposit-wallet': AdminPages.depositWallet,
      '/2fa-control': AdminPages.twoFAControl,
      '/audit-log': AdminPages.auditLog,
      '/reports': AdminPages.reports,
      '/send-notification': AdminPages.sendNotification,
      '/showcase': AdminPages.showcase,
      '/blog': AdminPages.manageBlog,
      '/pages': AdminPages.pagesEditor,
      '/menu-builder': AdminPages.menuBuilder,
      '/menu-page-settings': AdminPages.menuPageSettings,
      '/seo': AdminPages.seoTools,
      '/fonts': AdminPages.fontsSettings,
      '/language': AdminPages.languageSettings,
      '/loader': AdminPages.loaderSettings,
      '/breadcrumb': AdminPages.breadcrumbBanner,
      '/error-banner': AdminPages.errorBanner,
      '/countries': AdminPages.manageCountries,
      '/footer': AdminPages.footerSettings,
      '/roles': AdminPages.manageRoles,
      '/staff': AdminPages.manageStaff,
      '/email': AdminPages.emailSettings,
      '/sms': AdminPages.smsSettings,
      '/holidays': AdminPages.holidaySetting,
      '/currencies': AdminPages.currencies,
      '/payment-gateways': AdminPages.paymentGateways,
    };
  },

// Main router: bumps the navigation generation, starts list refresh for
  // the new page, and handles the /admin/users/:id detail route specially.
  route(path) {
    AdminApp._gen++;
    if (!api.getAdminToken()) { AdminApp.showLogin(); return; }
    const p = (path.split('#')[0].split('?')[0].replace('/admin','')) || '/dashboard';
    const routes = AdminApp._routes();
    AdminApp._startListRefresh(p);
    // User detail route
    if (p.startsWith('/users/')) { AdminPages.viewUser(p.split('/')[2]); return; }
    const handler = routes[p];
    if (handler) handler();
    else AdminPages.dashboard();
  },

// Renders the admin login form. Handles the 2FA step (reveals the code
  // field when the server asks for it) and the expired-session message.
  showLogin() {
    AdminApp._stopListRefresh();
    document.getElementById('admin-app').innerHTML = `
      <div class="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
          <div class="flex justify-center mb-6"><div class="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center"><img src="/assets/logo-nx-mark-transparent.png" style="height:32px" alt="NX"></div></div>
          <h1 class="text-xl font-bold text-center mb-1">Master Admin Panel</h1>
          <p class="text-center text-gray-400 text-sm mb-6">Nexora FX Admin Login</p>
          <form id="admin-login-form" class="space-y-4">
            <div><label class="input-label">Admin Email</label><input name="email" type="email" class="input-field" placeholder="admin@nexorafxuk" required></div>
            <div><label class="input-label">Password</label><input name="password" type="password" class="input-field" required></div>
            <div id="admin-login-2fa" class="hidden"><label class="input-label">2FA Code</label><input name="totp_code" type="text" maxlength="6" class="input-field"></div>
            <div id="admin-login-err" class="alert-danger hidden"></div>
            <button type="submit" id="admin-login-btn" class="btn-primary">Sign In to Admin</button>
          </form>
          <p class="text-center text-xs text-gray-400 mt-4">Nexora FX Admin Panel — authorised access only</p>
        </div>
      </div>`;
    try{
      if(sessionStorage.getItem('nx_admin_expired')==='1'){
        sessionStorage.removeItem('nx_admin_expired');
        const _e=document.getElementById('admin-login-err');
        if(_e){ _e.textContent='Your session expired — please log in again.'; _e.classList.remove('hidden'); }
      }
    }catch(e){}
    document.getElementById('admin-login-form').onsubmit = async (e) => {
      e.preventDefault();
      const f=e.target, err=document.getElementById('admin-login-err'), btn=document.getElementById('admin-login-btn');
      err.classList.add('hidden'); utils.loading(btn,true);
      try {
        const d = await adminApi.login({email:f.email.value,password:f.password.value,totp_code:f.totp_code?.value||undefined});
        if(d.require_2fa){document.getElementById('admin-login-2fa').classList.remove('hidden');utils.loading(btn,false);return;}
        api.setAdminToken(d.token);
        AdminApp.state.admin = d.admin;
        AdminApp.route('/admin/dashboard');
      } catch(ex){ err.textContent=ex.message; err.classList.remove('hidden'); }
      utils.loading(btn,false);
    };
  },

// Asks for confirmation, then clears the admin token and shows login.
  logout() {
    utils.confirm('Sign out of admin?', ()=>{api.clearAdminToken();AdminApp.showLogin();},'Sign Out');
  }
};

const AdminPages = {};
window.addEventListener('DOMContentLoaded', () => AdminApp.init());
