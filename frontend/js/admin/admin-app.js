// admin-app.js — Admin SPA router
const AdminApp = {
  state: { admin: null, notifCount: 0 },

  async init() {
    if (!api.getAdminToken()) { AdminApp.showLogin(); return; }
    try {
      const a = await adminApi.me();
      AdminApp.state.admin = a;
      try { const s = await adminApi.getSettings(); utils.applySiteFont(s.site_font || 'Plus Jakarta Sans'); utils.applyLoaderSetting(s.site_loader || '1'); } catch(e) {}
      AdminApp.route(window.location.pathname);
    } catch(e) {
      api.clearAdminToken();
      AdminApp.showLogin();
    }
    window.onpopstate = () => AdminApp.route(window.location.pathname);
  },

  navigate(path) {
    history.pushState({}, '', path);
    AdminApp.route(path);
  },

  route(path) {
    if (!api.getAdminToken()) { AdminApp.showLogin(); return; }
    const p = path.replace('/admin','') || '/dashboard';
    const routes = {
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
    // User detail route
    if (p.startsWith('/users/')) { AdminPages.viewUser(p.split('/')[2]); return; }
    const handler = routes[p];
    if (handler) handler();
    else AdminPages.dashboard();
  },

  showLogin() {
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

  logout() {
    utils.confirm('Sign out of admin?', ()=>{api.clearAdminToken();AdminApp.showLogin();},'Sign Out');
  }
};

const AdminPages = {};
window.addEventListener('DOMContentLoaded', () => AdminApp.init());
