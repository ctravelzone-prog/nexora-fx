/*
 * admin-traders.js — Traders list and Active Copies pages.
 *
 * Renders /admin/traders (trader cards with ROI, win rate, drawdown, risk
 * and followers, plus Add / Edit / Hide / Delete) and /admin/copies
 * (active user copies with invested amount, profit, daily PnL and cycle
 * day, plus admin Stop).
 * Key functions: AdminPages.traders, AdminPages._traderForm,
 * AdminPages._newTrader, AdminPages._editTrader, AdminPages._bindTraderForm,
 * AdminPages._toggleTrader, AdminPages._deleteTrader, AdminPages.copies,
 * AdminPages._adminStop.
 *
 * Gotchas:
 * - Trader money fields are stored as integer cents (min_copy_cents) but
 *   edited in dollars in the form; ROI / win rate / drawdown are percents.
 * - The trader form is submitted as FormData (multipart) because it can
 *   carry an avatar image upload.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/traders: trader cards (ROI, win rate, drawdown, risk,
  // followers) with Add / Edit / Hide / Delete. Data: adminApi.getTraders.
AdminPages.traders=async function(){
  try{
    const traders=await adminApi.getTraders();
    const _s=await adminApi.getSettings().catch(()=>({}));
    const _copyingCur=(_s&&_s.copying_count!==undefined&&_s.copying_count!==null)?_s.copying_count:'';
    AdminComponents.layout(`<div class="card mb-4"><div class="font-bold">Copy Trade Hero — Copying count</div><p class="text-xs text-gray-400 mb-3">The number shown as COPYING on the user Copy Trade page. Leave empty to show the real count of active copies.</p><form id="copying-form" class="flex gap-2"><input name="copying_count" type="number" min="0" step="1" class="input-field" style="max-width:180px" value="${_copyingCur}" placeholder="e.g. 1250"><button type="submit" class="btn-primary text-sm" style="width:auto;padding:10px 16px">Save</button></form></div>
    <div class="flex items-center justify-between mb-4"><h2 class="font-bold text-lg">Traders</h2><button onclick="AdminPages._newTrader()" class="btn-primary text-sm" style="width:auto;padding:10px 16px">+ Add Trader</button></div>
    <div class="grid gap-4">${traders.map(t=>`<div class="card"><div class="flex items-center justify-between"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold overflow-hidden">${t.avatar?`<img src="${t.avatar}" class="w-full h-full object-cover">`:(t.name||'T')[0]}</div><div><div class="font-bold">${t.name} ${t.flag_emoji||''}</div><div class="text-xs text-gray-400">@${t.username}</div></div></div><div class="flex gap-2"><button onclick="AdminPages._editTrader(${t.id})" class="btn-secondary text-xs" style="padding:4px 8px">Edit</button><button onclick="AdminPages._toggleTrader(${t.id})" class="btn-secondary text-xs" style="padding:4px 8px">${t.is_hidden?'Show':'Hide'}</button><button onclick="AdminPages._deleteTrader(${t.id})" class="btn-danger text-xs" style="padding:4px 8px">Delete</button></div></div><div class="grid grid-cols-5 gap-3 mt-3 text-sm border-t pt-3"><div><div class="text-xs text-gray-400">ROI</div><div class="font-bold text-green-500">+${t.roi_percent.toFixed(1)}%</div></div><div><div class="text-xs text-gray-400">Win Rate</div><div class="font-bold">${t.win_rate.toFixed(1)}%</div></div><div><div class="text-xs text-gray-400">Max Drawdown</div><div class="font-bold text-red-500">${t.drawdown.toFixed(1)}%</div></div><div><div class="text-xs text-gray-400">Risk</div><div class="font-bold">${t.risk_level}</div></div><div><div class="text-xs text-gray-400">Followers</div><div class="font-bold">${t.followers}</div></div></div></div>`).join('')}
    ${traders.length===0?'<div class="card text-center py-8 text-gray-400">No traders yet</div>':''}</div>`,'Traders');
    const _cf=document.getElementById('copying-form');
    if(_cf)_cf.onsubmit=async(e)=>{e.preventDefault();const v=_cf.querySelector('[name="copying_count"]').value.trim();try{await adminApi.saveSettings({copying_count:v});utils.toast('Copying count saved!','success');}catch(ex){utils.toast(ex.message,'error');}};
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Builds the Add / Edit Trader modal HTML. With a trader object it
  // pre-fills the form; without one it shows blank defaults (ROI 10%,
  // win rate 75%, drawdown 5%, risk Medium, min copy $10).
AdminPages._traderForm=function(tr){
  const esc=s=>String(s==null?'':s).replace(/"/g,'&quot;');
  const flags=[['🇬🇧','United Kingdom'],['🇺🇸','United States'],['🇧🇷','Brazil'],['🇯🇵','Japan'],['🇮🇳','India'],['🇧🇩','Bangladesh'],['🇩🇪','Germany'],['🇫🇷','France'],['🇦🇺','Australia'],['🇨🇦','Canada'],['🇦🇪','UAE'],['🇸🇬','Singapore']];
  const flagOpts=flags.map(f=>`<option value="${f[0]}" ${tr&&tr.flag_emoji===f[0]?'selected':''}>${f[0]} ${f[1]}</option>`).join('');
  const riskOpts=['Low','Medium','High'].map(r=>`<option ${(!tr&&r==='Medium')||(tr&&tr.risk_level===r)?'selected':''}>${r}</option>`).join('');
  return `<div class="modal"><h2 class="font-bold mb-4">${tr?'Edit Trader':'Add Trader'}</h2><form id="trader-form" class="space-y-3"><div class="grid grid-cols-2 gap-3"><div><label class="input-label">Name</label><input name="name" type="text" class="input-field" value="${esc(tr?tr.name:'')}" required></div><div><label class="input-label">Username</label><input name="username" type="text" class="input-field" value="${esc(tr?tr.username:'')}" required></div></div><div class="grid grid-cols-2 gap-3"><div><label class="input-label">ROI %</label><input name="roi_percent" type="number" step="0.1" class="input-field" value="${tr?tr.roi_percent:10.0}"></div><div><label class="input-label">Min Copy $</label><input name="min_copy" type="number" step="0.01" class="input-field" value="${tr?tr.min_copy_cents/100:10}"></div></div><div class="grid grid-cols-2 gap-3"><div><label class="input-label">Win Rate %</label><input name="win_rate" type="number" step="0.1" min="0" max="100" class="input-field" value="${tr?tr.win_rate:75}"></div><div><label class="input-label">Max Drawdown %</label><input name="drawdown" type="number" step="0.1" min="0" max="100" class="input-field" value="${tr?tr.drawdown:5}"></div></div><div class="grid grid-cols-2 gap-3"><div><label class="input-label">Followers</label><input name="followers" type="number" step="1" min="0" class="input-field" value="${tr?tr.followers:0}"></div><div><label class="input-label">Flag</label><select name="flag_emoji" class="input-field">${flagOpts}</select></div></div><div><label class="input-label">Risk Level</label><select name="risk_level" class="input-field">${riskOpts}</select></div><div><label class="input-label">Trader Picture</label><input name="avatar" type="file" accept="image/*" class="input-field">${tr&&tr.avatar?`<img src="${tr.avatar}" style="width:64px;height:64px;object-fit:cover;border-radius:12px;margin-top:8px">`:''}<img id="tr-avatar-preview" style="display:none;width:64px;height:64px;object-fit:cover;border-radius:12px;margin-top:8px"></div><div><label class="input-label">Strategy</label><input name="strategy" type="text" class="input-field" value="${esc(tr?tr.strategy:'')}"></div><div><label class="input-label"><input name="verified" type="checkbox" ${!tr||tr.verified?'checked':''}> Verified (blue tick on user side)</label></div><div id="tr-e" class="alert-danger hidden"></div><div class="flex gap-3"><button type="button" onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button type="submit" class="btn-primary flex-1">${tr?'Save':'Add'}</button></div></form></div>`;
};
// Opens a blank trader form modal.
AdminPages._newTrader=function(){utils.showModal(AdminPages._traderForm(null));AdminPages._bindTraderForm(null);};
// Loads the trader list via adminApi.getTraders, finds the trader by id
  // and opens the pre-filled edit form modal.
AdminPages._editTrader=async function(id){try{const traders=await adminApi.getTraders();const tr=traders.find(x=>x.id===id);if(!tr){utils.toast('Trader not found','error');return;}utils.showModal(AdminPages._traderForm(tr));AdminPages._bindTraderForm(tr);}catch(e){utils.toast(e.message,'error');}};
// Wires the trader form submit (multipart FormData, avatar upload if a
  // file was picked) and the live avatar preview. Creates a trader, or
  // updates it when editing.
AdminPages._bindTraderForm=function(tr){
  document.getElementById('trader-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,err=document.getElementById('tr-e');
    const fd=new FormData();['name','username','roi_percent','risk_level','min_copy','strategy','win_rate','flag_emoji','followers','drawdown'].forEach(k=>fd.append(k,f[k].value));
    fd.append('verified',f.verified.checked?'1':'0');
    if(f.avatar&&f.avatar.files[0]) fd.append('avatar',f.avatar.files[0]);
    try{if(tr){await api.uploadPut('/api/admin/traders/'+tr.id,fd,true);}else{await api.upload('/api/admin/traders',fd,true);}utils.closeModal();utils.toast(tr?'Trader updated!':'Trader added!','success');AdminPages.traders();}
    catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
  };
  const _av=document.querySelector('#trader-form input[name="avatar"]');if(_av)_av.onchange=()=>{const _f=_av.files[0];const _img=document.getElementById('tr-avatar-preview');if(_f){_img.src=URL.createObjectURL(_f);_img.style.display='block';}else{_img.style.display='none';}};
};
// Toggles a trader's hidden state via adminApi.toggleTraderHidden.
AdminPages._toggleTrader=async function(id){try{await adminApi.toggleTraderHidden(id);utils.toast('Done','success');AdminPages.traders();}catch(e){utils.toast(e.message,'error');}};
// Confirms, then deletes a trader via adminApi.deleteTrader.
AdminPages._deleteTrader=function(id){utils.confirm('Delete this trader? This cannot be undone.',async()=>{try{await adminApi.deleteTrader(id);utils.toast('Trader deleted','success');AdminPages.traders();}catch(e){utils.toast(e.message,'error');}},'Delete');};
// Renders /admin/copies: active user copies with invested amount,
  // profit, daily PnL and cycle day. Data: adminApi.getActiveCopies.
AdminPages.copies=async function(){
  try{
    const copies=await adminApi.getActiveCopies();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Active Copies / Invests</h2>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>User</th><th>Trader</th><th>Invested</th><th>Profit</th><th>Daily PnL</th><th>Day</th><th>Actions</th></tr></thead><tbody>
      ${copies.map(c=>`<tr><td data-label="User">${c.full_name}</td><td data-label="Trader">${c.trader_name}</td><td data-label="Invested" class="font-bold">${utils.fmtMoney(c.amount_cents)}</td><td data-label="Profit" class="profit">${utils.fmtMoney(c.profit_cents)}</td><td data-label="Daily PnL" class="${c.daily_pnl_cents>=0?'profit':'loss'}">${c.daily_pnl_cents>=0?'+':''}${utils.fmtMoney(c.daily_pnl_cents)}</td><td data-label="Day">${c.cycle_day}/22</td><td data-label="Actions"><button onclick="AdminPages._adminStop(${c.id})" class="btn-danger text-xs" style="padding:5px 10px">Stop</button></td></tr>`).join('')}
      ${copies.length===0?'<tr><td colspan="7" class="text-center py-8 text-gray-400">No active copies</td></tr>':''}
    </tbody></table></div>`,'Active Copies');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Confirms, then stops a copy via adminApi.adminStopCopy. Stopping
  // settles the copy back to the user's Main Balance.
AdminPages._adminStop=function(id){
  utils.confirm(`Stop copy #${id}? Today PnL=$0.`,async()=>{
    try{await adminApi.adminStopCopy(id);utils.toast('Copy stopped','success');AdminPages.copies();}
    catch(e){utils.toast(e.message,'error');}
  },'Stop Copy');
};
