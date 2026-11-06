/*
 * admin-missing4.js — Holiday Settings and Menu & Page Settings.
 *
 * Renders /admin/holidays (market-closed dates, with an Add Holiday modal)
 * and /admin/menu-page-settings (Sign Up / Log In button labels and the
 * announcement bar text).
 * Key functions: AdminPages.holidaySetting, AdminPages._addHol,
 * AdminPages.menuPageSettings.
 *
 * Gotchas:
 * - Holiday rows come from GET /api/admin/holidays via api.request; the
 *   menu page labels are plain site settings saved with adminApi.
 * - An empty announcement bar means the bar is hidden on the site.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/holidays: market-closed dates with an Add button.
  // Fetches via GET /api/admin/holidays; a failed fetch shows an empty list.
AdminPages.holidaySetting=async function(){
  try{
    const h=await api.request('GET','/api/admin/holidays',null,true).catch(()=>[]);
    const rows=Array.isArray(h)&&h.length?h.map(x=>'<tr><td style="padding:12px 14px"><b>'+x.date+'</b></td><td style="padding:12px 14px">'+(x.description||'Market closed')+'</td></tr>').join(''):'<tr><td colspan="2" style="padding:24px;text-align:center;color:var(--muted)">No holidays set.</td></tr>';
    AdminComponents.layout('<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><h2 class="font-bold text-lg">Holiday Settings</h2><button onclick="AdminPages._addHol()" class="btn-primary text-sm" style="width:auto;padding:10px 16px">+ Add</button></div><div class="panel" style="margin-top:0"><div style="overflow-x:auto;border:1px solid var(--border);border-radius:14px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:var(--bg2)"><th style="padding:10px 14px;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Date</th><th style="padding:10px 14px;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Description</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>','Holiday Settings');
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
// Opens the Add Holiday modal and saves via POST /api/admin/holidays.
AdminPages._addHol=function(){
  utils.showModal('<div class="modal"><h2 style="font-size:18px;font-weight:800;margin-bottom:12px">Add Holiday</h2><form id="hf" class="space-y-4"><div><label class="input-label">Date</label><input name="date" type="date" class="input-field" required></div><div><label class="input-label">Description</label><input name="desc" type="text" class="input-field"></div><div class="flex gap-3"><button type="button" onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button type="submit" class="btn-primary flex-1">Add</button></div></form></div>');
  document.getElementById('hf').onsubmit=async(e)=>{e.preventDefault();const f=e.target;try{await api.request('POST','/api/admin/holidays',{date:f.date.value,description:f.desc.value},true);utils.closeModal();utils.toast('Added!','success');AdminPages.holidaySetting();}catch(ex){utils.toast(ex.message,'error');}};
};
// Renders /admin/menu-page-settings: Sign Up / Log In button labels and
  // the announcement bar text. Loads and saves via adminApi settings.
AdminPages.menuPageSettings=async function(){
  try{const s=await adminApi.getSettings();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Menu &amp; Page Settings</h2><form id="mps" class="panel" style="margin-top:0;display:grid;gap:14px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><label class="input-label">Sign Up button</label><input name="su" type="text" class="input-field" value="${s.hero_btn_primary||'Sign Up'}"></div><div><label class="input-label">Log In button</label><input name="li" type="text" class="input-field" value="${s.hero_btn_secondary||'Log In'}"></div></div><div><label class="input-label">Announcement bar (empty = hidden)</label><input name="ann" type="text" class="input-field" value="${s.announcement_bar||''}"></div><button type="submit" id="mps-btn" class="btn-primary">Save</button></form>`,'Menu & Page Settings');
    document.getElementById('mps').onsubmit=async(e)=>{e.preventDefault();const f=e.target,btn=document.getElementById('mps-btn');utils.loading(btn,true);try{await adminApi.saveSettings({hero_btn_primary:f.su.value,hero_btn_secondary:f.li.value,announcement_bar:f.ann.value});utils.toast('Saved!','success');}catch(ex){utils.toast(ex.message,'error');}utils.loading(btn,false);};
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
