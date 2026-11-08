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
    <div class="card">
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
    const fields=d.fields||[];AdminPages._kycFields=fields;
    const CORE=['doc_type','doc_front','doc_back','selfie'];
    const fieldsHtml=`<div class="card mb-4">
      <div class="mb-3"><b>KYC Form</b><p class="text-sm text-gray-400 mt-1">These fields are what users fill in on the KYC page. Add, remove, reorder or turn fields on/off \u2014 the user form updates immediately. The four document fields cannot be deleted.</p></div>
      <div class="overflow-x-auto"><table class="data-table"><thead><tr><th style="width:70px">Order</th><th>Field</th><th>Type</th><th>Required</th><th>Active</th><th>Actions</th></tr></thead><tbody>
      ${fields.map(f=>`<tr><td data-label="Order"><div style="display:flex;gap:4px"><button onclick="AdminPages._moveKYCField(${f.id},'up')" class="btn-secondary text-sm" style="padding:2px 8px" title="Move up">\u2191</button><button onclick="AdminPages._moveKYCField(${f.id},'down')" class="btn-secondary text-sm" style="padding:2px 8px" title="Move down">\u2193</button></div></td><td data-label="Field"><div class="font-semibold">${f.field_label}</div><div class="text-xs text-gray-400">${f.field_name}${CORE.includes(f.field_name)?' \u00b7 document':''}</div></td><td data-label="Type" class="text-sm">${f.field_type}</td><td data-label="Required" class="text-sm">${f.required?'Yes':'No'}</td><td data-label="Active"><label class="switch"><input type="checkbox" ${f.is_active?'checked':''} onchange="AdminPages._toggleKYCField(${f.id},this.checked)"><i></i></label></td><td data-label="Actions"><div style="display:flex;gap:6px;flex-wrap:wrap"><button onclick="AdminPages._editKYCField(${f.id})" class="btn-secondary text-sm" style="padding:5px 10px">Edit</button>${CORE.includes(f.field_name)?'':`<button onclick="AdminPages._deleteKYCField(${f.id},'${f.field_label.replace(/'/g,"\\'")}')" class="btn-danger text-sm" style="padding:5px 10px">Delete</button>`}</div></td></tr>`).join('')}
      ${fields.length===0?'<tr><td colspan="6" class="text-center py-8 text-gray-400">No fields yet \u2014 add one below.</td></tr>':''}
      </tbody></table></div>
      <div class="mt-4 pt-4" style="border-top:1px solid var(--border)">
        <b class="text-sm">Add a field</b>
        <div class="grid gap-3 mt-3" style="grid-template-columns:1fr 1fr">
          <div><label class="input-label">Label</label><input id="kycf-label" type="text" class="input-field" placeholder="e.g. Father's Name" oninput="if(!document.getElementById('kycf-name').dataset.manual)document.getElementById('kycf-name').value=this.value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')"></div>
          <div><label class="input-label">Field name</label><input id="kycf-name" type="text" class="input-field" placeholder="auto from label" oninput="this.dataset.manual='1'"></div>
          <div><label class="input-label">Type</label><select id="kycf-type" class="input-field" onchange="document.getElementById('kycf-options-wrap').style.display=this.value==='select'?'block':'none'"><option value="text">Text</option><option value="textarea">Long text</option><option value="date">Date</option><option value="number">Number</option><option value="tel">Phone</option><option value="email">Email</option><option value="select">Dropdown</option><option value="file">File upload</option></select></div>
          <div><label class="input-label">Required?</label><label class="text-sm"><input id="kycf-required" type="checkbox"> Required field</label></div>
        </div>
        <div id="kycf-options-wrap" class="mt-3" style="display:none"><label class="input-label">Dropdown options (one per line)</label><textarea id="kycf-options" class="input-field" rows="3" placeholder="Salary&#10;Business&#10;Investments"></textarea></div>
        <button onclick="AdminPages._addKYCField()" class="btn-primary mt-3" style="width:auto">Add Field</button>
      </div>
    </div>`;
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">KYC Control</h2>
    <div class="alert-info mb-4 text-sm">KYC is <strong>OFF by default</strong>. OFF = no banner, no block. ON = Action Required notification sent to all users.</div>
    <div class="card mb-4">
      <div class="switch-row">
        <div class="grow"><b>KYC Required</b><p>Show KYC banner and send action notifications to users</p></div>
        <label class="switch"><input type="checkbox" ${d.kyc_enabled==='1'?'checked':''} onchange="AdminPages._setKYC(this)"><i></i></label>
      </div>
    </div>
    ${fieldsHtml}
    <div class="card">
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

