/*
 * deposit.js — Create Deposit page for Nexora FX.
 *
 * Two deposit methods (v122): Binance Pay (QR + Pay ID, Order ID) and
 * BEP20 USDT (BSC address, TxHash). The user picks a method, pays, then
 * submits the reference + amount. When Auto Deposit Approve is ON for
 * that rail, the payment is verified and credited to Main Balance at
 * once; otherwise it waits for admin approval.
 *
 * Key function:
 * - Pages.deposit — loads the deposit wallet, renders the method tabs
 *   and the form, and on submit calls api.submitDeposit with the method.
 * - Pages._depSetMethod(m) — switches the Binance Pay / BEP20 panels.
 *
 * Rules: USDT only. Wrong-account payments cannot be recovered, so the
 * Pay ID / BSC address must be double-checked. BEP20 only — sending
 * another network's USDT may lose funds permanently.
 * Gotcha: the ?v= cache version in script tags must be bumped on every
 * release, or browsers may serve stale code.
 * Note: this file uses CRLF line endings — preserve them on every edit.
 */
// Create Deposit page: method tabs + pay panel + reference form.
Pages.deposit=async function(){
  try{
    const [wallet,me]=await Promise.all([api.getDepositWallet(),api.getMe()]);
    const blocked=me.user?.blocks?.includes('deposit');
    const enabled=App.state.settings?.deposit_enabled!=='0' && !blocked;
    const bepAddr=wallet.bep20_address||'';
    Components.layout(`
      <div class="max-w-3xl">
        <div class="flex items-center gap-3 mb-6"><button onclick="history.back()" class="p-2 rounded-lg hover:bg-gray-100">${svgIcons.arrow_left}</button><div><h1 class="text-xl font-bold">Create Deposit</h1><p class="text-sm text-gray-400">Fund your account with USDT</p></div><button onclick="App.navigate('/history')" class="ml-auto btn-secondary text-sm" style="padding:8px 16px">Deposit History →</button></div>
        ${!enabled?`<div class="alert-warning">${blocked?'Deposits are disabled for your account.':'Deposits are currently disabled.'} Please contact support.</div>`:''}
        ${enabled?`<div class="card">
          <div class="flex items-center justify-between mb-4"><h2 class="font-bold text-lg">Deposit in 3 steps</h2><span class="orange-tag" id="dep-tag">BINANCE PAY</span></div>
          <div class="flex gap-2 mb-4">
            <button type="button" id="dep-m-bp" onclick="Pages._depSetMethod('binance_pay')" class="btn-primary text-sm" style="padding:8px 16px">Binance Pay</button>
            <button type="button" id="dep-m-bep" onclick="Pages._depSetMethod('bep20')" class="btn-secondary text-sm" style="padding:8px 16px">BEP20 USDT</button>
          </div>
          <div class="flex flex-col-reverse sm:flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-6 deposit-layout">
            <div id="dep-steps-bp">
              ${[['1','Scan the QR in Binance app','Open Binance → Pay → Scan, and scan the code shown here.'],['2','Send your payment','Send USDT only, and double-check the Pay ID before you confirm.'],['3','Enter Order ID and amount','Submit the form so your deposit can be verified and credited.']].map(([n,t,d])=>`<div class="flex gap-3 mb-4"><div class="w-7 h-7 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">${n}</div><div><div class="font-semibold text-sm">${t}</div><div class="text-xs text-gray-400">${d}</div></div></div>`).join('')}
            </div>
            <div id="dep-steps-bep" style="display:none">
              ${[['1','Copy the BSC address','Send USDT on the BNB Smart Chain (BEP20) only.'],['2','Send your payment','Send USDT only, and double-check the address before you confirm.'],['3','Enter Transaction Hash and amount','Submit the form so your deposit can be verified and credited.']].map(([n,t,d])=>`<div class="flex gap-3 mb-4"><div class="w-7 h-7 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">${n}</div><div><div class="font-semibold text-sm">${t}</div><div class="text-xs text-gray-400">${d}</div></div></div>`).join('')}
            </div>
            <div>
              <div id="dep-panel-bp" class="border border-gray-100 rounded-xl p-4 text-center mb-4">
                <div class="text-xs font-bold text-gray-400 uppercase mb-3">BINANCE PAY</div>
                ${wallet.qr?`<img src="${wallet.qr}" class="w-40 h-40 mx-auto mb-2" alt="QR Code">`:
                  `<div class="w-40 h-40 mx-auto mb-2 bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-sm">QR not set</div>`}
                ${wallet.address?`<div class="text-xs text-gray-400 break-all">${wallet.address}</div>`:''}
                <p class="text-xs text-gray-300 mt-2">QR updates automatically — not a static file</p>
              </div>
              <div id="dep-panel-bep" class="border border-gray-100 rounded-xl p-4 text-center mb-4" style="display:none">
                <div class="text-xs font-bold text-gray-400 uppercase mb-3">BEP20 USDT — BNB SMART CHAIN</div>
                ${bepAddr?`<div class="text-xs text-gray-500 break-all mb-2">${bepAddr}</div><button type="button" onclick="navigator.clipboard.writeText('${bepAddr}').then(()=>utils.toast('Address copied','success'))" class="btn-secondary text-sm" style="padding:8px 16px">Copy address</button>`:
                  `<div class="text-sm text-gray-400">BEP20 address not set yet — please contact support.</div>`}
                <p class="text-xs text-gray-300 mt-2">BEP20 only — sending another network may lose funds permanently.</p>
              </div>
              <form id="dep-form" class="space-y-4">
                <div><label class="input-label" id="dep-txid-label">Order ID</label><input name="txid" type="text" placeholder="Paste your Binance Pay Order ID" class="input-field" required><p class="text-xs text-gray-400 mt-1" id="dep-txid-help">Find it in Binance: Pay history, then open the payment you just sent.</p></div>
                <div><label class="input-label">Amount (USDT)</label><input name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" class="input-field" required></div>
                <div id="dep-err" class="alert-danger hidden"></div>
                <button type="submit" id="dep-btn" class="btn-primary">Submit Deposit</button>
              </form>
            </div>
          </div>
        </div>`:''}
      </div>
    `,'Create Deposit','Fund your account with USDT');
    Pages._depMethod='binance_pay';
    if(enabled) document.getElementById('dep-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('dep-err'),btn=document.getElementById('dep-btn');
      err.classList.add('hidden');utils.loading(btn,true);
      try{await api.submitDeposit({txid:f.txid.value,amount:parseFloat(f.amount.value),method:Pages._depMethod});utils.toast('Deposit submitted successfully','success');App.navigate('/history');}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
      utils.loading(btn,false);
    };
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Switch the deposit method panels (Binance Pay / BEP20).
Pages._depSetMethod=function(m){
  Pages._depMethod=m;
  const bp=m==='binance_pay';
  const tag=document.getElementById('dep-tag'); if(tag) tag.textContent=bp?'BINANCE PAY':'BEP20 USDT';
  const sb=document.getElementById('dep-steps-bp'); if(sb) sb.style.display=bp?'':'none';
  const se=document.getElementById('dep-steps-bep'); if(se) se.style.display=bp?'none':'';
  const pb=document.getElementById('dep-panel-bp'); if(pb) pb.style.display=bp?'':'none';
  const pe=document.getElementById('dep-panel-bep'); if(pe) pe.style.display=bp?'none':'';
  const lb=document.getElementById('dep-txid-label'); if(lb) lb.textContent=bp?'Order ID':'Transaction Hash';
  const f=document.querySelector('#dep-form input[name="txid"]'); if(f) f.placeholder=bp?'Paste your Binance Pay Order ID':'Paste your BEP20 transaction hash (0x...)';
  const h=document.getElementById('dep-txid-help'); if(h) h.textContent=bp?'Find it in Binance: Pay history, then open the payment you just sent.':'Find it in your wallet or on BscScan: the 0x transaction hash of the USDT transfer.';
  const b1=document.getElementById('dep-m-bp'); if(b1){b1.className=bp?'btn-primary text-sm':'btn-secondary text-sm';b1.style.padding='8px 16px';}
  const b2=document.getElementById('dep-m-bep'); if(b2){b2.className=bp?'btn-secondary text-sm':'btn-primary text-sm';b2.style.padding='8px 16px';}
};
