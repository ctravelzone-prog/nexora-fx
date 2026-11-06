/*
 * admin-profit.js — Profit System page (22-day cycle).
 *
 * Renders /admin/profit: the current month's daily-rate schedule grid, the
 * Auto Profit switch (Mon-Fri, 12:00 PM Dhaka), Apply Daily PnL to all
 * active copies or one user, and the per-user profit data table.
 * Key functions: AdminPages.profit, AdminPages._getDay, AdminPages._genSched,
 * AdminPages._applyAll, AdminPages._applySingle, AdminPages._toggleAuto,
 * AdminPages._manualEdit.
 *
 * Gotchas:
 * - Profit target is 10% over 22 weekdays (Sat/Sun skipped); Day 22
 *   balances to exactly the target. Rates are basis points (100 bp = 1%)
 *   and apply to Copy Invested only, never compounded.
 * - Profit is a target of up to the target percent, never a guarantee.
 * - Applied days are locked and shown grey; _manualEdit only points at the
 *   API, it does not edit in the browser.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/profit: Auto Profit switch, the month's 22-day schedule
  // grid, Apply Daily PnL controls and the per-user profit table.
  // Data: adminApi.getProfitSchedule, getUserProfitData, getAutoProfitStatus.
AdminPages.profit=async function(){
  try{
    const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;
    const d=await adminApi.getProfitSchedule({year:y,month:m});
    const pdata=await adminApi.getUserProfitData();
    let auto={}; try{auto=await adminApi.getAutoProfitStatus();}catch(e){}
    const tbp=d.schedule.reduce((a,s)=>a+s.rate_bp,0); // Total schedule rate in basis points (100 bp = 1%).
    let targetPct=tbp>0?(tbp/100).toFixed(2):'10.00';
    try{const money=await adminApi.getMoney(); if(money&&money.profit_target_bp) targetPct=(parseInt(money.profit_target_bp)/100).toFixed(2);}catch(e){}
    AdminComponents.layout(`
      <h2 class="font-bold text-xl mb-1">Profit System · 22-Day Cycle</h2>
      <p class="text-sm text-gray-400 mb-4">Every day pays a different rate — and at a different time: the 22 times from 12:00 PM to 7:00 PM are shuffled fresh every month. Sat/Sun skipped. Day 22 balances to exactly ${targetPct}% of Copy Invested. This is a <strong>target of up to ${targetPct}%</strong> — never a guarantee.</p>
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-1"><h3 class="font-bold">Auto Profit (Mon\u2013Fri)</h3><span id="auto-pill" style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;${auto.enabled===false?'background:#F1F5F9;color:#64748B;':'background:#DCFCE7;color:#15803D;'}"><span style="width:8px;height:8px;border-radius:50%;background:${auto.enabled===false?'#94A3B8':'#22C55E'};display:inline-block"></span>${auto.enabled===false?'AUTO OFF':'AUTO RUNNING'}</span></div>
        <p class="text-sm text-gray-500">Mon\u2013Fri, 12:00 PM Dhaka time-e porer din-er profit auto add hobe. Sat/Sun off. Profit alada Profit Balance-e jog hobe, prothome copy kora amount-er upori 22 din-e ${targetPct}% hiseb hobe (compound hobe na). Manual Apply emergency-r jonno thakbe.</p>
        <p class="text-sm text-gray-500 mt-1" id="auto-status">Auto: ${auto.enabled===false?'OFF':'ON'} \u00b7 Dhaka: ${auto.dhakaDate||''} (${auto.weekday||''}) \u00b7 Next Day: ${auto.nextDay?('Day '+auto.nextDay+' ('+(auto.nextRateBp/100).toFixed(2)+'%)'+(auto.nextRunTime?(' at '+auto.nextRunTime):'')):(auto.nextMonthReady?'Cycle complete \u00b7 Next shuffle ready':'Cycle complete')} \u00b7 Last applied: ${auto.lastAppliedDate||'none'}</p>
        <style>#auto-toggle-btn.off:hover{border-color:#E2E8F0 !important;color:#0F172A !important;} #auto-toggle-btn.on:hover{opacity:.92;}</style><button id="auto-toggle-btn" onclick="AdminPages._toggleAuto()" class="${auto.enabled===false?'btn-secondary off':'btn-primary on'} text-sm mt-2" style="width:auto;padding:8px 14px">${auto.enabled===false?'Turn On':'Turn Off'}</button>
      </div>
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-3"><div><h3 class="font-bold">November ${y} cycle schedule</h3><p class="text-xs text-gray-400">Loss days: ${d.schedule.filter(s=>s.is_loss).length} · Total: <strong>${(tbp/100).toFixed(2)}%</strong></p></div>
          <div class="flex gap-2"><button onclick="AdminPages._genSched(${y},${m})" class="btn-primary text-sm" style="width:auto;padding:8px 14px">Generate Dynamic Shuffle</button><button onclick="AdminPages._manualEdit(${y},${m})" class="btn-secondary text-sm" style="padding:8px 14px">Manual Edit</button></div>
        </div>
        <div class="sched-grid">
          ${d.schedule.map(s=>`<div class="sched-day${s.is_loss?' loss':''}${s.day_number===22?' final':''}${s.applied?' applied':''}"><small>DAY ${s.day_number}${s.day_number===22?'<br>BALANCE':''}</small><b>${s.rate_bp>=0?'+':''}${(s.rate_bp/100).toFixed(2)}%</b><small>${s.run_time||''}</small></div>`).join('')}
        </div>
      </div>
      <div class="card mb-4">
        <h3 class="font-bold mb-2">Apply Daily PnL</h3>
        <div class="flex gap-3 flex-wrap items-center">
          <select id="pnl-day" class="input-field" style="width:150px"><option value="">Select Day</option>${d.schedule.filter(s=>!s.applied).map(s=>`<option value="${s.day_number}" data-rate="${s.rate_bp}">Day ${s.day_number} (${(s.rate_bp/100).toFixed(2)}%)</option>`).join('')}</select>
          <button onclick="AdminPages._applyAll(${y},${m})" class="btn-primary text-sm" style="width:auto;padding:10px 16px">Apply to All Active Copies</button>
          <input id="pnl-uname" type="text" class="input-field text-sm" style="width:180px" placeholder="Single user username...">
          <button onclick="AdminPages._applySingle(${y},${m})" class="btn-secondary text-sm" style="padding:10px 16px">Apply to Single User</button>
        </div>
      </div>
      <div class="card">
        <h3 class="font-bold mb-2">Admin User Profit Data</h3>
        <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>User</th><th>Deposited</th><th>Copy Invested</th><th>Profit</th><th>Total PnL</th><th>Copies</th></tr></thead><tbody>
          ${pdata.map(u=>`<tr><td>${u.full_name} (@${u.username})</td><td>${utils.fmtMoney(u.total_deposited_cents)}</td><td class="font-bold text-orange-500">${utils.fmtMoney(u.copy_cents)}</td><td class="profit">${utils.fmtMoney(u.profit_cents)}</td><td class="profit">${utils.fmtMoney(u.total_pnl_cents)}</td><td>${u.active_copies}</td></tr>`).join('')}
          ${pdata.length===0?'<tr><td colspan="6" class="text-center py-8 text-gray-400">No active investors</td></tr>':''}
        </tbody></table></div>
      </div>`,'Profit System · 22-Day Cycle');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Reads the selected unapplied schedule day and its rate from the
  // dropdown. Returns null (with a toast) when no day is selected.
AdminPages._getDay=function(){
  const sel=document.getElementById('pnl-day');
  const day=parseInt(sel.value),rate=parseInt(sel.selectedOptions[0]?.dataset.rate||0); // The day rate is stored in basis points (100 bp = 1%).
  if(!day){utils.toast('Please select a day','error');return null;}
  return {day,rate};
};
// Confirms, then asks the server for a new dynamic schedule via
  // adminApi.generateSchedule and reloads the profit page.
AdminPages._genSched=function(y,m){utils.confirm(`Generate new schedule for ${y}-${m}?`,async()=>{try{await adminApi.generateSchedule({year:y,month:m});utils.toast('Schedule generated!','success');AdminPages.profit();}catch(e){utils.toast(e.message,'error');};},'Generate');};
// Confirms, then applies the selected day's rate to ALL active copies
  // via adminApi.applyPnl.
AdminPages._applyAll=function(y,m){const d=AdminPages._getDay();if(!d)return;utils.confirm(`Apply Day ${d.day} (${(d.rate/100).toFixed(2)}%) to ALL active copies?`,async()=>{try{const r=await adminApi.applyPnl({rate_bp:d.rate,day_number:d.day,year:y,month:m});utils.toast(`Applied to ${r.count} copies!`,'success');AdminPages.profit();}catch(e){utils.toast(e.message,'error');};},'Apply PnL');};
// Applies the selected day's rate to one user (looked up by username
  // via adminApi.getUsers) through adminApi.applyPnl with user_id.
AdminPages._applySingle=async function(y,m){
  const d=AdminPages._getDay();if(!d)return;
  const uname=document.getElementById('pnl-uname').value.trim();
  if(!uname){utils.toast('Enter username','error');return;}
  try{const us=await adminApi.getUsers({search:uname,limit:1});if(!us.length){utils.toast('User not found','error');return;}await adminApi.applyPnl({rate_bp:d.rate,day_number:d.day,year:y,month:m,user_id:us[0].id});utils.toast(`Applied to ${uname}!`,'success');}
  catch(e){utils.toast(e.message,'error');}
};
// Flips Auto Profit on/off via adminApi.toggleAutoProfit and reloads.
AdminPages._toggleAuto=async function(){try{const s=await adminApi.getAutoProfitStatus();const next=!(s.enabled!==false);const r=await adminApi.toggleAutoProfit({enabled:next});utils.toast('Auto Profit '+(r.enabled?'ON':'OFF'),'success');AdminPages.profit();}catch(e){utils.toast(e.message,'error');};};
// Manual day edits are API-only: shows the PUT schedule endpoint.
  // No edit happens in the browser.
AdminPages._manualEdit=function(y,m){utils.toast('To manually edit a day, use the API: PUT /api/admin/profit/schedule/:year/:month/:day with {rate_bp}','info');};
