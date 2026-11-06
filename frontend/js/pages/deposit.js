/*
 * deposit.js — Create Deposit page for Nexora FX.
 *
 * Shows the Binance Pay QR code and Pay ID from the admin
 * (GET /api/deposit/wallet via api.getDepositWallet), explains the
 * 3 deposit steps, and submits the TxID and amount for admin approval.
 *
 * Key function:
 * - Pages.deposit — loads the deposit wallet, renders the form, and
 *   on submit calls api.submitDeposit, then goes to History.
 *
 * Rules: deposit is Binance Pay with TxID + amount, USDT only.
 * Until the admin approves it, the deposit shows as Pending in
 * History and is not counted in the totals. Wrong-account payments
 * cannot be recovered, so the Pay ID must be double-checked.
 * Gotcha: the ?v= cache version in script tags must be bumped on every
 * release, or browsers may serve stale code.
 * Note: this file uses CRLF line endings — preserve them on every edit.
 */
// Create Deposit page: Binance Pay QR + TxID form. See the header above.
Pages.deposit=async function(){
  try{
    const [wallet,me]=await Promise.all([api.getDepositWallet(),api.getMe()]);
    const blocked=me.user?.blocks?.includes('deposit');
    const enabled=App.state.settings?.deposit_enabled!=='0' && !blocked;
    Components.layout(`
      <div class="max-w-3xl">
        <div class="flex items-center gap-3 mb-6"><button onclick="history.back()" class="p-2 rounded-lg hover:bg-gray-100">${svgIcons.arrow_left}</button><div><h1 class="text-xl font-bold">Create Deposit</h1><p class="text-sm text-gray-400">Fund your account with Binance Pay (USDT)</p></div><button onclick="App.navigate('/history')" class="ml-auto btn-secondary text-sm" style="padding:8px 16px">Deposit History →</button></div>
        ${!enabled?`<div class="alert-warning">${blocked?'Deposits are disabled for your account.':'Deposits are currently disabled.'} Please contact support.</div>`:''}
        ${enabled?`<div class="card">
          <div class="flex items-center justify-between mb-4"><h2 class="font-bold text-lg">Deposit in 3 steps</h2><span class="orange-tag">BINANCE PAY</span></div>
          <div class="flex flex-col-reverse sm:flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-6 deposit-layout">
            <div>
              ${[['1','Scan the QR in Binance app','Open Binance → Pay → Scan, and scan the code shown here.'],['2','Send your payment','Send USDT only, and double-check the Pay ID before you confirm.'],['3','Enter Transaction ID and amount','Submit the form so your deposit can be verified and credited.']].map(([n,t,d])=>`<div class="flex gap-3 mb-4"><div class="w-7 h-7 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">${n}</div><div><div class="font-semibold text-sm">${t}</div><div class="text-xs text-gray-400">${d}</div></div></div>`).join('')}
            </div>
            <div>
              <div class="border border-gray-100 rounded-xl p-4 text-center mb-4">
                <div class="text-xs font-bold text-gray-400 uppercase mb-3">BINANCE PAY</div>
                ${wallet.qr?`<img src="${wallet.qr}" class="w-40 h-40 mx-auto mb-2" alt="QR Code">`:
                  `<div class="w-40 h-40 mx-auto mb-2 bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-sm">QR not set</div>`}
                ${wallet.address?`<div class="text-xs text-gray-400 break-all">${wallet.address}</div>`:''}
                <p class="text-xs text-gray-300 mt-2">QR updates automatically — not a static file</p>
              </div>
              <form id="dep-form" class="space-y-4">
                <div><label class="input-label">Transaction ID</label><input name="txid" type="text" placeholder="Paste Transaction ID / Order ID" class="input-field" required><p class="text-xs text-gray-400 mt-1">Find it in Binance: Pay history, then open the payment you just sent.</p></div>
                <div><label class="input-label">Amount (USDT)</label><input name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" class="input-field" required></div>
                <div id="dep-err" class="alert-danger hidden"></div>
                <button type="submit" id="dep-btn" class="btn-primary">Submit Deposit</button>
              </form>
            </div>
          </div>
        </div>`:''}
      </div>
    `,'Create Deposit','Fund your account with Binance Pay (USDT)');
    if(enabled) document.getElementById('dep-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('dep-err'),btn=document.getElementById('dep-btn');
      err.classList.add('hidden');utils.loading(btn,true);
      try{await api.submitDeposit({txid:f.txid.value,amount:parseFloat(f.amount.value)});utils.toast('Deposit submitted successfully','success');App.navigate('/history');}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
      utils.loading(btn,false);
    };
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
