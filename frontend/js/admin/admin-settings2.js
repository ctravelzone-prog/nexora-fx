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
    const [s,keys]=await Promise.all([adminApi.getMoney(),(adminApi.getBinanceKeys?adminApi.getBinanceKeys():Promise.resolve({})).catch(()=>({}))]);
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
    <form id="auto-form" class="card mt-6 space-y-4">
      <h3 class="font-bold text-lg">Auto Payments</h3>
      <p class="text-sm text-gray-400">Auto Deposit Approve verifies a payment on-chain (BEP20) or on Binance Pay and credits Main Balance at once. Auto Withdrawal sends approved payouts via Binance. Both are OFF by default — turn them on only after the Binance keys are saved in the "Binance API Keys" section below. When OFF, the manual flow continues as before.</p>
      <style>.nx-sw{display:inline-flex;align-items:center;gap:10px;cursor:pointer;padding:8px 0}.nx-sw input{display:none}.nx-sw-track{width:54px;height:28px;border-radius:999px;background:#cbd5e1;position:relative;transition:background .2s;flex:none}.nx-sw-knob{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}.nx-sw input:checked + .nx-sw-track{background:#f97316}.nx-sw input:checked + .nx-sw-track .nx-sw-knob{left:29px}.nx-sw-state{font-weight:700;font-size:14px}</style>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="input-label">Auto Deposit Approve</label><label class="nx-sw"><input type="checkbox" name="auto_dep" ${s.auto_deposit_enabled==='1'?'checked':''}><span class="nx-sw-track"><span class="nx-sw-knob"></span></span><span class="nx-sw-state" id="auto-dep-state">${s.auto_deposit_enabled==='1'?'ON':'OFF'}</span></label></div>
        <div><label class="input-label">Auto Withdrawal</label><label class="nx-sw"><input type="checkbox" name="auto_wd" ${s.auto_withdraw_enabled==='1'?'checked':''}><span class="nx-sw-track"><span class="nx-sw-knob"></span></span><span class="nx-sw-state" id="auto-wd-state">${s.auto_withdraw_enabled==='1'?'ON':'OFF'}</span></label></div>
        <div><label class="input-label">Binance Pay rail</label><select name="bp_rail" class="input-field"><option value="1" ${s.binance_pay_rail_enabled!=='0'?'selected':''}>Enabled</option><option value="0" ${s.binance_pay_rail_enabled==='0'?'selected':''}>Disabled</option></select></div>
        <div><label class="input-label">BEP20 rail</label><select name="bep20_rail" class="input-field"><option value="1" ${s.bep20_rail_enabled!=='0'?'selected':''}>Enabled</option><option value="0" ${s.bep20_rail_enabled==='0'?'selected':''}>Disabled</option></select></div>
        <div><label class="input-label">Daily withdrawal limit — per user ($)</label><input name="daily_lim" type="number" step="0.01" min="0" value="${parseInt(s.auto_daily_withdraw_limit_cents||'50000')/100}" class="input-field"></div>
        <div><label class="input-label">Per-transaction max withdrawal ($)</label><input name="per_tx_max" type="number" step="0.01" min="0" value="${parseInt(s.auto_per_tx_max_cents||'100000')/100}" class="input-field"></div>
        <div><label class="input-label">Global daily withdrawal cap ($)</label><input name="global_cap" type="number" step="0.01" min="0" value="${parseInt(s.auto_global_daily_cap_cents||'500000')/100}" class="input-field"></div>
        <div><label class="input-label">Binance Pay ID</label><input name="pay_id" type="text" value="${s.binance_pay_id||''}" class="input-field" placeholder="Your Binance Pay ID"></div>
        <div><label class="input-label">BEP20 USDT address (BSC)</label><input name="bep20_addr" type="text" value="${s.bep20_address||''}" class="input-field" placeholder="0x..."></div>
        <div><label class="input-label">BscScan API key (optional)</label><input name="bsc_key" type="text" value="${s.bscscan_key||''}" class="input-field" placeholder="Leave empty to use the public BSC RPC"></div>
      </div>
      <div class="border-t pt-4 mt-2">
        <h4 class="font-bold mb-1">Binance API Keys</h4>
        <p class="text-sm text-gray-400 mb-3">Each Binance API comes as TWO parts — a <strong>Key</strong> and a <strong>Secret</strong> — both are needed, they are not the same thing twice. Read-only (Key + Secret) is for auto deposits; Withdrawal (Key + Secret) is for auto payouts. Paste them here — no VPS edit needed. They are encrypted on the server and never shown in full. Leave a field empty to keep the saved value.</p>
        <div id="bk-status" class="text-sm mb-3">${keys.read_key_set?`Read-only key: <strong>${keys.read_key_masked||'set'}</strong> · Secret: <strong>${keys.read_secret_set?'set':'not set'}</strong><br>`:''}${keys.withdraw_key_set?`Withdrawal key: <strong>${keys.withdraw_key_masked||'set'}</strong> · Secret: <strong>${keys.withdraw_secret_set?'set':'not set'}</strong>`:''}${!keys.read_key_set&&!keys.withdraw_key_set?'<span class="text-gray-400">No Binance keys saved yet.</span>':''}</div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="input-label">Read-only API Key</label><input name="bk_rk" type="password" class="input-field" placeholder="Paste read-only key" autocomplete="off"></div>
          <div><label class="input-label">Read-only API Secret</label><input name="bk_rs" type="password" class="input-field" placeholder="Paste read-only secret" autocomplete="off"></div>
          <div><label class="input-label">Withdrawal API Key</label><input name="bk_wk" type="password" class="input-field" placeholder="Paste withdrawal key" autocomplete="off"></div>
          <div><label class="input-label">Withdrawal API Secret</label><input name="bk_ws" type="password" class="input-field" placeholder="Paste withdrawal secret" autocomplete="off"></div>
        </div>
        <p class="text-xs text-gray-400 mt-2">Read-only key: Binance → API Management → Create API → "Enable Reading" ONLY (no trading, no withdrawals). Withdrawal key: separate API → "Enable Withdrawals" + "Enable Reading", Trading OFF. Both keys: IP whitelist <strong>201.18.220.156</strong>. You can also set them in the VPS .env instead (BINANCE_READ_API_KEY / BINANCE_READ_API_SECRET / BINANCE_WITHDRAW_API_KEY / BINANCE_WITHDRAW_API_SECRET).</p>
        <div id="bke" class="alert-danger hidden mt-3"></div>
        <button type="button" id="bkb" class="btn-primary mt-3" onclick="AdminPages._saveBinanceKeys()">Save Binance Keys</button>
      </div>
      <div id="ape" class="alert-danger hidden"></div>
      <button type="submit" id="apb" class="btn-primary">Save Auto Payments</button>
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
// Auto Payments form (v122): toggles + limits + Pay ID / BSC address.
    // Limits are saved in cents; the Binance API keys are NOT here (env).
    const _sw=(n,id)=>{const el=document.querySelector('#auto-form input[name="'+n+'"]');const st=document.getElementById(id);if(el&&st)el.addEventListener('change',()=>{st.textContent=el.checked?'ON':'OFF';});};
    _sw('auto_dep','auto-dep-state');_sw('auto_wd','auto-wd-state');
    document.getElementById('auto-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('ape'),btn=document.getElementById('apb');
      err.classList.add('hidden');
      utils.confirm('Save auto payment settings? Audit-logged.',async()=>{
        utils.loading(btn,true);
        try{await adminApi.saveMoney({auto_deposit_enabled:f.auto_dep.checked?'1':'0',auto_withdraw_enabled:f.auto_wd.checked?'1':'0',binance_pay_rail_enabled:f.bp_rail.value,bep20_rail_enabled:f.bep20_rail.value,auto_daily_withdraw_limit_cents:Math.round(parseFloat(f.daily_lim.value)*100),auto_per_tx_max_cents:Math.round(parseFloat(f.per_tx_max.value)*100),auto_global_daily_cap_cents:Math.round(parseFloat(f.global_cap.value)*100),binance_pay_id:f.pay_id.value.trim(),bep20_address:f.bep20_addr.value.trim(),bscscan_key:f.bsc_key.value.trim()});utils.toast('Saved!','success');}
        catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
        utils.loading(btn,false);
      },'Save');
    };
// Save Binance API keys (v123): posts only the filled fields; empty
// fields keep the saved value. Refreshes the masked status line.
AdminPages._saveBinanceKeys=async function(){
  const form=document.getElementById('auto-form'); if(!form) return;
  const err=document.getElementById('bke'),btn=document.getElementById('bkb');
  err.classList.add('hidden');
  const body={};
  const g=(n)=>{const el=form.querySelector('[name="'+n+'"]');return el?el.value.trim():'';};
  if(g('bk_rk')) body.read_key=g('bk_rk');
  if(g('bk_rs')) body.read_secret=g('bk_rs');
  if(g('bk_wk')) body.withdraw_key=g('bk_wk');
  if(g('bk_ws')) body.withdraw_secret=g('bk_ws');
  if(!Object.keys(body).length){err.textContent='Paste at least one key or secret first.';err.classList.remove('hidden');return;}
  utils.confirm('Save these Binance API keys? They are encrypted on the server.',async()=>{
    utils.loading(btn,true);
    try{
      const r=await adminApi.saveBinanceKeys(body);
      const st=document.getElementById('bk-status');
      if(st) st.innerHTML=`${r.read_key_set?`Read-only key: <strong>${r.read_key_masked||'set'}</strong> · Secret: <strong>${r.read_secret_set?'set':'not set'}</strong><br>`:''}${r.withdraw_key_set?`Withdrawal key: <strong>${r.withdraw_key_masked||'set'}</strong> · Secret: <strong>${r.withdraw_secret_set?'set':'not set'}</strong>`:''}${!r.read_key_set&&!r.withdraw_key_set?'<span class="text-gray-400">No Binance keys saved yet.</span>':''}`;
      ['bk_rk','bk_rs','bk_wk','bk_ws'].forEach(n=>{const el=form.querySelector('[name="'+n+'"]');if(el)el.value='';});
      utils.toast('Keys saved!','success');
    }catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
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
    <div class="card w-full">
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
