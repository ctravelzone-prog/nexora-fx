/*
 * admin-users3.js — Showcase Accounts page.
 *
 * Renders /admin/showcase: demo accounts with admin-set DISPLAY balances
 * (Main / Copy / Profit / Total Withdraw) and Create / Edit / Delete
 * actions. Showcase profit follows the same 10% over 22 days schedule,
 * applied to the Display Copy balance.
 * Key functions: AdminPages.showcase, AdminPages._newShowcase,
 * AdminPages._editShowcase, AdminPages._delShowcase, AdminPages._doDelShowcase.
 *
 * Gotchas:
 * - Showcase accounts are demo accounts only: their DISPLAY balances are
 *   not real money and they are excluded from all admin totals, ledgers
 *   and reports. Real and showcase accounts are never mixed.
 * - Dollar inputs are converted to integer cents before saving; a blank
 *   field counts as 0. Leaving the password empty on edit keeps the
 *   current password.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/showcase: demo accounts with DISPLAY Main / Copy /
  // Profit / Total Withdraw balances. Data: adminApi.getShowcaseUsers.
AdminPages.showcase=async function(){
  try{
    const users=await adminApi.getShowcaseUsers();
    AdminComponents.layout(`<div class="flex items-center justify-between mb-4"><h2 class="font-bold text-lg">Showcase Accounts</h2><button onclick="AdminPages._newShowcase()" class="btn-primary text-sm" style="width:auto;padding:10px 16px">+ Create Showcase</button></div>
    <p class="text-sm text-gray-400 mb-4">Showcase accounts are excluded from all admin totals, ledger totals, reports, and Profit System. Real accounts and showcase accounts are never mixed.</p>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Name</th><th>Username</th><th>Display Main</th><th>Display Copy</th><th>Display Profit</th><th>Display Withdraw</th><th>Actions</th></tr></thead><tbody>
      ${users.map(u=>`<tr><td>${u.full_name} <span class="badge badge-gray text-xs">SHOWCASE</span></td><td>@${u.username}</td><td>${utils.fmtMoney(u.showcase_main_cents||0)}</td><td>${utils.fmtMoney(u.showcase_copy_cents||0)}</td><td>${utils.fmtMoney(u.showcase_profit_cents||0)}</td><td>${utils.fmtMoney(u.showcase_withdraw_cents||0)}</td><td><div style="display:flex;gap:8px;white-space:nowrap"><button onclick="AdminPages._editShowcase(${u.id})" class="btn-secondary text-sm" style="padding:8px 14px;display:inline-block;width:auto">Edit</button><button onclick="AdminPages._delShowcase(${u.id},'${(u.full_name||'').replace(/'/g,"\\'")}')" class="text-sm text-white rounded-xl px-4 py-2 font-semibold" style="background:#DC2626;padding:8px 14px;display:inline-block;width:auto">Delete</button></div></td></tr>`).join('')}
      ${users.length===0?'<tr><td colspan="7" class="text-center py-8 text-gray-400">No showcase accounts yet</td></tr>':''}
    </tbody></table></div>`,'Showcase Accounts');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Opens the Create Showcase Account modal and saves it via
  // adminApi.createShowcase.
AdminPages._newShowcase=function(){
  utils.showModal(`<div class="modal"><h2 class="font-bold mb-4">Create Showcase Account</h2>
  <form id="sc-form" class="space-y-3">
    <div><label class="input-label">Full Name</label><input name="full_name" type="text" class="input-field" required></div>
    <div><label class="input-label">Username</label><input name="username" type="text" class="input-field" required></div>
    <div><label class="input-label">Email</label><input name="email" type="email" class="input-field" required></div>
    <div><label class="input-label">Password (min 8 chars)</label><input name="password" type="password" class="input-field" required minlength="8"></div>
    <div class="grid grid-cols-2 gap-2">
      <div><label class="input-label">Display Main</label><input name="main" type="number" class="input-field" placeholder="0"></div>
      <div><label class="input-label">Display Copy</label><input name="copy" type="number" class="input-field" placeholder="0"></div>
      <div><label class="input-label">Display Profit</label><input name="profit" type="number" class="input-field" placeholder="0"></div>
      <div><label class="input-label">Display Total Withdraw</label><input name="withdraw" type="number" class="input-field" placeholder="0"></div>
    </div>
    <div id="sc-e" class="alert-danger hidden"></div>
    <div class="flex gap-3"><button type="button" onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button type="submit" class="btn-primary flex-1">Create</button></div>
  </form></div>`);
  document.getElementById('sc-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,err=document.getElementById('sc-e');
    try{
      // Convert dollar inputs to integer cents; a blank field counts as 0.
      await adminApi.createShowcase({full_name:f.full_name.value,username:f.username.value,email:f.email.value,password:f.password.value,main_cents:Math.round((parseFloat(f.main.value)||0)*100),copy_cents:Math.round((parseFloat(f.copy.value)||0)*100),profit_cents:Math.round((parseFloat(f.profit.value)||0)*100),withdraw_cents:Math.round((parseFloat(f.withdraw.value)||0)*100)});
      utils.closeModal();utils.toast('Showcase account created!','success');AdminPages.showcase();
    }catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
  };
};
// Loads showcase users via adminApi.getShowcaseUsers, finds the account
  // and opens the pre-filled edit modal; saving goes through
  // adminApi.updateShowcase.
AdminPages._editShowcase=async function(id){
  try{
    const users=await adminApi.getShowcaseUsers();
    const u=users.find(x=>x.id===id);
    if(!u){utils.toast('Showcase account not found','error');return;}
    utils.showModal(`<div class="modal"><h2 class="font-bold mb-4">Edit Showcase Account</h2>
  <form id="sc-edit-form" class="space-y-3">
    <div><label class="input-label">Full Name</label><input name="full_name" type="text" class="input-field" required value="${(u.full_name||'').replace(/"/g,'&quot;')}"></div>
    <div><label class="input-label">Username</label><input name="username" type="text" class="input-field" required value="${(u.username||'').replace(/"/g,'&quot;')}"></div>
    <div><label class="input-label">Email</label><input name="email" type="email" class="input-field" required value="${(u.email||'').replace(/"/g,'&quot;')}"></div>
    <div><label class="input-label">New Password (leave empty to keep current)</label><input name="password" type="password" class="input-field" minlength="8" placeholder="Min 8 chars"></div>
    <div class="grid grid-cols-2 gap-2">
      <div><label class="input-label">Display Main</label><input name="main" type="number" step="0.01" class="input-field" value="${((u.showcase_main_cents||0)/100)}"></div>
      <div><label class="input-label">Display Copy</label><input name="copy" type="number" step="0.01" class="input-field" value="${((u.showcase_copy_cents||0)/100)}"></div>
      <div><label class="input-label">Display Profit</label><input name="profit" type="number" step="0.01" class="input-field" value="${((u.showcase_profit_cents||0)/100)}"></div>
      <div><label class="input-label">Display Total Withdraw</label><input name="withdraw" type="number" step="0.01" class="input-field" value="${((u.showcase_withdraw_cents||0)/100)}"></div>
    </div>
    <p class="text-xs text-gray-400">Display balances are demo numbers only — they never appear in admin totals, ledgers or reports. Profit (10% target over 22 days) is applied automatically on the Display Copy balance.</p>
    <div id="sc-e" class="alert-danger hidden"></div>
    <div class="flex gap-3"><button type="button" onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button type="submit" class="btn-primary flex-1">Save</button></div>
  </form></div>`);
    document.getElementById('sc-edit-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('sc-e');
      const q=n=>f.querySelector('[name="'+n+'"]');
      const d={full_name:q('full_name').value,username:q('username').value,email:q('email').value,main_cents:Math.round((parseFloat(q('main').value)||0)*100),copy_cents:Math.round((parseFloat(q('copy').value)||0)*100),profit_cents:Math.round((parseFloat(q('profit').value)||0)*100),withdraw_cents:Math.round((parseFloat(q('withdraw').value)||0)*100)};
      if(q('password').value) d.password=q('password').value;
      try{ await adminApi.updateShowcase(id,d); utils.closeModal(); utils.toast('Showcase account updated!','success'); AdminPages.showcase(); }
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
    };
  }catch(e){utils.toast(e.message,'error');}
};
// Opens the Delete Showcase Account confirmation modal.
AdminPages._delShowcase=function(id,name){utils.showModal(`<div class="modal"><h2 class="font-bold mb-3" style="color:#DC2626">Delete Showcase Account?</h2><p class="text-sm text-gray-500 mb-3">This permanently deletes showcase account <b>${name}</b> and its display-profit history. This cannot be undone.</p><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="AdminPages._doDelShowcase(${id})" class="flex-1 text-white font-semibold rounded-xl px-4 py-2" style="background:#DC2626">Delete Permanently</button></div></div>`);};
// Deletes the showcase account via adminApi.deleteShowcase and
  // returns to the showcase list.
AdminPages._doDelShowcase=async function(id){try{await adminApi.deleteShowcase(id);utils.closeModal();utils.toast('Showcase account deleted','success');AdminPages.showcase();}catch(e){utils.toast(e.message,'error');}};
