/*
 * admin-users.js — Users list page.
 *
 * Renders /admin/users: searchable table of users with Main balance, KYC
 * status, active/disabled state and joined date, plus View and +Bal
 * (Add Balance) actions per row.
 * Key functions: AdminPages.users, AdminPages._uRows, AdminPages._searchU.
 *
 * Gotchas:
 * - A per-user profit target badge (e.g. "Profit 15%") shows only when the
 *   user has a custom profit_target_bp; otherwise the global target applies.
 * - Search reuses the same row renderer, so the table updates in place
 *   without a full page reload.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/users: searchable user table with Main balance, KYC
  // status and active state. Fetches up to 50 users via adminApi.getUsers.
AdminPages.users=async function(){
  try{
    const users=await adminApi.getUsers({limit:50});
    AdminComponents.layout(`<div class="flex items-center justify-between mb-4"><h2 class="font-bold text-lg">Users</h2>
      <input id="usearch" type="text" placeholder="Search..." class="input-field text-sm" style="width:220px" oninput="AdminPages._searchU(this.value)"></div>
      <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Name</th><th>Username</th><th>Main</th><th>KYC</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody id="users-tbody">
        ${AdminPages._uRows(users)}</tbody></table></div>`,'Users');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Builds the table rows for a user list, including the per-user profit
  // target badge when a custom target is set. Returns an empty-state row
  // when the list is empty.
AdminPages._uRows=function(us){
  return us.map(u=>`<tr><td data-label="Name"><div><div class="font-semibold">${u.full_name}</div><div class="text-xs text-gray-400">${u.email}</div>${u.profit_target_bp!=null?'<div class="mt-1"><span style="background:#FFF7ED;color:#FF6A00;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px">Profit '+(u.profit_target_bp/100)+'%</span></div>':''}</div></td><td data-label="Username">@${u.username}</td><td data-label="Main">${utils.fmtMoney(u.main_cents||0)}</td><td data-label="KYC">${utils.statusBadge(u.kyc_status)}</td><td data-label="Status">${u.is_active?'<span class="badge badge-green">Active</span>':'<span class="badge badge-red">Disabled</span>'}</td><td data-label="Joined" class="text-xs">${utils.fmtDate(u.created_at)}</td><td data-label="Actions"><div style="display:flex;gap:8px;white-space:nowrap"><button onclick="AdminPages.viewUser(${u.id})" class="btn-secondary text-sm" style="padding:8px 14px;display:inline-block;width:auto">View</button><button onclick="AdminPages._addBal(${u.id})" class="btn-primary text-sm" style="padding:8px 14px;display:inline-block;width:auto">+Bal</button></div></td></tr>`).join('')||'<tr><td colspan="7" class="text-center py-8 text-gray-400">No users</td></tr>';
};
// Live search: fetches matching users via adminApi.getUsers and swaps
  // only the table body, so the page does not reload.
AdminPages._searchU=async function(q){try{const u=await adminApi.getUsers({search:q,limit:50});document.getElementById('users-tbody').innerHTML=AdminPages._uRows(u);}catch(e){}};
