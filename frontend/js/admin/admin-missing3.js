// admin-missing3.js — Footer, Roles, Staff, Email, SMS
AdminPages.footerSettings=async function(){
  try{const s=await adminApi.getSettings();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Footer Settings</h2>
    <form id="ft-form" class="panel" style="margin-top:0;display:grid;gap:12px">
      <div><label class="input-label">About Text</label><textarea name="fa" class="input-field" rows="2">${s.footer_about||''}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label class="input-label">Telegram</label><input name="ft" type="text" class="input-field" value="${s.footer_telegram||''}"></div>
        <div><label class="input-label">TikTok</label><input name="fk" type="text" class="input-field" value="${s.footer_tiktok||''}"></div>
        <div><label class="input-label">YouTube</label><input name="fy" type="text" class="input-field" value="${s.footer_youtube||''}"></div>
        <div><label class="input-label">Facebook</label><input name="ff" type="text" class="input-field" value="${s.footer_facebook||''}"></div>
      </div>
      <div><label class="input-label">Contact Email</label><input name="fc" type="text" class="input-field" value="${s.footer_contact||''}"></div>
      <button type="submit" id="ft-btn" class="btn-primary">Save Footer</button>
    </form>`,'Footer Settings');
    document.getElementById('ft-form').onsubmit=async(e)=>{e.preventDefault();const f=e.target,btn=document.getElementById('ft-btn');utils.loading(btn,true);try{await adminApi.saveSettings({footer_about:f.fa.value,footer_telegram:f.ft.value,footer_tiktok:f.fk.value,footer_youtube:f.fy.value,footer_facebook:f.ff.value,footer_contact:f.fc.value});utils.toast('Saved!','success');}catch(ex){utils.toast(ex.message,'error');}utils.loading(btn,false);};
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
AdminPages.manageRoles=function(){
  AdminComponents.layout('<h2 class="font-bold text-lg mb-4">Manage Roles</h2><div class="panel" style="margin-top:0"><div style="overflow-x:auto;border:1px solid var(--border);border-radius:14px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:var(--bg2)"><th style="padding:10px 14px;text-align:left;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Role</th><th style="padding:10px 14px;text-align:left;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Permissions</th></tr></thead><tbody><tr><td style="padding:12px 14px"><b>Super Admin</b></td><td style="padding:12px 14px;font-size:12px">Full access — all settings, money settings, users, profit, audit log</td></tr><tr><td style="padding:12px 14px"><b>Support Admin</b></td><td style="padding:12px 14px;font-size:12px">Tickets, user view, deposit/withdrawal — no money settings</td></tr></tbody></table></div></div>','Manage Roles');
};
AdminPages.manageStaff=async function(){
  try{
    const a=await api.request('GET','/api/admin/staff',null,true).catch(()=>[]);
    AdminComponents.layout('<h2 class="font-bold text-lg mb-4">Manage Staff</h2><div class="panel" style="margin-top:0"><div style="overflow-x:auto;border:1px solid var(--border);border-radius:14px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:var(--bg2)"><th style="padding:10px 14px;text-align:left;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Email</th><th style="padding:10px 14px;text-align:left;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Role</th><th style="padding:10px 14px;text-align:left;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">2FA</th></tr></thead><tbody>'+(Array.isArray(a)?a.map(x=>'<tr><td style="padding:12px 14px"><b>'+x.email+'</b></td><td style="padding:12px 14px"><span class="st st-blue">'+x.role+'</span></td><td style="padding:12px 14px">'+(x.two_fa_enabled?'<span class="st st-green">On</span>':'<span class="st st-grey">Off</span>')+'</td></tr>').join(''):'')+'</tbody></table></div></div>','Manage Staff');
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
AdminPages.emailSettings=function(){AdminComponents.layout('<h2 class="font-bold text-lg mb-4">Email Settings</h2><div class="panel" style="margin-top:0"><div class="alert-info mb-3" style="font-size:13px">SMTP is in <code>backend/.env</code>. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM. Without SMTP, verify/reset links log to console (dev mode only).</div></div>','Email Settings');};
AdminPages.smsSettings=function(){AdminComponents.layout('<h2 class="font-bold text-lg mb-4">SMS Settings</h2><div class="panel" style="margin-top:0"><div class="alert-info mb-3" style="font-size:13px">SMS not configured. To enable, add an SMS provider to your <code>.env</code> and update the backend service.</div></div>','SMS Settings');};
