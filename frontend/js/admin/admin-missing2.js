/*
 * admin-missing2.js — SEO, Fonts, Language, Loader, Countries settings.
 *
 * Renders the small site settings pages: /admin/seo (site title and meta
 * description), /admin/fonts (site-wide font picker), /admin/language,
 * /admin/loader (site loader on/off), /admin/breadcrumb (banner colors),
 * /admin/error-banner (404 title and message) and /admin/countries.
 * Key functions: AdminPages.seoTools, AdminPages.fontsSettings,
 * AdminPages._pickFont, AdminPages.languageSettings,
 * AdminPages.loaderSettings, AdminPages._toggleLoader,
 * AdminPages.breadcrumbBanner, AdminPages.errorBanner,
 * AdminPages.manageCountries.
 *
 * Gotchas:
 * - Website UI text is always English; the Language page only confirms that.
 * - All of these pages read and save through adminApi.getSettings /
 *   adminApi.saveSettings.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/seo: site title and meta description form.
  // Loads and saves via adminApi.getSettings / adminApi.saveSettings.
AdminPages.seoTools=async function(){
  try{const s=await adminApi.getSettings();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">SEO Tools</h2>
    <form id="seo-form" class="panel" style="margin-top:0;display:grid;gap:14px">
      <div><label class="input-label">Site Title</label><input name="st" type="text" class="input-field" value="${s.site_name||'Nexora Fx'}"></div>
      <div><label class="input-label">Meta Description</label><textarea name="sd" class="input-field" rows="3">${s.seo_description||''}</textarea></div>
      <button type="submit" id="seo-btn" class="btn-primary">Save SEO</button>
    </form>`,'SEO Tools');
    document.getElementById('seo-form').onsubmit=async(e)=>{e.preventDefault();const f=e.target,btn=document.getElementById('seo-btn');utils.loading(btn,true);try{await adminApi.saveSettings({site_name:f.st.value,seo_description:f.sd.value});utils.toast('Saved!','success');}catch(ex){utils.toast(ex.message,'error');}utils.loading(btn,false);};
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
// Renders /admin/fonts: click a font card to apply it site-wide.
  // Current font comes from adminApi.getSettings.
AdminPages.fontsSettings=async function(){
  try{const s=await adminApi.getSettings();const cur=s.site_font||'Plus Jakarta Sans';
  const fonts=['Plus Jakarta Sans','Inter','DM Sans'];
  AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Fonts</h2><div class="panel" style="margin-top:0"><p class="text-sm mb-4" style="color:var(--body)">Current: <b>${cur}</b> — click a font to apply it site-wide.</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${fonts.map(f=>`<div class="card" onclick="AdminPages._pickFont('${f}')" style="cursor:pointer;${f===cur?'border:2px solid var(--orange);background:var(--orange-soft)':''}"><div style="font-family:${f},sans-serif;font-size:20px;font-weight:800;margin-bottom:4px">Aa</div><div style="font-size:12px;font-weight:700">${f}</div></div>`).join('')}</div></div>`,'Fonts');
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
// Saves the chosen font via adminApi.saveSettings, applies it at once
  // with utils.applySiteFont, and reloads the fonts page.
AdminPages._pickFont=async function(f){try{await adminApi.saveSettings({site_font:f});utils.applySiteFont(f);utils.toast('Font changed to '+f,'success');AdminPages.fontsSettings();}catch(ex){utils.toast(ex.message,'error');}};
// Renders /admin/language: confirms English is the only UI language.
  // Informational page, no API call.
AdminPages.languageSettings=function(){
  AdminComponents.layout('<h2 class="font-bold text-lg mb-4">Language</h2><div class="panel" style="margin-top:0"><div class="switch-row"><div class="grow"><b>English</b><p>All UI text is English-only. No Banglish or Bangla UI text allowed.</p></div><span class="st st-green">Active</span></div></div>','Language');
};
// Renders /admin/loader: the site loader on/off switch with a live
  // spinner preview. State comes from adminApi.getSettings.
AdminPages.loaderSettings=async function(){
  try{const s=await adminApi.getSettings();const on=(s.site_loader||'1')!=='0';
  AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Loader Settings</h2><div class="panel" style="margin-top:0"><div class="switch-row"><div class="grow"><b>Site Loader</b><p>Shows a spinner while pages load.</p></div><label class="switch"><input type="checkbox" id="loader-toggle" ${on?'checked':''} onchange="AdminPages._toggleLoader(this.checked)"><i></i></label></div><div id="loader-preview" style="margin-top:14px;padding:20px;background:var(--bg);border-radius:12px;display:flex;justify-content:center;${on?'':'display:none'}"><div class="spinner" style="width:32px;height:32px;border-width:3px"></div></div></div>`,'Loader Settings');
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
// Saves the loader switch via adminApi.saveSettings, applies it at once
  // and shows or hides the preview spinner. Loader is stored as '1' / '0'.
AdminPages._toggleLoader=async function(on){try{await adminApi.saveSettings({site_loader:on?'1':'0'});utils.applyLoaderSetting(on?'1':'0');const pv=document.getElementById('loader-preview');if(pv)pv.style.display=on?'flex':'none';utils.toast(on?'Site loader ON':'Site loader OFF','success');}catch(ex){utils.toast(ex.message,'error');}};
// Renders /admin/breadcrumb: background and text color pickers.
  // Loads and saves via adminApi.getSettings / adminApi.saveSettings.
AdminPages.breadcrumbBanner=async function(){
  try{
    const s=await adminApi.getSettings();
    const bg=(s.breadcrumb_bg||'#1E2329'),tx=(s.breadcrumb_text||'#ffffff');
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Breadcrumb Banner</h2><form id="bc-form" class="panel" style="margin-top:0;display:grid;gap:14px"><div><label class="input-label">Background Color</label><input name="bg" type="color" class="input-field" value="${bg}" style="height:48px;padding:4px"></div><div><label class="input-label">Text Color</label><input name="tx" type="color" class="input-field" value="${tx}" style="height:48px;padding:4px"></div><button type="submit" id="bc-btn" class="btn-primary">Save</button></form>`,'Breadcrumb Banner');
    document.getElementById('bc-form').onsubmit=async(e)=>{e.preventDefault();const f=e.target,btn=document.getElementById('bc-btn');utils.loading(btn,true);try{await adminApi.saveSettings({breadcrumb_bg:f.querySelector('[name="bg"]').value,breadcrumb_text:f.querySelector('[name="tx"]').value});utils.toast('Saved!','success');}catch(ex){utils.toast(ex.message,'error');}utils.loading(btn,false);};
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
// Renders /admin/error-banner: the 404 page title and message form.
  // Loads and saves via adminApi.getSettings / adminApi.saveSettings.
AdminPages.errorBanner=async function(){
  try{const s=await adminApi.getSettings();
  const et=(s.error_title||'Page Not Found').replace(/"/g,'&quot;'),em=(s.error_message||'The page you are looking for does not exist.').replace(/"/g,'&quot;');
  AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Error Banner</h2><form id="err-form" class="panel" style="margin-top:0;display:grid;gap:14px"><div><label class="input-label">Error Title</label><input name="et" type="text" class="input-field" value="${et}"></div><div><label class="input-label">Error Message</label><input name="em" type="text" class="input-field" value="${em}"></div><button type="submit" id="err-btn" class="btn-primary">Save</button></form>`,'Error Banner');
  document.getElementById('err-form').onsubmit=async(e)=>{e.preventDefault();const f=e.target,btn=document.getElementById('err-btn');utils.loading(btn,true);try{await adminApi.saveSettings({error_title:f.et.value,error_message:f.em.value});utils.toast('Saved!','success');}catch(ex){utils.toast(ex.message,'error');}utils.loading(btn,false);};
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
// Renders /admin/countries: flag, name and dial code table.
  // Fetches via GET /api/admin/countries; a failed fetch shows an empty list.
AdminPages.manageCountries=async function(){
  try{
    const cc=await api.request('GET','/api/admin/countries',null,true).catch(()=>[]);
    AdminComponents.layout('<h2 class="font-bold text-lg mb-4">Manage Countries</h2><div class="panel" style="margin-top:0"><div style="overflow-x:auto;border:1px solid var(--border);border-radius:14px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:var(--bg2)"><th style="padding:10px 14px;text-align:left;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Flag</th><th style="padding:10px 14px;text-align:left;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Name</th><th style="padding:10px 14px;text-align:left;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Dial</th></tr></thead><tbody>'+(Array.isArray(cc)?cc.map(c=>'<tr><td style="padding:12px 14px">'+c.flag_emoji+'</td><td style="padding:12px 14px">'+c.name+'</td><td style="padding:12px 14px">'+c.dial_code+'</td></tr>').join(''):'')+'</tbody></table></div></div>','Manage Countries');
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
