/*
 * admin-profit.js — Profit System page (per-trader 22-day plans, v128).
 *
 * Renders /admin/profit: each trader has their OWN 22-day plan (own
 * rates, own loss days); pick a trader to see their table, edit one
 * day's rate (only that trader's remaining days rebalance), see the
 * account total per day, Generate all plans in one click, Apply Daily
 * PnL to all active copies or one user, and the per-user profit data
 * table — plus the showcase accounts with their own profit targets.
 * Key functions: AdminPages.profit, AdminPages._genPlans,
 * AdminPages._editPlanDay, AdminPages._applyAll, AdminPages._applySingle,
 * AdminPages._toggleAuto, AdminPages._removeTrader, AdminPages._setShowcaseTarget.
 *
 * Gotchas:
 * - Profit target is 10% over 22 weekdays (Sat/Sun skipped); Day 22
 *   balances each trader to exactly the target. Rates are basis points
 *   (100 bp = 1%) and apply to Copy Invested only, never compounded.
 * - Profit is a target of up to the target percent, never a guarantee.
 * - Applied days are locked and shown grey; editing one day rebalances
 *   only that trader's remaining days (their Day 22 adjusts).
 * - A trader added mid-month joins the plan from that day and earns
 *   only the remaining percent; a full 10% starts the next month.
 * - Removing a trader settles every active copy (principal to Main,
 *   profit stays in Profit Balance), deletes their future plan rows,
 *   keeps past History, and hides the trader.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances; they are excluded from all admin totals, ledgers and
 *   reports. Their per-user profit target is set here, on this page.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/profit: Auto Profit switch, per-trader plan tables,
// account totals, Apply Daily PnL, per-user profit data, showcase
// accounts and trader remove controls.
// Data: adminApi.getTraderPlans, getUserProfitData, getAutoProfitStatus,
// getShowcaseUsers, getMoney.
AdminPages.profit=async function(selTraderId){
  try{
    const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;
    // The 5 calls are independent — run them in parallel (they were
    // sequential before, so switching traders took ~10s on a slow server).
    const [dRes,pRes,aRes,scRes,mRes]=await Promise.allSettled([
      adminApi.getTraderPlans({year:y,month:m}),
      adminApi.getUserProfitData(),
      adminApi.getAutoProfitStatus(),
      adminApi.getShowcaseUsers(),
      adminApi.getMoney(),
    ]);
    if(dRes.status!=='fulfilled'){ utils.toast('Could not load trader plans: '+(dRes.reason&&dRes.reason.message||'failed'),'error'); }
    const d=dRes.status==='fulfilled'?dRes.value:{plans:[],traders:[]};
    const pdata=pRes.status==='fulfilled'?pRes.value:[];
    const auto=aRes.status==='fulfilled'?aRes.value:{};
    const scUsers=scRes.status==='fulfilled'?scRes.value:[];
    let targetPct='10.00';
    if(mRes.status==='fulfilled'&&mRes.value&&mRes.value.profit_target_bp) targetPct=(parseInt(mRes.value.profit_target_bp)/100).toFixed(2);
    const traders=d.traders||[];
    const selId=selTraderId||(traders.length?traders[0].id:null);
    const selPlan=d.plans.filter(p=>p.trader_id===selId);
    const selName=traders.find(t=>t.id===selId)?.name||'';
    const planTotal=selPlan.reduce((a,p)=>a+p.rate_bp,0);
    const planDays=selPlan.map(p=>p.day_number);
    const openDays=[...new Set(d.plans.filter(p=>!p.applied).map(p=>p.day_number))].sort((a,b)=>a-b);
    const monthName=new Date(y,m-1,1).toLocaleString('en-US',{month:'long'});
    const nextRates=(auto.nextRates||[]).map(r=>`${r.trader_name}: ${r.rate_bp>=0?'+':''}${(r.rate_bp/100).toFixed(2)}%`).join(' · ');
    AdminComponents.layout(`
      <h2 class="font-bold text-xl mb-1">Profit System · 22-Day Cycle</h2>
      <p class="text-sm text-gray-400 mb-4">Every trader has their OWN 22-day plan — own rates, own loss days — so on a loss day some traders pay and some lose, never all together. Parts land one by one 10:00 AM–7:00 PM. Sat/Sun skipped. Day 22 balances each trader to exactly ${targetPct}% of Copy Invested. This is a <strong>target of up to ${targetPct}%</strong> — never a guarantee.</p>
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-1"><h3 class="font-bold">Auto Profit (Mon\u2013Fri)</h3><span id="auto-pill" style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;${auto.enabled===false?'background:#F1F5F9;color:#64748B;':'background:#DCFCE7;color:#15803D;'}"><span style="width:8px;height:8px;border-radius:50%;background:${auto.enabled===false?'#94A3B8':'#22C55E'};display:inline-block"></span>${auto.enabled===false?'AUTO OFF':'AUTO RUNNING'}</span></div>
        <p class="text-sm text-gray-500">Mon\u2013Fri, 10:00 AM–7:00 PM Dhaka time-e profit part by part auto add hobe. Sat/Sun off. Profit alada Profit Balance-e jog hobe, prothome copy kora amount-er upori 22 din-e ${targetPct}% hiseb hobe (compound hobe na). Manual Apply emergency-r jonno thakbe.</p>
        <p class="text-sm text-gray-500 mt-1" id="auto-status">Auto: ${auto.enabled===false?'OFF':'ON'} \u00b7 Dhaka: ${auto.dhakaDate||''} (${auto.weekday||''}) \u00b7 Next Day: ${auto.nextDay?('Day '+auto.nextDay+(nextRates?(' — '+nextRates):'')+(auto.nextRunTime?(' at '+auto.nextRunTime):'')):(auto.nextMonthReady?'Cycle complete \u00b7 Next plans ready':'Cycle complete')} \u00b7 Last applied: ${auto.lastAppliedDate||'none'}</p>
        <style>#auto-toggle-btn.off:hover{border-color:#E2E8F0 !important;color:#0F172A !important;} #auto-toggle-btn.on:hover{opacity:.92;}</style><button id="auto-toggle-btn" onclick="AdminPages._toggleAuto()" class="${auto.enabled===false?'btn-secondary off':'btn-primary on'} text-sm mt-2" style="width:auto;padding:8px 14px">${auto.enabled===false?'Turn On':'Turn Off'}</button>
      </div>
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2"><div><h3 class="font-bold">${monthName} ${y} · Trader Plans</h3><p class="text-xs text-gray-400">Each trader's plan sums to ${targetPct}% by Day 22${selPlan.length<22&&selPlan.length>0?` · ${selName} joined mid-month (Day ${planDays[0]}), so this plan totals <strong>${(planTotal/100).toFixed(2)}%</strong> (the remaining part)`:''}</p></div>
          <div class="flex gap-2 flex-wrap"><select id="tp-trader" class="input-field text-sm" style="width:200px" onchange="AdminPages.profit(parseInt(this.value))">${traders.map(t=>`<option value="${t.id}" ${t.id===selId?'selected':''}>${t.name}</option>`).join('')}</select><button onclick="AdminPages._genPlans(${y},${m})" class="btn-primary text-sm" style="width:auto;padding:8px 14px">Generate All Plans</button></div>
        </div>
        ${selPlan.length?`<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Day</th><th>Rate</th><th>Result</th><th>Status</th><th></th></tr></thead><tbody>
          ${selPlan.map(p=>`<tr><td data-label="Day">Day ${p.day_number}${p.day_number===22?' (Balance)':''}</td><td data-label="Rate" class="font-bold ${p.rate_bp<0?'text-red-500':'text-green-600'}">${p.rate_bp>=0?'+':''}${(p.rate_bp/100).toFixed(2)}%</td><td data-label="Result">${p.is_loss?'<span class="badge badge-red">Loss</span>':'<span class="badge badge-green">Profit</span>'}</td><td data-label="Status">${p.applied?'<span class="text-gray-400">Applied</span>':'<span class="text-gray-400">Pending</span>'}</td><td>${p.applied?'':'<button onclick="AdminPages._editPlanDay('+selId+','+y+','+m+','+p.day_number+','+p.rate_bp+')" class="btn-secondary text-xs" style="padding:4px 10px">Edit</button>'}</td></tr>`).join('')}
        </tbody></table></div><p class="text-xs text-gray-400 mt-2">${selName} plan total: <strong>${(planTotal/100).toFixed(2)}%</strong> · Loss days: ${selPlan.filter(p=>p.is_loss).length} · Editing one day rebalances only this trader's remaining days.</p>`:'<p class="text-sm text-gray-400">No plans yet — click "Generate All Plans".</p>'}
      </div>
      <div class="card mb-4">
        <h3 class="font-bold mb-2">Account Total per Day</h3>
        <p class="text-xs text-gray-400 mb-2">All active copies together, per day (real users only). Day 22 lands exactly on the target.</p>
        <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Day</th><th>Total</th><th>Rate</th></tr></thead><tbody>
          ${d.accountTotals.map(t=>`<tr><td data-label="Day">Day ${t.day}${t.day===22?' (Balance)':''}</td><td data-label="Total" class="font-bold ${t.total_cents<0?'text-red-500':'profit'}">${t.total_cents>=0?'+':''}${utils.fmtMoney(t.total_cents)}</td><td data-label="Rate" class="${t.total_bp<0?'text-red-500':'text-green-600'}">${t.total_bp>=0?'+':''}${(t.total_bp/100).toFixed(2)}%</td></tr>`).join('')}
        </tbody></table></div>
      </div>
      <div class="card mb-4">
        <h3 class="font-bold mb-2">Apply Daily PnL</h3>
        <div class="flex gap-3 flex-wrap items-center">
          <select id="pnl-day" class="input-field" style="width:150px"><option value="">Select Day</option>${openDays.map(day=>`<option value="${day}">Day ${day}</option>`).join('')}</select>
          <button onclick="AdminPages._applyAll(${y},${m})" class="btn-primary text-sm" style="width:auto;padding:10px 16px">Apply to All Active Copies</button>
          <input id="pnl-uname" type="text" class="input-field text-sm" style="width:180px" placeholder="Single user username...">
          <button onclick="AdminPages._applySingle(${y},${m})" class="btn-secondary text-sm" style="padding:10px 16px">Apply to Single User</button>
        </div>
        <p class="text-xs text-gray-400 mt-2">Rates come from each trader's own plan — no rate to pick here. A full apply also pays showcase accounts the same plans.</p>
      </div>
      <div class="card mb-4">
        <h3 class="font-bold mb-2">Admin User Profit Data</h3>
        <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>User</th><th>Deposited</th><th>Copy Invested</th><th>Profit</th><th>Total PnL</th><th>Copies</th></tr></thead><tbody>
          ${pdata.map(u=>`<tr><td data-label="User">${u.full_name} (@${u.username})${u.profit_target_bp!=null?'<div class="mt-1"><span style="background:#FFF7ED;color:#FF6A00;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px">Profit '+(u.profit_target_bp/100)+'%</span></div>':''}</td><td data-label="Deposited">${utils.fmtMoney(u.total_deposited_cents)}</td><td data-label="Copy Invested" class="font-bold text-orange-500">${utils.fmtMoney(u.copy_cents)}</td><td data-label="Profit" class="profit">${utils.fmtMoney(u.profit_cents)}</td><td data-label="Total PnL" class="profit">${utils.fmtMoney(u.total_pnl_cents)}</td><td data-label="Copies">${u.active_copies}</td></tr>`).join('')}
          ${pdata.length===0?'<tr><td colspan="6" class="text-center py-8 text-gray-400">No active investors</td></tr>':''}
        </tbody></table></div>
      </div>
      <div class="card mb-4">
        <h3 class="font-bold mb-2">Showcase Accounts</h3>
        <p class="text-xs text-gray-400 mb-2">Demo accounts — display money only, never in admin totals. Set a separate profit target for each one, just like a real user.</p>
        <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>User</th><th>Copy Invested</th><th>Profit</th><th>Profit Target</th><th></th></tr></thead><tbody>
          ${scUsers.map(u=>`<tr><td data-label="User">${u.full_name} (@${u.username})</td><td data-label="Copy Invested" class="font-bold text-orange-500">${utils.fmtMoney(u.showcase_copy_cents)}</td><td data-label="Profit" class="profit">${utils.fmtMoney(u.showcase_profit_cents)}</td><td data-label="Profit Target">${u.profit_target_bp!=null?'<b>'+(u.profit_target_bp/100)+'%</b>':'Global default'}</td><td><button onclick="AdminPages._setShowcaseTarget(${u.id},${u.profit_target_bp==null?'null':u.profit_target_bp})" class="btn-secondary text-xs" style="padding:6px 12px">Set Profit Target</button></td></tr>`).join('')}
          ${scUsers.length===0?'<tr><td colspan="5" class="text-center py-8 text-gray-400">No showcase accounts</td></tr>':''}
        </tbody></table></div>
      </div>
      <div class="card">
        <div class="flex items-center justify-between mb-2 flex-wrap gap-2"><h3 class="font-bold">Traders</h3><button onclick="AdminPages.traders()" class="btn-primary text-sm" style="width:auto;padding:8px 14px">Add Trader</button></div>
        <p class="text-xs text-gray-400 mb-2">Adding a trader creates their plan automatically. Removing one settles every active copy (money returns to Main, profit stays in Profit Balance), deletes their future plan, keeps past History.</p>
        <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Trader</th><th>Plan</th><th></th></tr></thead><tbody>
          ${traders.map(t=>{const tp=d.plans.filter(p=>p.trader_id===t.id);const tot=tp.reduce((a,p)=>a+p.rate_bp,0);const app=tp.filter(p=>p.applied).length;return `<tr><td data-label="Trader">${t.name}${t.username?` <span class=\"text-xs text-gray-400\">(@${t.username})</span>`:''}</td><td data-label="Plan">${tp.length?`${app}/${tp.length} days applied · Total ${(tot/100).toFixed(2)}%`:'No plan yet'}</td><td><button onclick="AdminPages._removeTrader(${t.id},'${t.name.replace(/'/g,"\\'")}')" class="btn-danger text-xs" style="padding:6px 12px">Remove</button></td></tr>`;}).join('')}
          ${traders.length===0?'<tr><td colspan="3" class="text-center py-8 text-gray-400">No traders yet</td></tr>':''}
        </tbody></table></div>
      </div>`,'Profit System · 22-Day Cycle');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Reads the selected unapplied plan day from the dropdown.
  // Returns null (with a toast) when no day is selected.
AdminPages._getDay=function(){
  const sel=document.getElementById('pnl-day');
  const day=parseInt(sel.value);
  if(!day){utils.toast('Please select a day','error');return null;}
  return {day};
};
// Confirms, then asks the server for new plans for ALL traders via
  // adminApi.generateTraderPlans and reloads the profit page.
AdminPages._genPlans=function(y,m){utils.confirm(`Generate new plans for ALL traders for ${y}-${m}? Applied days are kept; only future days are rebuilt.`,async()=>{try{await adminApi.generateTraderPlans({year:y,month:m});utils.toast('Plans generated!','success');AdminPages.profit();}catch(e){utils.toast(e.message,'error');};},'Generate');};
// Opens the edit modal for one trader's one day rate (in %).
AdminPages._editPlanDay=function(tid,y,m,day,curBp){utils.showModal(`<div class="modal"><h2 class="font-bold mb-3">Day ${day} Rate</h2><p class="text-sm text-gray-400 mb-3">Only this trader's remaining days rebalance — their Day 22 adjusts so the month total stays the same.</p><label class="input-label">Rate (%) — use a minus sign for a loss day</label><input id="pd-v" type="number" step="0.01" class="input-field mb-3" value="${(curBp/100).toFixed(2)}"><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="AdminPages._doEditPlanDay(${tid},${y},${m},${day})" class="btn-primary flex-1">Save</button></div></div>`);};
// Saves one trader's one day rate via adminApi.editTraderPlanDay.
AdminPages._doEditPlanDay=async function(tid,y,m,day){const v=document.getElementById('pd-v').value;const bp=Math.round(parseFloat(v)*100);if(isNaN(bp)){utils.toast('Enter a rate','error');return;}try{await adminApi.editTraderPlanDay(tid,y,m,day,{rate_bp:bp});utils.closeModal();utils.toast('Saved!','success');AdminPages.profit(tid);}catch(ex){utils.toast(ex.message,'error');}};
// Confirms, then applies the selected plan day to ALL active copies
  // via adminApi.applyPnl (rates come from each trader's plan).
AdminPages._applyAll=function(y,m){const d=AdminPages._getDay();if(!d)return;utils.confirm(`Apply Day ${d.day} to ALL active copies?`,async()=>{try{const r=await adminApi.applyPnl({day_number:d.day,year:y,month:m});utils.toast(`Applied to ${r.count} copies!`,'success');AdminPages.profit();}catch(e){utils.toast(e.message,'error');};},'Apply PnL');};
// Applies the selected plan day to one user (looked up by username
  // via adminApi.getUsers) through adminApi.applyPnl with user_id.
AdminPages._applySingle=async function(y,m){
  const d=AdminPages._getDay();if(!d)return;
  const uname=document.getElementById('pnl-uname').value.trim();
  if(!uname){utils.toast('Enter username','error');return;}
  try{const us=await adminApi.getUsers({search:uname,limit:1});if(!us.length){utils.toast('User not found','error');return;}await adminApi.applyPnl({day_number:d.day,year:y,month:m,user_id:us[0].id});utils.toast(`Applied to ${uname}!`,'success');}
  catch(e){utils.toast(e.message,'error');}
};
// Flips Auto Profit on/off via adminApi.toggleAutoProfit and reloads.
AdminPages._toggleAuto=async function(){try{const s=await adminApi.getAutoProfitStatus();const next=!(s.enabled!==false);const r=await adminApi.toggleAutoProfit({enabled:next});utils.toast('Auto Profit '+(r.enabled?'ON':'OFF'),'success');AdminPages.profit();}catch(e){utils.toast(e.message,'error');};};
// Confirms, then removes a trader via adminApi.deleteTrader (settles
// every active copy, deletes their future plan, hides the trader).
AdminPages._removeTrader=function(id,name){utils.confirm(`Remove ${name}? Every active copy is settled: the copied money returns to Main Balance, the profit stays in Profit Balance. Their future plan is deleted, past History stays.`,async()=>{try{const r=await adminApi.deleteTrader(id);utils.toast(`Trader removed — ${r.settled||0} copies settled`,'success');AdminPages.profit();}catch(e){utils.toast(e.message,'error');}},'Remove Trader');};
// Opens the Set Profit Target modal for one showcase account. The
  // field is empty when the account follows the global target.
AdminPages._setShowcaseTarget=function(id,cur){utils.showModal(`<div class="modal"><h2 class="font-bold mb-3">Profit Target (Showcase) #${id}</h2><p class="text-sm text-gray-400 mb-3">22-day total for this showcase account. Leave empty to use the global target.</p><label class="input-label">Profit Target (%)</label><input id="spt-v" type="number" step="0.1" min="0" max="100" class="input-field mb-3" value="${cur==null?'':(cur/100).toFixed(1)}" placeholder="Global default"><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="AdminPages._doShowcaseTarget(${id})" class="btn-primary flex-1">Save</button></div></div>`);};
// Saves a showcase account's profit target via adminApi.setShowcaseProfitTarget.
AdminPages._doShowcaseTarget=async function(id){const v=document.getElementById('spt-v').value;const bp=(v===''||v==null)?null:Math.round(parseFloat(v)*100);try{await adminApi.setShowcaseProfitTarget(id,{profit_target_bp:bp});utils.closeModal();utils.toast('Saved!','success');AdminPages.profit();}catch(ex){utils.toast(ex.message,'error');}};