// --- KYC form builder (v117) ---
// Adds a field from the Add-a-field form via adminApi.addKYCField.
AdminPages._addKYCField=async function(){
  const label=document.getElementById('kycf-label').value.trim();
  const name=document.getElementById('kycf-name').value.trim();
  const type=document.getElementById('kycf-type').value;
  const required=document.getElementById('kycf-required').checked;
  const options=document.getElementById('kycf-options').value;
  if(!label){utils.toast('Label is required','error');return;}
  try{await adminApi.addKYCField({field_name:name,field_label:label,field_type:type,required:required?1:0,field_options:options});utils.toast('Field added!','success');AdminPages.kycControl();}
  catch(e){utils.toast(e.message,'error');}
};
// Opens the edit modal for one field (values from the page's field list).
AdminPages._editKYCField=function(id){
  const f=(AdminPages._kycFields||[]).find(x=>x.id===id);if(!f)return;
  let opts='';
  try{const arr=JSON.parse(f.field_options||'[]');opts=arr.map(o=>o.value===o.label?o.label:`${o.value} | ${o.label}`).join('\n');}catch(_){}
  utils.showModal(`<div class="modal"><h2 class="font-bold mb-3">Edit Field</h2>
    <label class="input-label">Label</label><input id="kycf-e-label" type="text" class="input-field mb-3" value="${f.field_label.replace(/"/g,'&quot;')}">
    <label class="input-label">Type</label><select id="kycf-e-type" class="input-field mb-3" onchange="document.getElementById('kycf-e-options-wrap').style.display=this.value==='select'?'block':'none'">${['text','textarea','date','number','tel','email','select','file'].map(t=>`<option value="${t}" ${f.field_type===t?'selected':''}>${t==='textarea'?'Long text':t==='select'?'Dropdown':t==='file'?'File upload':t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}</select>
    <div id="kycf-e-options-wrap" class="mb-3" style="display:${f.field_type==='select'?'block':'none'}"><label class="input-label">Dropdown options (one per line)</label><textarea id="kycf-e-options" class="input-field" rows="3">${opts}</textarea></div>
    <label class="text-sm mb-3" style="display:block"><input id="kycf-e-required" type="checkbox" ${f.required?'checked':''}> Required field</label>
    <div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="AdminPages._saveKYCField(${f.id})" class="btn-primary flex-1">Save</button></div></div>`);
};
// Saves the edit modal via adminApi.updateKYCField.
AdminPages._saveKYCField=async function(id){
  const label=document.getElementById('kycf-e-label').value.trim();
  const type=document.getElementById('kycf-e-type').value;
  const required=document.getElementById('kycf-e-required').checked;
  const options=document.getElementById('kycf-e-options')?document.getElementById('kycf-e-options').value:'';
  if(!label){utils.toast('Label is required','error');return;}
  try{await adminApi.updateKYCField(id,{field_label:label,field_type:type,required:required?1:0,field_options:options});utils.closeModal();utils.toast('Field updated!','success');AdminPages.kycControl();}
  catch(e){utils.toast(e.message,'error');}
};
// Deletes a field (the backend blocks the four document fields).
AdminPages._deleteKYCField=function(id,label){
  utils.confirm(`Delete the "${label}" field? Users will no longer see it on the KYC form.`,async()=>{
    try{await adminApi.deleteKYCField(id);utils.toast('Field deleted','success');AdminPages.kycControl();}
    catch(e){utils.toast(e.message,'error');}
  },'Delete');
};
// Toggles a field on/off via adminApi.updateKYCField.
AdminPages._toggleKYCField=async function(id,on){
  try{await adminApi.updateKYCField(id,{is_active:on?1:0});utils.toast(on?'Field turned on':'Field turned off','success');}
  catch(e){utils.toast(e.message,'error');AdminPages.kycControl();}
};
// Moves a field up or down in the form order.
AdminPages._moveKYCField=async function(id,dir){
  try{await adminApi.moveKYCField(id,{direction:dir});AdminPages.kycControl();}
  catch(e){utils.toast(e.message,'error');}
};


// Renders /admin/audit-log: admin email, action, before/after values
  // and date. Data comes from adminApi.getAuditLog().
AdminPages.auditLog=async function(){
  try{
    const rows=await adminApi.getAuditLog();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Audit Log</h2>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Admin</th><th>Action</th><th>Before</th><th>After</th><th>Date</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td data-label="Admin">${r.admin_email||'system'}</td><td data-label="Action" class="text-sm">${r.action}</td><td data-label="Before" class="text-xs text-gray-400 max-w-xs truncate">${r.before_value||'—'}</td><td data-label="After" class="text-xs text-gray-400 max-w-xs truncate">${r.after_value||'—'}</td><td data-label="Date" class="text-xs">${utils.fmtDateTime(r.created_at)}</td></tr>`).join('')}
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
