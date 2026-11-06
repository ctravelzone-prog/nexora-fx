/*
 * admin-components.js — Admin shared layout: sidebar, top bar, badges.
 *
 * Owns the AdminComponents object. layout() wraps every admin page with the
 * sidebar and top bar; sidebar() builds the navigation, topbar() the header
 * with the notification bell and admin avatar.
 * Key functions: layout, sidebar, topbar, openSidebar, closeSidebar,
 * toggleGroup, openGroup, closeGroup, maybeCloseGroup, syncGroups,
 * _activeGroup, loadBadges.
 *
 * Gotchas:
 * - Sidebar groups open on hover (desktop) and by click (touch). _hoverGroup
 *   survives re-renders so the 1s auto-refresh cannot close a hovered group.
 * - Links that share one page (Logo / Favicon / Website Contents all go to
 *   /admin/settings) use hash-aware active state, so only one lights up.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
const AdminComponents = {
// Wraps a page's HTML with the sidebar, top bar and mobile overlay,
  // then refreshes the notification badge and sidebar group state.
  layout(content, title) {
    document.getElementById('admin-app').innerHTML = `
      ${AdminComponents.sidebar()}
      <div class="admin-main">
        ${AdminComponents.topbar(title)}
        <main class="p-4 pb-36 lg:p-6">${content}</main>
      </div>
      <div class="admin-overlay" id="admin-ov" onclick="AdminComponents.closeSidebar()"></div>`;
    AdminComponents.loadBadges();
    AdminComponents.syncGroups();
  },
// Opens the mobile sidebar drawer and locks page scrolling behind it.
  openSidebar(){
    document.getElementById('admin-sidebar')?.classList.add('open');
    document.getElementById('admin-ov')?.classList.add('show');
    document.body.style.overflow='hidden';
  },
// Closes the mobile sidebar drawer and restores page scrolling.
  closeSidebar(){
    document.getElementById('admin-sidebar')?.classList.remove('open');
    document.getElementById('admin-ov')?.classList.remove('show');
    document.body.style.overflow='';
  },

// Renders the sticky top bar: page title, admin role/email, the
  // notification bell (with unread count, capped at 9+) and avatar initial.
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

// Renders the left navigation with grouped sections (USERS, FINANCE,
  // GENERAL SETTINGS, TEAM & SYSTEM, CONTENT, PAYMENT SETTINGS, TRADING,
  // SUPPORT) and the Exit to User Site / Sign Out footer links.
  sidebar() {
    const path = window.location.pathname;
    const link = (href,label,badge)=>{
      // Hash-aware active state: links that share one page (Logo / Favicon /
      // Website Contents all go to /admin/settings) must not all light up at once.
      // A link with a hash is active only when the URL hash matches it; a link
      // without a hash is active only when the URL has no hash.
      const _h=href.indexOf('#');const _lp=_h>=0?href.slice(0,_h):href;const _lh=_h>=0?href.slice(_h):'';
      const active=(path===_lp||path.startsWith(_lp+'/'))&&(_lh?window.location.hash===_lh:!window.location.hash);
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
          ${link('/admin/settings#favicon','Favicon')}
          ${link('/admin/loader','Loader')}
          ${link('/admin/breadcrumb','Breadcrumb Banner')}
          ${link('/admin/settings#contents','Website Contents')}
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

// Click-toggle for a collapsible sidebar group (touch / non-hover use).
  toggleGroup(id) {
    // If the mouse opened this group by hovering, a click must not close it while
    // the cursor is still over it. Click-toggle is only for touch / non-hover use.
    if(AdminComponents._hoverGroup===id) return;
    const el=document.getElementById(`${id}-group`);
    if(el) el.classList.toggle('open');
  },

// Route map used to decide which collapsible sidebar group holds a page.
  // Which admin routes live inside each collapsible sidebar group
  _groupRoutes: {
    general: ['/settings','/loader','/breadcrumb','/countries'],
    team: ['/roles','/staff','/audit-log','/reports','/email','/sms'],
    content: ['/blog','/pages','/menu-builder','/seo','/fonts','/language','/footer','/error-banner'],
    payment: ['/deposit-wallet','/currencies','/payment-gateways','/menu-page-settings','/holidays'],
  },
  // The group that holds the current page (null when the page is outside all groups)
// Returns the sidebar group that holds the current page, or null when
  // the page lives outside all groups.
  _activeGroup() {
    const p=(window.location.pathname||'').replace('/admin','')||'/dashboard';
    for (const [g,routes] of Object.entries(AdminComponents._groupRoutes)) {
      if (routes.includes(p)) return g;
    }
    return null;
  },
// The group the mouse is currently hovering. Kept across re-renders so
  // the 1s auto-refresh cannot close a group the admin just hovered open.
  // The group the mouse is currently over (survives re-renders, so a hover-opened
  // group is not closed by the dashboard's 1s auto-refresh re-rendering the sidebar).
  _hoverGroup: null,
  // Hover in: open the group and remember it
// Hover in: remembers the group and opens it.
  openGroup(id) {
    AdminComponents._hoverGroup=id;
    const el=document.getElementById(`${id}-group`);
    if(el) el.classList.add('open');
  },
// Closes a group and forgets it as the hovered group.
  closeGroup(id) {
    if(AdminComponents._hoverGroup===id) AdminComponents._hoverGroup=null;
    const el=document.getElementById(`${id}-group`);
    if(el) el.classList.remove('open');
  },
  // Hover out: close it again, unless the current page lives inside it
// Hover out: closes the group, unless the current page lives inside it.
  maybeCloseGroup(id) {
    if(AdminComponents._hoverGroup===id) AdminComponents._hoverGroup=null;
    if(AdminComponents._activeGroup()!==id) AdminComponents.closeGroup(id);
  },
  // After every render: keep the active group AND the hovered group open, close the rest
// After every render: keeps the active group and the hovered group open
  // and closes the rest.
  syncGroups() {
    const active=AdminComponents._activeGroup();
    const hover=AdminComponents._hoverGroup;
    ['general','team','content','payment'].forEach(id=>{
      const el=document.getElementById(`${id}-group`);
      if(el) el.classList.toggle('open', id===active||id===hover);
    });
  },

// Fetches unread admin notifications (adminApi.notifications) and stores
  // the count, so the sidebar and top bar badges stay in sync.
  async loadBadges() {
    try{const d=await adminApi.notifications();AdminApp.state.notifCount=d.unread||0;}catch(e){}
  }
};
