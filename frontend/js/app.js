/*
 * app.js - Single-page app router and startup for the Nexora FX user site.
 * What it does: loads public settings on startup, validates the user
 * token, routes paths to Pages.* handlers (defined in js/pages/*.js),
 * and intercepts internal link clicks so navigation stays in-page.
 * Key functions: init(), navigate(), logout(), route(),
 * showImpersonationBanner(), backToAdmin(), updateUser().
 * Important rules: public paths need no login; all other paths redirect
 * to /login when there is no token. /admin is a separate app and is
 * never intercepted. Money is integer cents; balances come from
 * GET /api/user/me (see js/api.js).
 */
const App = {
  state: { user: null, settings: {}, unreadCount: 0 },

  // App startup: load public settings, handle maintenance mode and
  // email/reset URL tokens, validate the saved token, then route.
  // First paint must never wait on the network: the page used to stay blank
  // for 20-60s when /api/settings (or the Tailwind CDN) was slow, because
  // init() awaited settings before routing. Now a loader shows instantly,
  // settings load in the background, and the page re-renders once they land.
  async init() {
    // Instant loader so the page is never a blank white screen.
    const _appEl = document.getElementById('app');
    if (_appEl) _appEl.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="text-center p-8"><div class="mx-auto mb-4" style="width:40px;height:40px;border:3px solid #FFE1CC;border-top-color:#FF6A00;border-radius:50%;animation:spin 0.8s linear infinite"></div><p class="text-gray-500">Loading…</p></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    // Load public settings in the background — never block the first paint.
    // When they arrive, apply branding and re-render once so the page uses
    // the real settings instead of the defaults it rendered with.
    let _settingsApplied = false;
    let _routed = false; // becomes true once init() runs its first route()
    const _initAt = Date.now();
    const _applySettings = (st) => {
      App.state.settings = st || {};
      utils.applySiteFont(App.state.settings.site_font || 'Plus Jakarta Sans');
      utils.applyLoaderSetting(App.state.settings.site_loader || '1');
      utils.applyFavicon(App.state.settings.favicon_url);
      if (!_settingsApplied) {
        _settingsApplied = true;
        // Re-render once with the real settings — but ONLY after init's
        // first route() has run (otherwise route() sees "has token but no
        // user yet" and clears the token = logout on refresh), and only if
        // they arrived within 5s of load (before the user can have started
        // typing); a later arrival must never wipe what the user is doing.
        if (_routed && Date.now() - _initAt < 5000) {
          try { App.route(window.location.pathname); } catch(e) {}
        }
      }
    };
    const _settingsP = api.getSettings().then(_applySettings).catch(() => {});

    // Maintenance mode — only block non-logged-in visitors. Checked as soon
    // as settings arrive; the page may render first and switch to this.
    _settingsP.then(() => {
      if (App.state.settings.maintenance_mode === '1' && !utils.isLoggedIn()) {
        document.getElementById('app').innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="text-center p-8"><h1 class="text-2xl font-bold mb-2">Under Maintenance</h1><p class="text-gray-500">We\'ll be back shortly.</p></div></div>';
      }
    });

    // Handle special URL tokens before any auth check
    const urlParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    if (path === '/verify-email' && urlParams.get('token')) {
      Pages.verifyEmail(urlParams.get('token'));
      return;
    }
    if (path === '/reset-password' && urlParams.get('token')) {
      Pages.resetPassword(urlParams.get('token'));
      return;
    }

    // Validate token silently — if invalid, clear it and treat as logged out
    if (utils.isLoggedIn()) {
      try {
        const data = await api.getMe();
        App.state.user = data.user;
        App.state.balance = data.balance;
        if (data.is_impersonation) App.showImpersonationBanner();
        else document.getElementById('impersonation-banner')?.remove();
      } catch(e) {
        // Token invalid or expired — clear it silently, no error shown
        api.clearToken();
        App.state.user = null;
        App.state.balance = null;
      }
    }

    // Route to current path
    App.route(window.location.pathname);
    _routed = true;
    App._track();
    window.onpopstate = () => { App.route(window.location.pathname); App._track(); };
  },

  // In-page navigation: push the URL into history, then route to it.
  navigate(path) {
    history.pushState({}, '', path);
    App.route(path);
    App._track();
  },

  // Visitor tracking (built-in analytics, v116): one random ID per device,
  // kept in localStorage + a first-party cookie (nx_vid, 1 year). Sent once
  // per page view; the server counts distinct IDs as unique visitors, so
  // one device is counted once no matter how often it visits, and bots
  // are skipped server-side. No personal data is collected or stored.
  // Silent by design — a failed beacon never bothers the user.
  _track() {
    try {
      let id = null;
      try { id = localStorage.getItem('nx_vid'); } catch(e) {}
      if (!id) {
        const m = document.cookie.match(/(?:^|; )nx_vid=([^;]+)/);
        if (m) id = decodeURIComponent(m[1]);
      }
      if (!id) {
        id = 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        try { localStorage.setItem('nx_vid', id); } catch(e) {}
        document.cookie = 'nx_vid=' + encodeURIComponent(id) + '; max-age=31536000; path=/; SameSite=Lax';
      }
      fetch('/api/track/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: id, path: window.location.pathname }),
        keepalive: true
      }).catch(() => {});
    } catch(e) {}
  },

  // Log out: clear the user token (and any saved admin token used for
  // login-as-user), remove the impersonation banner, go to the home page.
  logout() {
    api.clearToken();
    App.state.user = null;
    localStorage.removeItem('nx_prev_user_token');
    document.getElementById('impersonation-banner')?.remove();
    window.location.href = '/';
  },

  // Route a path to its page handler. Redirects to /login when a
  // protected page is opened without a token, and to /dashboard when a
  // logged-in user opens /login or /register.
  route(path) {
    // Release the mobile sidebar scroll-lock on every navigation.
    // openSidebar() sets body overflow hidden; a sidebar link tap re-renders
    // the page without calling closeSidebar(), which left the page unscrollable.
    try { if (typeof Components !== 'undefined' && Components.closeSidebar) Components.closeSidebar(); } catch(e) {}
    // Every navigation starts at the top of the new page. Without this the
    // page kept the previous page's scroll offset — e.g. after login the
    // dashboard opened scrolled down, its top cut off above the viewport.
    try { window.scrollTo(0, 0); } catch(e) {}
    // loggedIn = has valid token AND user loaded (or just token for public page routing)
    const hasToken = utils.isLoggedIn();
    const loggedIn = hasToken && App.state.user !== null;
    const cleanPath = path.split('?')[0];
    const publicPaths = ['/', '/register', '/login', '/forgot-password', '/reset-password', '/verify-email', '/news', '/schedule', '/promotion'];
    const authRequired = !publicPaths.includes(cleanPath);

    // Not authenticated and trying to access a protected page → redirect to login
    if (authRequired && !hasToken) {
      if (cleanPath !== '/login') sessionStorage.setItem('nx_redirect', cleanPath);
      history.replaceState({}, '', '/login');
      Pages.login();
      return;
    }

    // Has token but user not loaded yet (e.g. token present but getMe failed) → clear and redirect
    if (authRequired && hasToken && !loggedIn) {
      api.clearToken();
      App.state.user = null;
      if (cleanPath !== '/login') sessionStorage.setItem('nx_redirect', cleanPath);
      history.replaceState({}, '', '/login');
      Pages.login();
      return;
    }

    // Start the live bell poll (once) for logged-in users, so admin
    // actions show on the bell without a reload. startBellPoll is
    // idempotent — it returns early if already running or logged out.
    try { if (typeof Components !== 'undefined' && Components.startBellPoll) Components.startBellPoll(); } catch(e) {}
    // Start the live push too (same guard): admin actions then reach the
    // bell instantly over the WebSocket instead of waiting for the poll.
    try { if (typeof Components !== 'undefined' && Components.startLivePush) Components.startLivePush(); } catch(e) {}

    // Logged in trying to access home/login/register → go to dashboard.
    // Home IS the dashboard for a logged-in user; the signup landing page
    // is only for visitors. After logout the token is gone, so '/'
    // shows the landing page again.
    if ((cleanPath === '/' || cleanPath === '/login' || cleanPath === '/register') && loggedIn) {
      history.replaceState({}, '', '/dashboard');
      Pages.dashboard();
      return;
    }

    const routes = {
      '/': Pages.landing,
      '/register': Pages.register,
      '/login': Pages.login,
      '/forgot-password': Pages.forgotPassword,
      '/reset-password': Pages.resetPassword,
      '/verify-email': Pages.verifyEmail,
      '/dashboard': Pages.dashboard,
      '/copy-trade': Pages.copyTrade,
      '/my-copies': Pages.myCopies,
      '/deposit': Pages.deposit,
      '/withdraw': Pages.withdraw,
      '/history': Pages.history,
      '/copy-history': Pages.copyHistory,
      '/trade-history': Pages.tradeHistory,
      '/referred-users': Pages.referredUsers,
      '/referral-commissions': Pages.referralCommissions,
      '/friends': Pages.friends,
      '/support': Pages.support,
      '/edit-profile': Pages.editProfile,
      '/2fa': Pages.twoFA,
      '/change-password': Pages.changePassword,
      '/kyc': Pages.kyc,
      '/notifications': Pages.notifications,
      '/risk-terms': Pages.riskTerms,
      '/news': Pages.news,
      '/schedule': Pages.schedule,
      '/promotion': Pages.promotion,
      '/request-money': Pages.requestMoney,
    };

    // /trader/:id
    if (cleanPath.startsWith('/trader/')) {
      Pages.traderDetail(cleanPath.split('/')[2]);
      return;
    }

    const handler = routes[cleanPath];
    if (handler) {
      handler();
    } else {
      document.getElementById('app').innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="text-center p-8"><h1 class="text-4xl font-bold text-gray-200">'+(App.state.settings.error_title||'Page Not Found')+'</h1><p class="text-gray-400 mt-2">'+(App.state.settings.error_message||'The page you are looking for does not exist.')+'</p><button onclick="App.navigate(\'/\')" class="btn-primary mt-6" style="width:auto;padding:10px 28px">Go Home</button></div></div>';
    }
  },

  // Show the orange banner while an admin is viewing the site as a user
  // (login-as-user). Withdraw, password and 2FA actions are blocked then.
  showImpersonationBanner() {
    // Remove any existing banner first
    document.getElementById('impersonation-banner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'impersonation-banner';
    banner.className = 'impersonation-banner';
    banner.innerHTML = '⚠️ Admin session — viewing as <strong>' + (App.state.user?.username||'') + '</strong>. Withdraw, password &amp; 2FA actions are blocked. <a href=\"#\" onclick=\"App.backToAdmin();return false;\" style=\"color:#fff;text-decoration:underline;margin-left:12px\">Back to Admin →</a>';
    document.body.prepend(banner);
  },

  // End impersonation: restore the admin's own user token if one was
  // saved, otherwise log the user site out, then open /admin.
  backToAdmin() {
    // End the impersonation session: restore the admin's own user token if there was one, else log the user site out
    const prev = localStorage.getItem('nx_prev_user_token');
    if (prev) api.setToken(prev); else api.clearToken();
    localStorage.removeItem('nx_prev_user_token');
    window.location.href = '/admin';
  },

  // Merge updated profile fields into the cached user in App.state.
  updateUser(user) {
    App.state.user = Object.assign({}, App.state.user, user);
  }
};

