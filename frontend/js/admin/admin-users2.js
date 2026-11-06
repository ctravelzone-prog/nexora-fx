/*
 * admin-users2.js — User detail page and user actions.
 *
 * Renders /admin/users/:id: Main / Copy / Profit cards, account facts, and
 * the action buttons Add Balance, Set Temp Password, Disable / Enable,
 * Login As User, Set Profit Target and Delete User.
 * Key functions: AdminPages.viewUser, AdminPages._addBal, AdminPages._setTmp,
 * AdminPages._doTmp, AdminPages._loginAs, AdminPages._setProfitTarget,
 * AdminPages._doProfitTarget, AdminPages._delUser, AdminPages._doDelUser.
 *
 * Gotchas:
 * - A one-time temporary password is 8 digits, valid 24 hours, single use,
 *   and works as the current password so the user can set a new one.
 * - Login As User saves the admin's own user token first, so the session
 *   can be restored afterwards.
 * - Delete User is permanent and removes balances, copies, deposits,
 *   withdrawals, transactions, tickets and referrals. Demo showcase users
 *   cannot be deleted from here.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/users/:id: Main / Copy / Profit cards, account facts
  // and the action buttons. Data comes from adminApi.getUser(id).
AdminPages.viewUser=async function(id){
  try{
    const u=await adminApi.getUser(id);
    AdminComponents.layout(`<div class="flex items-center gap-3 mb-4"><button onclick="AdminPages.users()" class="p-2 rounded-lg hover:bg-gray-100">← Users</button><h2 class="font-bold text-lg">${u.full_name}</h2></div>
    <div class="grid grid-cols-3 gap-4 mb-4">
      <div class="card"><div class="text-xs text-gray-400 uppercase mb-1">Main</div><div class="text-xl font-bold">${utils.fmtMoney(u.main_cents||0)}</div></div>
      <div class="card"><div class="text-xs text-gray-400 uppercase mb-1">Copy</div><div class="text-xl font-bold text-orange-500">${utils.fmtMoney(u.copy_cents||0)}</div></div>
      <div class="card"><div class="text-xs text-gray-400 uppercase mb-1">Profit</div><div class="text-xl font-bold profit">${utils.fmtMoney(u.profit_cents||0)}</div></div>
    </div>
    <div class="card mb-4 text-sm grid grid-cols-2 gap-3"><div><span class="text-gray-400">Email:</span> ${u.email}</div><div><span class="text-gray-400">KYC:</span> ${utils.statusBadge(u.kyc_status)}</div><div><span class="text-gray-400">Joined:</span> ${utils.fmtDate(u.created_at)}</div><div><span class="text-gray-400">Deposited:</span> ${utils.fmtMoney(u.total_deposited_cents||0)}</div><div><span class="text-gray-400">Profit Target:</span> ${u.profit_target_bp!=null?'<b>'+(u.profit_target_bp/100)+'%</b>':'Global default'}</div></div>
    <div class="flex flex-wrap gap-3">
      <button onclick="AdminPages._addBal(${u.id})" class="btn-primary text-sm" style="width:auto;padding:10px 16px">Add Balance</button>
      <button onclick="AdminPages._setTmp(${u.id})" class="btn-secondary text-sm" style="padding:10px 16px">Set Temp Password</button>
      <button onclick="adminApi.toggleUser(${u.id}).then(()=>{utils.toast('Done','success');AdminPages.viewUser(${u.id});}).catch(e=>utils.toast(e.message,'error'))" class="btn-secondary text-sm" style="padding:10px 16px">${u.is_active?'Disable':'Enable'}</button>
      <button onclick="AdminPages._loginAs(${u.id})" class="text-sm border border-orange-400 text-orange-500 rounded-xl px-4 py-2 font-semibold">Login As User</button>
      <button onclick="AdminPages._setProfitTarget(${u.id},${u.profit_target_bp==null?'null':u.profit_target_bp})" class="btn-secondary text-sm" style="width:auto;padding:10px 16px">Set Profit Target</button>
      <button onclick="AdminPages._delUser(${u.id},'${(u.full_name||'').replace(/'/g,"\\'")}')" class="text-sm rounded-xl px-4 py-2 font-semibold text-white" style="background:#DC2626;padding:10px 16px;width:auto">Delete User</button>
    </div>`,'User Detail');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Opens the Set Profit Target modal for one user. The field is empty
  // when the user follows the global target.
AdminPages._setProfitTarget=function(id,cur){utils.showModal(`<div class="modal"><h2 class="font-bold mb-3">Profit Target #${id}</h2><p class="text-sm text-gray-400 mb-3">22-day total for this user. Leave empty to use the global target.</p><label class="input-label">Profit Target (%)</label><input id="pt-v" type="number" step="0.1" min="0" max="100" class="input-field mb-3" value="${cur==null?'':cur/100}" placeholder="Global default"><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="AdminPages._doProfitTarget(${id})" class="btn-primary flex-1">Save</button></div></div>`);};
// Saves the per-user profit target via adminApi.setUserProfitTarget.
  // An empty value (null) clears it back to the global target.
AdminPages._doProfitTarget=async function(id){const v=document.getElementById('pt-v').value;const bp=(v===''||v==null)?null:Math.round(parseFloat(v)*100);try{await adminApi.setUserProfitTarget(id,{profit_target_bp:bp});utils.closeModal();utils.toast('Saved!','success');AdminPages.viewUser(id);}catch(ex){utils.toast(ex.message,'error');}};
// Opens the Add Balance modal (amount, Main or Profit, reason).
AdminPages._addBal=function(id){utils.showModal(`<div class="modal"><h2 class="font-bold mb-3">Add Balance #${id}</h2><label class="input-label">Amount</label><input id="ba-a" type="number" step="0.01" class="input-field mb-2"><label class="input-label">Type</label><select id="ba-t" class="input-field mb-2"><option value="main">Main</option><option value="profit">Profit</option></select><label class="input-label">Reason</label><input id="ba-r" type="text" class="input-field mb-3"><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="adminApi.addBalance(${id},{amount:parseFloat(document.getElementById('ba-a').value),type:document.getElementById('ba-t').value,reason:document.getElementById('ba-r').value}).then(()=>{utils.closeModal();utils.toast('Added!','success');AdminPages.viewUser(${id});}).catch(e=>utils.toast(e.message,'error'))" class="btn-primary flex-1">Add</button></div></div>`);};
// Opens the Set Temp Password modal (minimum 8 characters).
AdminPages._setTmp=function(id){utils.showModal(`<div class="modal"><h2 class="font-bold mb-3">Set Temp Password</h2><input id="tp" type="password" class="input-field mb-3" minlength="8" placeholder="Min 8 chars"><div id="tp-e" class="alert-danger hidden mb-2"></div><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="AdminPages._doTmp(${id})" class="btn-primary flex-1">Set</button></div></div>`);};
// Validates the temporary password (min 8 chars), then saves it via
  // adminApi.setTempPassword.
AdminPages._doTmp=async function(id){const p=document.getElementById('tp').value,e=document.getElementById('tp-e');if(p.length<8){e.textContent='Min 8 chars';e.classList.remove('hidden');return;}try{await adminApi.setTempPassword(id,{temp_password:p});utils.closeModal();utils.toast('Set!','success');}catch(ex){e.textContent=ex.message;e.classList.remove('hidden');}};
// Logs in as the user in a new tab via adminApi.loginAsUser. The
  // admin's own user token is saved first so it can be restored.
AdminPages._loginAs=async function(id){try{const d=await adminApi.loginAsUser(id);if(d.token){const cur=api.getToken();if(cur)localStorage.setItem('nx_prev_user_token',cur);api.setToken(d.token);window.open('/dashboard','_blank');utils.toast('Logged in as user in new tab.','success');}}catch(e){utils.toast(e.message,'error');}};
// Opens the Delete User confirmation modal, listing everything that
  // will be permanently removed.
AdminPages._delUser=function(id,name){utils.showModal(`<div class="modal"><h2 class="font-bold mb-3" style="color:#DC2626">Delete User #${id}?</h2><p class="text-sm text-gray-500 mb-3">This permanently deletes <b>${name}</b> and ALL of their data — balance, copies, deposits, withdrawals, transactions, tickets and referrals. This cannot be undone.</p><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="AdminPages._doDelUser(${id})" class="flex-1 text-white font-semibold rounded-xl px-4 py-2" style="background:#DC2626">Delete Permanently</button></div></div>`);};
// Deletes the user via adminApi.deleteUser and returns to the list.
AdminPages._doDelUser=async function(id){try{await adminApi.deleteUser(id);utils.closeModal();utils.toast('User deleted','success');AdminPages.users();}catch(e){utils.toast(e.message,'error');}};
