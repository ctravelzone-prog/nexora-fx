/*
 * admin-dashboard.js — Admin Dashboard and Admin Notifications pages.
 *
 * Renders the /admin/dashboard overview (platform totals and recent activity)
 * and the /admin/notifications list (click a row to mark it read and jump to
 * its destination page).
 * Key functions: AdminPages.dashboard, AdminPages.notifications.
 *
 * Gotchas:
 * - Both pages capture AdminApp._gen before their API call and skip rendering
 *   if navigation happened while the request was in flight.
 * - Dashboard totals exclude showcase accounts; referral totals are one-time
 *   4% commissions on a referred user's first deposit.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/dashboard: platform total cards plus the 12 most recent
  // activity items. Data comes from adminApi.dashboard().
AdminPages.dashboard=async function(){
  try{
    const _gen=AdminApp._gen;
    const d=await adminApi.dashboard();if(_gen!==AdminApp._gen)return;const s=d.stats;
    AdminComponents.layout(`
      <div class="flex items-center justify-between mb-6">
        <div><h2 class="text-xl font-bold">Admin Dashboard</h2><p class="text-sm text-gray-400">Platform totals at a glance — all figures are sample design data.</p></div>
        <div class="flex gap-3"><button onclick="AdminApp.navigate('/admin/reports')" class="btn-secondary text-sm" style="padding:8px 16px">Reports</button><button onclick="AdminApp.navigate('/admin/send-notification')" class="btn-primary text-sm" style="width:auto;padding:8px 16px">Send Notification</button></div>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        ${[['TOTAL USERS',s.totalUsers,`+${s.newThisWeek} this week`,''],['TOTAL DEPOSIT',utils.fmtMoney(s.totalDeposit),'All time, approved only',''],['TOTAL WITHDRAW',utils.fmtMoney(s.totalWithdraw),'Paid out, all time',''],['PENDING DEPOSIT',`${s.pendingDepCount} · ${utils.fmtMoney(s.pendingDepAmount)}`,'Waiting for review','text-orange-500'],['PENDING WITHDRAW',`${s.pendingWdCount} · ${utils.fmtMoney(s.pendingWdAmount)}`,'Main & Profit','text-orange-500'],['PENDING KYC',s.pendingKyc,'Documents to review','text-orange-500'],['OPEN TICKETS',s.openTickets,`${s.highTickets} high priority`,'text-orange-500'],['TOTAL MAIN BALANCE',utils.fmtMoney(s.totalMain),'Across all users',''],['TOTAL COPY INVESTED',utils.fmtMoney(s.totalCopy),'Active copies',''],['TOTAL PROFIT PAID',utils.fmtMoney(s.totalProfit),'Credited system-wide','text-green-500'],["TODAY'S DAILY PnL TOTAL",utils.fmtMoney(s.todayPnl),'Applied to all copies','text-green-500'],['TOTAL REFERRAL PAID',utils.fmtMoney(s.totalRef),'One-time 4% commissions','']].map(([l,v,sub,cls])=>`<div class="card"><div class="text-xs text-gray-400 uppercase font-semibold mb-1">${l}</div><div class="text-xl font-bold ${cls}">${v}</div><div class="text-xs text-gray-400 mt-1">${sub}</div></div>`).join('')}
      </div>
      <h3 class="font-bold mb-3">Recent Activity</h3>
      <div class="card">
        ${d.activity.slice(0,12).map(a=>`<div class="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
          <div class="w-8 h-8 rounded-full flex-shrink-0 ${a.atype==='deposit'?'bg-green-100 text-green-600':a.atype==='withdrawal'?'bg-red-100 text-red-600':a.atype==='new_user'?'bg-blue-100 text-blue-600':'bg-amber-100 text-amber-600'} flex items-center justify-center text-sm font-bold">${a.atype==='deposit'?'↓':a.atype==='withdrawal'?'↑':a.atype==='new_user'?'👤':'📋'}</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm">${a.atype==='deposit'?`Deposit request — ${utils.fmtMoney(a.amount_cents)}`:a.atype==='withdrawal'?`${a.status==='paid'?'Profit withdraw paid':'Withdraw request'} — ${utils.fmtMoney(a.amount_cents)}`:a.atype==='new_user'?`${a.full_name} <span class="badge badge-green text-xs ml-1">NEW USER JOINED</span>`:`KYC submitted`}</div>
            <div class="text-xs text-gray-400">${a.username?`${a.username} · `:''}<span class="cursor-pointer text-blue-500" onclick="AdminApp.navigate('/admin/users/${a.id||''}')">${a.full_name||''}</span></div>
          </div>
          <div class="text-xs text-gray-400">${utils.timeAgo(a.created_at)}</div>
        </div>`).join('')}
        ${d.activity.length===0?'<p class="text-center py-8 text-gray-400">No recent activity</p>':''}
      </div>
    `,'Admin Dashboard');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};

// Renders /admin/notifications: unread count, Mark All Read, and the list.
  // Clicking a row marks it read and jumps to its destination page.
AdminPages.notifications=async function(){
  try{
    const _gen=AdminApp._gen;
    const d=await adminApi.notifications();if(_gen!==AdminApp._gen)return;
    AdminComponents.layout(`
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-lg">Admin Notifications ${d.unread>0?`<span class="badge badge-orange ml-2">${d.unread}</span>`:''}</h2>
        <button onclick="adminApi.readAllNotifs().then(()=>{utils.toast('All read','info');AdminPages.notifications();})" class="btn-secondary text-sm" style="padding:8px 16px">Mark All Read</button>
      </div>
      <div class="grid gap-3">
        ${d.notifications.map(n=>`<div class="card ${!n.is_read?'border-l-4 border-orange-400':''} cursor-pointer" onclick="adminApi.readNotif(${n.id}).catch(()=>{});${n.destination_pane?`AdminApp.navigate('/admin/${n.destination_pane}')`:``}"><div class="flex items-start gap-3"><div class="w-8 h-8 rounded-full flex-shrink-0 ${n.type==='deposit'?'bg-green-100 text-green-600':n.type==='withdraw'?'bg-red-100 text-red-600':n.type==='kyc'?'bg-amber-100 text-amber-600':'bg-blue-100 text-blue-600'} flex items-center justify-center text-sm">${n.type==='deposit'?'↓':n.type==='withdraw'?'↑':n.type==='kyc'?'🛡':'ℹ'}</div><div class="flex-1 min-w-0"><div class="font-semibold text-sm">${n.title}</div>${n.message?`<div class="text-sm text-gray-600 mt-1">${n.message}</div>`:''}${n.user_name?`<div class="text-xs text-gray-500 mt-1">👤 ${n.user_name}${n.user_username?` (@${n.user_username})`:''}${n.user_email?` · ${n.user_email}`:''}</div>`:''}<div class="text-xs text-gray-400 mt-1">${utils.timeAgo(n.created_at)} · ${utils.fmtDateTime(n.created_at)}</div></div><div class="flex flex-col items-end gap-1 flex-shrink-0"><span class="badge badge-gray text-xs">${n.type}</span>${!n.is_read?'<div class="w-2 h-2 bg-orange-500 rounded-full mt-1"></div>':''}</div></div></div>`).join('')}
        ${d.notifications.length===0?'<div class="card text-center py-12 text-gray-400">No notifications</div>':''}
      </div>`,'Admin Notifications');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