// Pages.* handlers are defined in js/pages/*.js and filled in here.
const Pages = {};

// Intercept all internal link clicks so the SPA routes without a full
// page reload. External links, mailto/tel, anchors, /admin and /api are
// left alone. /api must be excluded: API endpoints (e.g. the APK download
// link /api/app/download) are not SPA pages — intercepting one used to
// route it through App.navigate, which has no such page and rendered the
// "Page Not Found" screen instead of letting the browser download the file.
document.addEventListener('click', function(e) {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('#') || href.startsWith('tel:') || href === '/admin' || href.startsWith('/admin/') || href.startsWith('/api/')) return; // /admin is a separate app — let the browser load it fully
  e.preventDefault();
  App.navigate(href);
});

// On load: show a readable error box if an uncaught JS error leaves the
// app empty, log unhandled promise rejections, then start the app.
window.addEventListener('DOMContentLoaded', function() {
  window.onerror = function(msg, src, line, col, err) {
    console.error('JS Error:', msg, 'at', src, line, col);
    const app = document.getElementById('app');
    if (app && app.innerHTML.trim() === '') {
      app.innerHTML = '<div style="padding:32px;font-family:monospace;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:12px;margin:20px;color:#991B1B">'
        +'<h2 style="font-size:16px;font-weight:bold;margin-bottom:8px">JavaScript Error — check F12 Console</h2>'
        +'<p><b>'+msg+'</b></p>'
        +'<p style="font-size:12px;margin-top:6px">File: '+src+' Line: '+line+'</p>'
        +'</div>';
    }
    return false;
  };
  window.onunhandledrejection = function(e) {
    console.error('Unhandled Promise:', e.reason);
  };
  App.init();
});

