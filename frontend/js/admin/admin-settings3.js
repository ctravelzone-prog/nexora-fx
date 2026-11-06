/*
 * admin-settings3.js — 2FA Control, KYC Control, Audit Log, Reports.
 *
 * Renders /admin/2fa-control (admin and user 2FA switches, both OFF by
 * default), /admin/kyc-control (global KYC switch plus single-user KYC
 * requests), /admin/audit-log (who changed what, before/after) and
 * /admin/reports (platform totals).
 * Key functions: AdminPages.twoFAControl, AdminPages._set2FA,
 * AdminPages.kycControl, AdminPages._requestSingleKYC,
 * AdminPages._cancelSingleKYC, AdminPages._setKYC, AdminPages.auditLog,
 * AdminPages.reports.
 *
 * Gotchas:
 * - The 2FA / KYC switches flip back visually until the admin confirms;
 *   the saved value only changes after OK is pressed.
 * - KYC OFF means no banner and no block. Global KYC ON notifies all
 *   users; a single-user request affects only that user, even with global
 *   KYC OFF. Verified and pending users are excluded from bulk actions.
 * - 2FA and KYC changes are audit-logged.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/2fa-control: Admin 2FA and User 2FA switches, both OFF
  // by default. State comes from adminApi.get2FAControl.
AdminPages.twoFAControl=async function(){
  try{
    const s=await adminApi.get2FAControl();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">2FA Control</h2>
    <div class="alert-info mb-4 text-sm">Both switches are <strong>OFF at start</strong>. Admin login is password-only by default. User login is password-only until you enable user 2FA here.</div>
    <div class="card" style="max-width:480px">
      <div class="switch-row">
        <div class="grow"><b>Admin 2FA</b><p>Require 2FA for admin login (admin panel)</p></div>
        <label class="switch"><input type="checkbox" ${s.admin_2fa_enabled==='1'?'checked':''} onchange="AdminPages._set2FA('admin',this)"><i></i></label>
      </div>
      <div class="switch-row">
        <div class="grow"><b>User 2FA</b><p>Allow users to enable 2FA on their accounts</p></div>
        <label class="switch"><input type="checkbox" ${s.user_2fa_enabled==='1'?'checked':''} onchange="AdminPages._set2FA('user',this)"><i></i></label>
      </div>
    </div>`,'2FA Control');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Asks for confirmation before saving a 2FA switch via
  // adminApi.set2FAControl. The switch flips back until OK is pressed.
AdminPages._set2FA=function(type,cb){
  const en=cb.checked;cb.checked=!en; // switch stays on the saved value until OK is pressed
  utils.confirm(`${en?'Enable':'Disable'} ${type} 2FA? This is audit-logged.`,async()=>{
    try{await adminApi.set2FAControl(type==='admin'?{admin_2fa_enabled:en}:{user_2fa_enabled:en});utils.toast('Done!','success');AdminPages.twoFAControl();}
    catch(e){utils.toast(e.message,'error');AdminPages.twoFAControl();}
  },en?'Enable':'Disable');
};

// Renders /admin/kyc-control: the global KYC switch, the single-user
  // KYC request form, and the list of users KYC was requested from.
  // Data: adminApi.getKYCControl and adminApi.getUsers.
AdminPages.kycControl=async function(){
  try{
    const d=await adminApi.getKYCControl();
    let users=[];try{users=await adminApi.getUsers({limit:200});}catch(_){}
    const requested=d.requested_users||[];
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">KYC Control</h2>
    <div class="alert-info mb-4 text-sm">KYC is <strong>OFF by default</strong>. OFF = no banner, no block. ON = Action Required notification sent to all users.</div>
    <div class="card mb-4" style="max-width:480px">
      <div class="switch-row">
        <div class="grow"><b>KYC Required</b><p>Show KYC banner and send action notifications to users</p></div>
        <label class="switch"><input type="checkbox" ${d.kyc_enabled==='1'?'checked':''} onchange="AdminPages._setKYC(this)"><i></i></label>
      </div>
    </div>
    <div class="card" style="max-width:480px">
      <div class="mb-3"><b>Request KYC \u2014 Single User</b><p class="text-sm text-gray-400 mt-1">Select one user. Only that user will see the KYC banner and get an Action Required notification, even when KYC Required above is OFF. Other users are not affected.</p></div>
      <label class="input-label">Select User</label>
      <select id="kyc-single-user" class="input-field mb-3"><option value="">Select a user\u2026</option>${users.map(u=>`<option value="${u.id}">${u.full_name} (@${u.username}) \u2014 ${u.kyc_status}</option>`).join('')}</select>
      <button onclick="AdminPages._requestSingleKYC()" class="btn-primary">Request KYC</button>
      ${requested.length?`<div class="mt-4 pt-4" style="border-top:1px solid var(--border)"><b class="text-sm">KYC requested from</b>${requested.map(u=>`<div class="flex items-center justify-between gap-2 py-2"><div class="text-sm"><span class="font-semibold">${u.full_name}</span> <span class="text-gray-400">@${u.username}</span> ${utils.statusBadge(u.kyc_status)}</div><button onclick="AdminPages._cancelSingleKYC(${u.id})" class="btn-secondary text-sm" style="padding:6px 12px">Cancel</button></div>`).join('')}</div>`:''}
    </div>`,'KYC Control');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Requests KYC from the selected user only, via
  // adminApi.requestSingleKYC. Other users are not affected.
AdminPages._requestSingleKYC=function(){
  const sel=document.getElementById('kyc-single-user');const id=sel.value;
  if(!id){utils.toast('Please select a user first','error');return;}
  const name=sel.selectedOptions[0].text;
  utils.confirm(`Request KYC from ${name}? Only this user will be asked.`,async()=>{
    try{const r=await adminApi.requestSingleKYC({user_id:parseInt(id)});utils.toast(r.already_requested?'KYC already requested from this user':'KYC requested!','success');AdminPages.kycControl();}
    catch(e){utils.toast(e.message,'error');}
  },'Request KYC');
};
// Cancels a single-user KYC request via adminApi.cancelSingleKYC, so
  // the user no longer sees the KYC banner.
AdminPages._cancelSingleKYC=function(id){
  utils.confirm('Cancel this single-user KYC request? The user will no longer see the KYC banner.',async()=>{
    try{await adminApi.cancelSingleKYC({user_id:id});utils.toast('KYC request cancelled','success');AdminPages.kycControl();}
    catch(e){utils.toast(e.message,'error');}
  },'Cancel Request');
};
// Asks for confirmation before saving the global KYC switch via
  // adminApi.setKYCControl. The switch flips back until OK is pressed.
AdminPages._setKYC=function(cb){
  const en=cb.checked;cb.checked=!en; // switch stays on the saved value until OK is pressed
  utils.confirm(`${en?'Enable':'Disable'} KYC requirement? Audit-logged.`,async()=>{
    try{await adminApi.setKYCControl({kyc_enabled:en});utils.toast('Done!','success');AdminPages.kycControl();}
    catch(e){utils.toast(e.message,'error');AdminPages.kycControl();}
  },en?'Enable':'Disable');
};


// Renders /admin/audit-log: admin email, action, before/after values
  // and date. Data comes from adminApi.getAuditLog().
AdminPages.auditLog=async function(){
  try{
    const rows=await adminApi.getAuditLog();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Audit Log</h2>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Admin</th><th>Action</th><th>Before</th><th>After</th><th>Date</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${r.admin_email||'system'}</td><td class="text-sm">${r.action}</td><td class="text-xs text-gray-400 max-w-xs truncate">${r.before_value||'—'}</td><td class="text-xs text-gray-400 max-w-xs truncate">${r.after_value||'—'}</td><td class="text-xs">${utils.fmtDateTime(r.created_at)}</td></tr>`).join('')}
      ${rows.length===0?'<tr><td colspan="5" class="text-center py-8 text-gray-400">No audit records</td></tr>':''}
    </tbody></table></div>`,'Audit Log');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};

// Renders /admin/reports: deposit, withdrawal, profit paid, referral
  // paid, user and active-copy totals via adminApi.getReports().
AdminPages.reports=async function(){
  try{
    const r=await adminApi.getReports();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Reports</h2>
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      ${[['Total Deposits',utils.fmtMoney(r.total_deposit),'profit'],['Total Withdrawals',utils.fmtMoney(r.total_withdraw),'loss'],['Total Profit Paid',utils.fmtMoney(r.total_profit_paid),'profit'],['Total Referral Paid',utils.fmtMoney(r.total_referral_paid),'profit'],['Total Users',r.new_users,''],['Active Copies',r.active_copies,'text-orange-500']].map(([l,v,c])=>`<div class="card"><div class="text-xs text-gray-400 uppercase mb-1">${l}</div><div class="text-2xl font-bold ${c}">${v}</div></div>`).join('')}
    </div>`,'Reports');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
