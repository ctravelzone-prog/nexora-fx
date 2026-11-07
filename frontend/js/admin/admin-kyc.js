/*
 * admin-kyc.js — KYC submissions review page.
 *
 * Renders /admin/kyc: pending KYC submissions with document links (front,
 * back, selfie) and Approve / Reject actions with an optional note.
 * Key functions: AdminPages.kyc, AdminPages._kycAction.
 *
 * Gotchas:
 * - KYC is OFF by default; this page only reviews submissions that exist.
 * - To request KYC from one specific user, use Manage KYC Form
 *   (/admin/kyc-control), not this page.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/kyc: pending KYC submissions with document links.
  // Fetches up to 50 pending rows via adminApi.getKYCList.
AdminPages.kyc=async function(){
  try{
    const _gen=AdminApp._gen;
    const kycs=await adminApi.getKYCList({status:'pending',limit:50});if(_gen!==AdminApp._gen)return;
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">KYC Submissions</h2>
    <div class="alert-info mb-4 text-sm">To request KYC from one specific user, go to <button onclick="AdminApp.navigate('/admin/kyc-control')" class="text-orange-500 font-semibold">Manage KYC Form \u2192</button></div>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>User</th><th>Status</th><th>Submitted</th><th>Documents</th><th>Actions</th></tr></thead><tbody>
      ${kycs.map(k=>`<tr><td data-label="User">${k.full_name} (@${k.username})</td><td data-label="Status">${utils.statusBadge(k.status)}</td><td data-label="Submitted" class="text-xs">${utils.fmtDate(k.submitted_at)}</td><td data-label="Documents" class="text-xs"><div class="flex gap-1">${k.doc_front?`<a href="${k.doc_front}" target="_blank" class="text-blue-500">Front</a>`:''} ${k.doc_back?`<a href="${k.doc_back}" target="_blank" class="text-blue-500 ml-1">Back</a>`:''} ${k.selfie?`<a href="${k.selfie}" target="_blank" class="text-blue-500 ml-1">Selfie</a>`:''}</div></td><td data-label="Actions">${k.status==='pending'?`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button onclick="AdminPages._kycAction(${k.id},'approve')" class="btn-primary text-xs" style="width:auto;padding:5px 10px;white-space:nowrap">Approve</button><button onclick="AdminPages._kycAction(${k.id},'reject')" class="btn-danger text-xs" style="width:auto;padding:5px 10px;white-space:nowrap">Reject</button></div>`:'—'}</td></tr>`).join('')}
      ${kycs.length===0?'<tr><td colspan="5" class="text-center py-8 text-gray-400">No pending KYC submissions</td></tr>':''}
    </tbody></table></div>`,'KYC Control');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Opens a modal to approve or reject a KYC submission (optional note)
  // via adminApi.reviewKYC.
AdminPages._kycAction=function(id,action){
  utils.showModal(`<div class="modal"><h2 class="font-bold mb-3">${action==='approve'?'Approve':'Reject'} KYC #${id}</h2><label class="input-label">Note (optional)</label><input id="kyc-note" type="text" class="input-field mb-3"><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="adminApi.reviewKYC(${id},{action:'${action}',note:document.getElementById('kyc-note').value}).then(()=>{utils.closeModal();utils.toast('KYC ${action}d!','success');AdminPages.kyc();}).catch(e=>utils.toast(e.message,'error'))" class="${action==='approve'?'btn-primary':'btn-danger'} flex-1">${action==='approve'?'Approve':'Reject'}</button></div></div>`);
};
