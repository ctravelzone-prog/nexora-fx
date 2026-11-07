/*
 * admin-profile-requests.js — Profile Change Requests page.
 *
 * Renders /admin/profile-requests: users who asked to change their email
 * or phone number. Users cannot change those fields themselves — the admin
 * approves (the new value is applied to the account) or rejects it.
 * Key functions: AdminPages.profileRequests, AdminPages._approveProfileReq,
 * AdminPages._rejectProfileReq.
 *
 * Gotchas:
 * - Approve re-checks the value is still free on the server; if another
 *   user took it meanwhile, the server answers 400 and the request stays pending.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/profile-requests: email/phone change requests, pending first.
  // Data comes from adminApi.getProfileRequests().
AdminPages.profileRequests=async function(){
  try{
    const _gen=AdminApp._gen;
    const rows=await adminApi.getProfileRequests();if(_gen!==AdminApp._gen)return;
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Profile Change Requests</h2>
    <div class="alert-info mb-4 text-sm">User email ba phone nije bodlate pare na — ekhane request asbe. <strong>Approve</strong> korle notun value account-e boshe jabe, <strong>Reject</strong> korle ager tai thakbe.</div>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>User</th><th>Field</th><th>Current</th><th>Requested</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${r.full_name} (@${r.username})<div class="text-xs text-gray-400">${r.email}</div></td><td class="text-sm">${r.field==='email'?'Email':'Phone'}</td><td class="text-sm">${r.old_value||'—'}</td><td class="text-sm font-semibold">${r.new_value}${r.field==='phone'&&r.country_code?` <span class="text-xs text-gray-400">(${r.country_code})</span>`:''}</td><td>${utils.statusBadge(r.status)}</td><td class="text-xs">${utils.fmtDateTime(r.created_at)}</td><td>${r.status==='pending'?`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button onclick="AdminPages._approveProfileReq(${r.id})" class="btn-primary text-xs" style="width:auto;padding:6px 12px;white-space:nowrap">Approve</button><button onclick="AdminPages._rejectProfileReq(${r.id})" class="btn-secondary text-xs" style="padding:6px 12px;width:auto;white-space:nowrap">Reject</button></div>`:'—'}</td></tr>`).join('')}
      ${rows.length===0?'<tr><td colspan="7" class="text-center py-8 text-gray-400">No profile change requests</td></tr>':''}
    </tbody></table></div>`,'Profile Requests');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Confirms, then approves a profile change request via
  // adminApi.approveProfileRequest — the new value is applied to the account.
AdminPages._approveProfileReq=function(id){
  utils.confirm('Approve this change? The new value will be applied to the user account right away.',async()=>{
    try{await adminApi.approveProfileRequest(id);utils.toast('Change applied','success');AdminPages.profileRequests();}
    catch(e){utils.toast(e.message,'error');}
  },'Approve');
};
// Confirms, then rejects a profile change request via
  // adminApi.rejectProfileRequest.
AdminPages._rejectProfileReq=function(id){
  utils.confirm('Reject this change request? The user keeps their current value.',async()=>{
    try{await adminApi.rejectProfileRequest(id);utils.toast('Request rejected','success');AdminPages.profileRequests();}
    catch(e){utils.toast(e.message,'error');}
  },'Reject');
};
