// admin-components.js — Admin sidebar + layout (responsive)
const AdminComponents = {
  layout(content, title) {
    document.getElementById('admin-app').innerHTML = `
      ${AdminComponents.sidebar()}
      <div class="admin-main">
        ${AdminComponents.topbar(title)}
        <main class="p-4 lg:p-6">${content}</main>
      </div>
      <div class="admin-overlay" id="admin-ov" onclick="AdminComponents.closeSidebar()"></div>`;
    AdminComponents.loadBadges();
    AdminComponents.syncGroups();
  },
  openSidebar(){
    document.getElementById('admin-sidebar')?.classList.add('open');
    document.getElementById('admin-ov')?.classList.add('show');
    document.body.style.overflow='hidden';
  },
  closeSidebar(){
    document.getElementById('admin-sidebar')?.classList.remove('open');
    document.getElementById('admin-ov')?.classList.remove('show');
    document.body.style.overflow='';
  },

  topbar(title) {
    const a=AdminApp.state.admin||{};
    const n=AdminApp.state.notifCount||0;
    return `<div class="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <button class="p-2 rounded-xl hover:bg-gray-100 lg:hidden" onclick="AdminComponents.openSidebar()" aria-label="Menu">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div>
          <h1 class="text-base font-bold">${title||'Admin Dashboard'}</h1>
          <p class="text-xs text-gray-400 hidden sm:block">${a.role||'Super Admin'} · ${a.email||''}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button class="relative p-2 rounded-xl hover:bg-gray-100" onclick="AdminApp.navigate('/admin/notifications')">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          ${n>0?`<span class="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">${n>9?'9+':n}</span>`:''}
        </button>
        <div class="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">${(a.email||'A')[0].toUpperCase()}</div>
      </div>
    </div>`;
  },

  sidebar() {
    const path = window.location.pathname;
    const link = (href,label,badge)=>{
      const active=path===href||path.startsWith(href+'/');
      const bdg=badge>0?`<span class="ml-auto badge badge-orange text-xs">${badge}</span>`:'';
      return `<div class="admin-nav-link ${active?'active':''}" onclick="AdminComponents.closeSidebar();AdminApp.navigate('${href}')">${label}${bdg}</div>`;
    };
    const s=AdminApp.state;
    return `<aside class="admin-sidebar" id="admin-sidebar">
      <div class="p-4 border-b border-gray-100 flex items-center justify-between">
        <div class="flex items-center gap-2"><img src="/assets/logo-nx-mark-transparent.png" style="height:28px" alt="NX"><div><div class="font-bold text-sm">Nexora <span class="text-orange-500">FX</span> Admin</div><div class="text-xs text-gray-400">${(AdminApp.state.admin?.role||'Super Admin')}</div></div></div>
        <button class="p-1 lg:hidden text-gray-400 hover:text-gray-700" onclick="AdminComponents.closeSidebar()"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <nav class="flex-1 py-2 overflow-y-auto">
        ${link('/admin/dashboard','Admin Dashboard')}
        ${link('/admin/notifications','Admin Notifications',s.notifCount||0)}
        ${link('/admin/transactions','Transactions')}
        <div class="admin-nav-group" style="cursor:default">USERS</div>
        ${link('/admin/users','Users')}
        ${link('/admin/kyc','KYC Control')}
        ${link('/admin/kyc-control','Manage KYC Form')}
        ${link('/admin/copies','Invests/Copies')}
        ${link('/admin/2fa-control','2FA Control')}
        <div class="admin-nav-group" style="cursor:default">FINANCE</div>
        ${link('/admin/deposits','Deposits')}
        ${link('/admin/withdrawals','Withdrawals')}
        ${link('/admin/request-money','Request Money')}
        ${link('/admin/referrals','Referral')}
        ${link('/admin/profit','Profit System')}
        ${link('/admin/money-settings','Money Settings')}
        <div class="admin-nav-drop" onmouseenter="AdminComponents.openGroup('general')" onmouseleave="AdminComponents.maybeCloseGroup('general')">
        <div class="admin-nav-group" onclick="AdminComponents.toggleGroup('general')" style="cursor:pointer">GENERAL SETTINGS</div>
        <div class="admin-nav-sub" id="general-group">
          ${link('/admin/settings','Logo')}
          ${link('/admin/settings','Favicon')}
          ${link('/admin/loader','Loader')}
          ${link('/admin/breadcrumb','Breadcrumb Banner')}
          ${link('/admin/settings','Website Contents')}
          ${link('/admin/countries','Manage Countries')}
        </div>
        </div>
        <div class="admin-nav-drop" onmouseenter="AdminComponents.openGroup('team')" onmouseleave="AdminComponents.maybeCloseGroup('team')">
        <div class="admin-nav-group" onclick="AdminComponents.toggleGroup('team')" style="cursor:pointer">TEAM &amp; SYSTEM</div>
        <div class="admin-nav-sub" id="team-group">
          ${link('/admin/roles','Manage Roles')}
          ${link('/admin/staff','Manage Staff')}
          ${link('/admin/audit-log','Audit Log')}
          ${link('/admin/reports','Reports')}
          ${link('/admin/email','Email Settings')}
          ${link('/admin/sms','SMS Settings')}
        </div>
        </div>
        <div class="admin-nav-drop" onmouseenter="AdminComponents.openGroup('content')" onmouseleave="AdminComponents.maybeCloseGroup('content')">
        <div class="admin-nav-group" onclick="AdminComponents.toggleGroup('content')" style="cursor:pointer">CONTENT</div>
        <div class="admin-nav-sub" id="content-group">
          ${link('/admin/blog','Manage Blog')}
          ${link('/admin/pages','Website Contents')}
          ${link('/admin/menu-builder','Menu Builder')}
          ${link('/admin/seo','SEO Tools')}
          ${link('/admin/fonts','Fonts')}
          ${link('/admin/language','Language')}
          ${link('/admin/footer','Footer')}
          ${link('/admin/error-banner','Error Banner')}
        </div>
        </div>
        <div class="admin-nav-drop" onmouseenter="AdminComponents.openGroup('payment')" onmouseleave="AdminComponents.maybeCloseGroup('payment')">
        <div class="admin-nav-group" onclick="AdminComponents.toggleGroup('payment')" style="cursor:pointer">PAYMENT SETTINGS</div>
        <div class="admin-nav-sub" id="payment-group">
          ${link('/admin/deposit-wallet','Deposit Wallet Settings')}
          ${link('/admin/currencies','Currencies')}
          ${link('/admin/payment-gateways','Payment Gateways')}
          ${link('/admin/menu-page-settings','Menu Page Settings')}
          ${link('/admin/holidays','Holiday Settings')}
        </div>
        </div>
        <div class="admin-nav-group" style="cursor:default">TRADING</div>
        ${link('/admin/traders','Traders')}
        ${link('/admin/showcase','Showcase Accounts')}
        <div class="admin-nav-group" style="cursor:default">SUPPORT</div>
        ${link('/admin/tickets','Support Tickets')}
        ${link('/admin/send-notification','Notifications Send')}
        ${link('/admin/forget-requests','Forget Requests')}
      </nav>
      <div class="p-3 border-t border-gray-100">
        <div class="admin-nav-link" onclick="window.open('/','_blank')" style="color:#3B82F6">← Exit to User Site</div>
        <div class="admin-nav-link" onclick="AdminApp.logout()" style="color:#EF4444">Sign Out</div>
      </div>
    </aside>`;
  },

  toggleGroup(id) {
    const el=document.getElementById(`${id}-group`);
    if(el) el.classList.toggle('open');
  },

  // Which admin routes live inside each collapsible sidebar group
  _groupRoutes: {
    general: ['/settings','/loader','/breadcrumb','/countries'],
    team: ['/roles','/staff','/audit-log','/reports','/email','/sms'],
    content: ['/blog','/pages','/menu-builder','/seo','/fonts','/language','/footer','/error-banner'],
    payment: ['/deposit-wallet','/currencies','/payment-gateways','/menu-page-settings','/holidays'],
  },
  // The group that holds the current page (null when the page is outside all groups)
  _activeGroup() {
    const p=(window.location.pathname||'').replace('/admin','')||'/dashboard';
    for (const [g,routes] of Object.entries(AdminComponents._groupRoutes)) {
      if (routes.includes(p)) return g;
    }
    return null;
  },
  // Hover in: open the group
  openGroup(id) {
    const el=document.getElementById(`${id}-group`);
    if(el) el.classList.add('open');
  },
  closeGroup(id) {
    const el=document.getElementById(`${id}-group`);
    if(el) el.classList.remove('open');
  },
  // Hover out: close it again, unless the current page lives inside it
  maybeCloseGroup(id) {
    if(AdminComponents._activeGroup()!==id) AdminComponents.closeGroup(id);
  },
  // After every render: keep exactly the active group open, close the rest
  syncGroups() {
    const active=AdminComponents._activeGroup();
    ['general','team','content','payment'].forEach(id=>{
      const el=document.getElementById(`${id}-group`);
      if(el) el.classList.toggle('open', id===active);
    });
  },

  async loadBadges() {
    try{const d=await adminApi.notifications();AdminApp.state.notifCount=d.unread||0;}catch(e){}
  }
};
