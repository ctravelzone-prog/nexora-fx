// admin-settings2.js — Money settings + Deposit Wallet
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
    </form>`,'Money Settings');
    document.getElementById('money-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('me'),btn=document.getElementById('mb');
      err.classList.add('hidden');
      utils.confirm('Save money settings? Audit-logged.',async()=>{
        utils.loading(btn,true);
        try{await adminApi.saveMoney({withdraw_early_fee_bp:Math.round(parseFloat(f.fee.value)*100),withdraw_regular_fee_bp:Math.round(parseFloat(f.rfee.value)*100),profit_target_bp:Math.round(parseFloat(f.ptarget.value)*100),withdraw_lock_months:parseInt(f.lock.value),profit_min_cents:Math.round(parseFloat(f.pmin.value)*100),referral_bp:Math.round(parseFloat(f.ref.value)*100),deposit_enabled:f.dep.value,withdraw_enabled:f.wd.value});utils.toast('Saved!','success');}
        catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
        utils.loading(btn,false);
      },'Save');
    };
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};

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
