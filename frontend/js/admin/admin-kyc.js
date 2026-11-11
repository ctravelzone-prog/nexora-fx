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
      ${kycs.map(k=>`<tr><td data-label="User">${k.full_name}${k.is_showcase?` <span style="background:#FEF3C7;color:#92400E;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px">SHOWCASE</span>`:''} (@${k.username})</td><td data-label="Status">${utils.statusBadge(k.status)}</td><td data-label="Submitted" class="text-xs">${utils.fmtDate(k.submitted_at)}</td><td data-label="Documents" class="text-xs"><div class="flex gap-1">${k.doc_front?`<a href="${k.doc_front}" target="_blank" class="text-blue-500">Front</a>`:''} ${k.doc_back?`<a href="${k.doc_back}" target="_blank" class="text-blue-500 ml-1">Back</a>`:''} ${k.selfie?`<a href="${k.selfie}" target="_blank" class="text-blue-500 ml-1">Selfie</a>`:''}</div></td><td data-label="Actions"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button onclick="AdminPages._kycView(${k.id},${k.is_showcase?1:0})" class="btn-secondary text-xs" style="width:auto;padding:5px 10px;white-space:nowrap">View</button>${k.status==='pending'?`<button onclick="AdminPages._kycAction(${k.id},'approve',${k.is_showcase?1:0})" class="btn-primary text-xs" style="width:auto;padding:5px 10px;white-space:nowrap">Approve</button><button onclick="AdminPages._kycAction(${k.id},'reject',${k.is_showcase?1:0})" class="btn-danger text-xs" style="width:auto;padding:5px 10px;white-space:nowrap">Reject</button>`:''}</div></td></tr>`).join('')}
      ${kycs.length===0?'<tr><td colspan="5" class="text-center py-8 text-gray-400">No pending KYC submissions</td></tr>':''}
    </tbody></table></div>`,'KYC Control');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Opens a modal with the full submitted KYC form (all field values the
// user filled in, with the admin's field labels) plus the documents.
AdminPages._kycView=async function(id,isSc){
  try{
    const [k,ctl]=await Promise.all([adminApi.getKYC(id,isSc),adminApi.getKYCControl().catch(()=>({fields:[]}))]);
    const labels={};(ctl.fields||[]).forEach(f=>{labels[f.field_name]=f.field_label;});
    const fd=k.form_data||{};
    const rows=Object.keys(fd).map(key=>{
      const val=fd[key];
      const isFile=typeof val==='string'&&val.startsWith('/uploads/');
      return `<div class="flex justify-between gap-3 py-2" style="border-bottom:1px solid var(--border)"><span class="text-sm text-gray-400">${labels[key]||key}</span><span class="text-sm font-semibold text-right break-all">${isFile?`<a href="${val}" target="_blank" class="text-blue-500">View file</a>`:val}</span></div>`;
    }).join('');
    utils.showModal(`<div class="modal"><h2 class="font-bold mb-1">KYC #${k.id} \u2014 ${k.full_name} (@${k.username})</h2><p class="text-sm text-gray-400 mb-3">${k.email||''} ${k.phone?`\u00b7 ${k.phone}`:''} \u00b7 ${utils.statusBadge(k.status)}</p>
    ${rows||'<p class="text-sm text-gray-400">No extra form fields submitted.</p>'}
    <div class="flex gap-2 mt-4 flex-wrap">${k.doc_front?`<a href="${k.doc_front}" target="_blank" class="btn-secondary text-sm" style="padding:6px 12px">Document Front</a>`:''}${k.doc_back?`<a href="${k.doc_back}" target="_blank" class="btn-secondary text-sm" style="padding:6px 12px">Document Back</a>`:''}${k.selfie?`<a href="${k.selfie}" target="_blank" class="btn-secondary text-sm" style="padding:6px 12px">Selfie</a>`:''}</div>
    ${k.admin_note?`<p class="text-sm text-gray-400 mt-3">Admin note: ${k.admin_note}</p>`:''}
    <div class="flex gap-3 mt-4"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Close</button></div></div>`);
  }catch(e){utils.toast(e.message,'error');}
};
// Opens a modal to approve or reject a KYC submission (optional note)
  // via adminApi.reviewKYC.
AdminPages._kycAction=function(id,action,isSc){
  utils.showModal(`<div class="modal"><h2 class="font-bold mb-3">${action==='approve'?'Approve':'Reject'} KYC #${id}</h2><label class="input-label">Note (optional)</label><input id="kyc-note" type="text" class="input-field mb-3"><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="adminApi.reviewKYC(${id},{action:'${action}',note:document.getElementById('kyc-note').value,is_showcase:${isSc}===1}).then(()=>{utils.closeModal();utils.toast('KYC ${action}d!','success');AdminPages.kyc();}).catch(e=>utils.toast(e.message,'error'))" class="${action==='approve'?'btn-primary':'btn-danger'} flex-1">${action==='approve'?'Approve':'Reject'}</button></div></div>`);
};
