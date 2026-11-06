/*
 * admin-settings2.js — Money Settings and Deposit Wallet pages.
 *
 * Renders /admin/money-settings (withdraw fees, lock period, profit target,
 * profit minimum withdrawal, referral rate, deposits/withdrawals on-off)
 * and /admin/deposit-wallet (the Binance address and QR users pay to).
 * Key functions: AdminPages.moneySettings, AdminPages.depositWallet.
 *
 * Gotchas:
 * - Money Settings is Super Admin only and every save is audit-logged.
 * - Percent inputs are converted to basis points and dollar inputs to
 *   cents before saving (100 bp = 1%, 100 cents = $1).
 * - Changing the deposit wallet takes effect immediately: users see the
 *   new address / QR on the Deposit screen with no code change.
 * - Profit Target default is 10%; changing it rebalances only this
 *   month's remaining days, never days already applied.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/money-settings: withdraw fees, lock period, profit
  // target, profit minimum withdrawal, referral rate and on/off switches.
  // Values come from adminApi.getMoney; saving needs a confirmation.
AdminPages.moneySettings=async function(){
  try{
    const s=await adminApi.getMoney();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Money Settings</h2>
    <div class="alert-warning mb-4 text-sm">Changes are audit-logged. Super Admin only.</div>
    <form id="money-form" class="card space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="input-label">Early Withdraw Fee (%)</label><input name="fee" type="number" step="0.1" value="${parseInt(s.withdraw_early_fee_bp)/100}" class="input-field"></div>
        <div><label class="input-label">Regular Withdraw Fee (%)</label><input name="rfee" type="number" step="0.1" value="${parseInt(s.withdraw_regular_fee_bp||'0')/100}" class="input-field"></div>
        <div><label class="input-label">Profit Target (%)</label><input name="ptarget" type="number" step="0.1" min="0" max="100" value="${parseInt(s.profit_target_bp||'1000')/100}" class="input-field"></div>
        <div><label class="input-label">Lock Period (months)</label><input name="lock" type="number" min="1" value="${s.withdraw_lock_months}" class="input-field"></div>
        <div><label class="input-label">Profit Min Withdraw ($)</label><input name="pmin" type="number" step="0.01" value="${parseInt(s.profit_min_cents)/100}" class="input-field"></div>
        <div><label class="input-label">Referral Rate (%)</label><input name="ref" type="number" step="0.1" value="${parseInt(s.referral_bp)/100}" class="input-field"></div>
        <div><label class="input-label">Deposits</label><select name="dep" class="input-field"><option value="1" ${s.deposit_enabled==='1'?'selected':''}>Enabled</option><option value="0" ${s.deposit_enabled==='0'?'selected':''}>Disabled</option></select></div>
        <div><label class="input-label">Withdrawals</label><select name="wd" class="input-field"><option value="1" ${s.withdraw_enabled==='1'?'selected':''}>Enabled</option><option value="0" ${s.withdraw_enabled==='0'?'selected':''}>Disabled</option></select></div>
      </div>
      <p class="text-xs text-gray-400">Profit Target is the 22-day cycle total for all users. Changing it rebalances this month's remaining days automatically; days already applied stay as they are.</p>
      <div id="me" class="alert-danger hidden"></div>
      <button type="submit" id="mb" class="btn-primary">Save Money Settings</button>
    </form>
    <div class="card mt-6">
      <h3 class="font-bold text-lg mb-1">User Access Controls</h3>
      <p class="text-sm text-gray-400 mb-4">Block Deposit or Withdraw for one user, or switch Request Money off / on once for them. A blocked user sees a notice on their Deposit, Withdraw and Request Money pages, and the server blocks the request too.</p>
      <div class="flex gap-2 mb-3">
        <input id="uac-q" type="text" placeholder="Search user by name, username or email" class="input-field flex-1">
        <button id="uac-search" class="btn-secondary text-sm" style="padding:10px 16px">Search</button>
      </div>
      <div id="uac-results"></div>
      <div id="uac-selected" class="mt-4"></div>
      <h4 class="font-bold mt-6 mb-2">Currently blocked / restricted</h4>
      <div id="uac-list"><p class="text-sm text-gray-400">Loading…</p></div>
    </div>`,'Money Settings');
    document.getElementById('money-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('me'),btn=document.getElementById('mb');
      err.classList.add('hidden');
      utils.confirm('Save money settings? Audit-logged.',async()=>{
        utils.loading(btn,true);
        // Convert percent inputs to basis points and dollar inputs to cents.
        try{await adminApi.saveMoney({withdraw_early_fee_bp:Math.round(parseFloat(f.fee.value)*100),withdraw_regular_fee_bp:Math.round(parseFloat(f.rfee.value)*100),profit_target_bp:Math.round(parseFloat(f.ptarget.value)*100),withdraw_lock_months:parseInt(f.lock.value),profit_min_cents:Math.round(parseFloat(f.pmin.value)*100),referral_bp:Math.round(parseFloat(f.ref.value)*100),deposit_enabled:f.dep.value,withdraw_enabled:f.wd.value});utils.toast('Saved!','success');}
        catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
        utils.loading(btn,false);
      },'Save');
    };
// User Access Controls (below the money form): search a user, block or
// unblock their Deposit/Withdraw, or switch their Request Money off / on
// (optionally once). The list shows every currently blocked or restricted
// user; unblocking removes the row from the list.
    AdminPages._uacFound={};
    AdminPages._uacSelectedId=null;
    AdminPages._uacList=async function(){
      const el=document.getElementById('uac-list'); if(!el) return;
      try{const d=await adminApi.getUserBlocks();
        const rows=[];
        d.blocks.forEach(b=>rows.push(`<div class="flex items-center justify-between gap-3 py-3 border-b last:border-0"><div class="min-w-0"><div class="font-semibold text-sm">${b.full_name} (@${b.username})</div><div class="text-xs text-gray-400">${b.kind==='deposit'?'Deposit blocked':'Withdraw blocked'} · ${utils.fmtDateTime(b.created_at)}</div></div><button class="btn-secondary text-sm" style="padding:6px 12px" onclick="AdminPages._uacUnblock(${b.id})">Unblock</button></div>`));
        d.requestMoneyOff.forEach(u=>rows.push(`<div class="flex items-center justify-between gap-3 py-3 border-b last:border-0"><div class="min-w-0"><div class="font-semibold text-sm">${u.full_name} (@${u.username})</div><div class="text-xs text-gray-400">Request Money off${u.request_money_one_time?' · one-time':''}</div></div><button class="btn-secondary text-sm" style="padding:6px 12px" onclick="AdminPages._uacRm(${u.id},1,0)">Enable</button></div>`));
        el.innerHTML=rows.length?rows.join(''):'<p class="text-sm text-gray-400">No blocked or restricted users.</p>';
      }catch(e){el.innerHTML=`<p class="text-sm text-red-500">${e.message}</p>`;}
    };
    AdminPages._uacSelect=async function(id){
      const u=AdminPages._uacFound[id]; if(!u) return;
      AdminPages._uacSelectedId=id;
      try{const d=await adminApi.getUserBlocks();
        const dep=d.blocks.find(b=>b.user_id===id&&b.kind==='deposit');
        const wd=d.blocks.find(b=>b.user_id===id&&b.kind==='withdraw');
        const rmOff=d.requestMoneyOff.find(x=>x.id===id);
        document.getElementById('uac-selected').innerHTML=`<div class="border rounded-xl p-4">
          <div class="font-bold">${u.full_name} (@${u.username})</div>
          <div class="text-xs text-gray-400 mb-3">${u.email||''}</div>
          <div class="flex flex-wrap gap-2">
            ${dep?`<button class="btn-secondary text-sm" style="padding:8px 14px" onclick="AdminPages._uacUnblock(${dep.id})">Unblock Deposit</button>`:`<button class="btn-secondary text-sm" style="padding:8px 14px" onclick="AdminPages._uacBlock(${u.id},'deposit')">Block Deposit</button>`}
            ${wd?`<button class="btn-secondary text-sm" style="padding:8px 14px" onclick="AdminPages._uacUnblock(${wd.id})">Unblock Withdraw</button>`:`<button class="btn-secondary text-sm" style="padding:8px 14px" onclick="AdminPages._uacBlock(${u.id},'withdraw')">Block Withdraw</button>`}
            ${rmOff?`<button class="btn-secondary text-sm" style="padding:8px 14px" onclick="AdminPages._uacRmOnce(${u.id})">Enable Request Money</button>`:`<button class="btn-secondary text-sm" style="padding:8px 14px" onclick="AdminPages._uacRm(${u.id},0,0)">Disable Request Money</button>`}
          </div>
          ${rmOff?`<label class="flex items-center gap-2 mt-3 text-sm"><input type="checkbox" id="uac-once"> Enable once only — turns off again after they use it once</label>`:''}
        </div>`;
      }catch(e){utils.toast(e.message,'error');}
    };
    AdminPages._uacBlock=async function(id,kind){
      try{await adminApi.blockUser(id,kind);utils.toast(kind==='deposit'?'Deposit blocked':'Withdraw blocked','success');AdminPages._uacSelect(id);AdminPages._uacList();}catch(e){utils.toast(e.message,'error');}
    };
    AdminPages._uacUnblock=async function(blockId){
      try{await adminApi.unblockUser(blockId);utils.toast('Unblocked','success');AdminPages._uacList();if(AdminPages._uacSelectedId) AdminPages._uacSelect(AdminPages._uacSelectedId);}catch(e){utils.toast(e.message,'error');}
    };
    AdminPages._uacRm=async function(id,enabled,oneTime){
      try{await adminApi.setRequestMoney(id,enabled,oneTime);utils.toast(enabled?'Request Money enabled':'Request Money disabled','success');AdminPages._uacList();if(AdminPages._uacSelectedId===id) AdminPages._uacSelect(id);}catch(e){utils.toast(e.message,'error');}
    };
    AdminPages._uacRmOnce=async function(id){
      const once=document.getElementById('uac-once')&&document.getElementById('uac-once').checked?1:0;
      AdminPages._uacRm(id,1,once);
    };
    document.getElementById('uac-search').onclick=async()=>{
      const q=document.getElementById('uac-q').value.trim(); if(!q) return;
      try{const d=await adminApi.getUsers({search:q,limit:5});
        const users=Array.isArray(d)?d:(d.users||[]);
        users.forEach(u=>{AdminPages._uacFound[u.id]=u;});
        document.getElementById('uac-results').innerHTML=users.length?users.map(u=>`<div class="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onclick="AdminPages._uacSelect(${u.id})"><div><div class="font-semibold text-sm">${u.full_name} (@${u.username})</div><div class="text-xs text-gray-400">${u.email||''}</div></div><span class="text-xs text-orange-500">Select →</span></div>`).join(''):'<p class="text-sm text-gray-400">No user found.</p>';
      }catch(e){document.getElementById('uac-results').innerHTML=`<p class="text-sm text-red-500">${e.message}</p>`;}
    };
    document.getElementById('uac-q').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('uac-search').click();}};
    AdminPages._uacList();
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};

// Renders /admin/deposit-wallet: current Binance address and QR, plus
  // the form to change them. Loads via adminApi.getDepositWallet.
AdminPages.depositWallet=async function(){
  try{
    const w=await adminApi.getDepositWallet();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Deposit Wallet Settings</h2>
    <div class="card max-w-lg">
      ${w.qr?`<img src="${w.qr}" class="w-40 h-40 rounded-xl border mb-3" alt="QR">`:''}
      ${w.address?`<p class="text-xs text-gray-400 mb-3 break-all">${w.address}</p>`:''}
      <form id="wf" class="space-y-4">
        <div><label class="input-label">Binance Wallet Address</label><input name="address" type="text" value="${w.address||''}" class="input-field"></div>
        <div><label class="input-label">Upload QR Code Image</label><input type="file" id="qr-file" accept="image/*" class="input-field"></div>
        <div id="we" class="alert-danger hidden"></div>
        <button type="submit" id="wb" class="btn-primary">Save Wallet Settings</button>
      </form>
    </div>`,'Deposit Wallet Settings');
    document.getElementById('wf').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('we'),btn=document.getElementById('wb');err.classList.add('hidden');
      utils.confirm('Update deposit wallet? Users immediately see new address/QR.',async()=>{
        utils.loading(btn,true);
        const fd=new FormData();if(f.address.value)fd.append('address',f.address.value);const qrf=document.getElementById('qr-file');if(qrf?.files[0])fd.append('qr',qrf.files[0]);
        try{await api.upload('/api/admin/settings/deposit-wallet',fd,true);utils.toast('Saved!','success');AdminPages.depositWallet();}
        catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
        utils.loading(btn,false);
      },'Save');
    };
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
