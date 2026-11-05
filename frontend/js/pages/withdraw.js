// pages/withdraw.js
Pages.withdraw=async function(){
  try{
    const [info,me]=await Promise.all([api.getWithdrawInfo(),api.getMe()]);
    const b=me.balance,locked=info.is_locked,fee=locked?info.early_fee_percent:(info.regular_fee_percent||0);
    Components.layout(`<div class="max-w-4xl">
      <div class="flex items-center gap-3 mb-6"><button onclick="history.back()" class="p-2 rounded-lg hover:bg-gray-100">${svgIcons.arrow_left}</button><h1 class="text-xl font-bold">Withdraw</h1><button onclick="App.navigate('/history')" class="ml-auto btn-secondary text-sm" style="padding:8px 16px">Withdraw History →</button></div>
      <div class="flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-6 two-col-layout">
        <div class="card">
          <h2 class="font-bold mb-1">Main Balance Withdraw</h2>
          <p class="text-xs text-gray-400 mb-4">From Main Balance only — ${utils.fmtMoney(b.main_cents)} available</p>
          ${locked?`<div class="alert-warning mb-3 text-sm"><strong>🔒 Locked until ${info.unlock_date||'—'}</strong> · ${info.months_remaining||0} months remaining<div class="mt-2 h-1.5 bg-gray-200 rounded-full"><div class="h-full bg-orange-500 rounded-full" style="width:${Math.max(5,100-((info.months_remaining||0)/3*100))}%"></div></div></div>`:''}
          <p class="text-sm mb-3">${locked?'<strong>'+info.early_fee_percent+'% deducted</strong> until lock expires.':(fee>0?'<strong>'+fee+'% fee applies</strong> on every withdraw.':'No fee — lock has expired.')}</p>
          <div class="mb-3 p-3 border-2 border-orange-200 rounded-xl text-sm"><strong>USDT (BEP20)</strong> — The only withdraw method</div>
          <form id="main-wd-form" class="space-y-3">
            <div><label class="input-label">Amount (USD)</label><input name="amount" type="number" step="0.01" min="0.01" class="input-field" placeholder="0.00" oninput="Pages._mfee(this,${fee},${locked?1:0})"></div>
            <div id="main-fee-info" class="text-sm text-gray-500 min-h-5"></div>
            <div><label class="input-label">USDT BEP20 Wallet Address</label><input name="wallet" type="text" placeholder="0x..." class="input-field" required></div>
            <div id="main-err" class="alert-danger hidden"></div>
            <button type="submit" id="main-btn" class="btn-primary">Submit Main Withdraw</button>
          </form>
        </div>
        <div class="card">
          <h2 class="font-bold mb-1">Profit Balance Withdraw</h2>
          <p class="text-xs text-gray-400 mb-3">Your earned profit only — separate from Main</p>
          <div class="flex justify-end mb-3"><span class="pill pill-gray text-xs">MIN $10.00</span></div>
          <div class="space-y-2 text-sm mb-4">
            <div class="flex justify-between"><span class="text-gray-400">Total PnL</span><span class="profit">+${utils.fmtMoney(b.profit_cents)}</span></div>
            <div class="flex justify-between border-t pt-2"><span class="font-bold">Profit Balance</span><span class="font-bold text-green-500">${utils.fmtMoney(b.profit_cents)}</span></div>
          </div>
          ${b.profit_cents<1000?`<p class="text-sm text-orange-500 mb-3">You need ${utils.fmtMoney(1000-b.profit_cents)} more to reach $10.00 minimum.</p>`:''}
          <form id="profit-wd-form" class="space-y-3">
            <div><label class="input-label">Amount (USD)</label><input name="amount" type="number" step="0.01" min="10" class="input-field" placeholder="Min $10.00"><p class="text-xs text-gray-400 mt-1">Minimum $10.00 · Max = Profit Balance · USDT BEP20 only</p></div>
            <div><label class="input-label">USDT BEP20 Wallet Address</label><input name="wallet" type="text" placeholder="Paste your BEP20 address (starts with 0x...)" class="input-field" required></div>
            <div class="alert-warning text-xs">⚠️ BEP20 only — sending to another network may lose funds permanently.</div>
            <div id="profit-err" class="alert-danger hidden"></div>
            <button type="submit" id="profit-btn" class="btn-primary" ${b.profit_cents<1000?'disabled':''}>Submit Profit Withdraw</button>
          </form>
        </div>
      </div></div>`,'Withdraw','');
    document.getElementById('main-wd-form').onsubmit=async(e)=>{e.preventDefault();const f=e.target,err=document.getElementById('main-err'),btn=document.getElementById('main-btn');err.classList.add('hidden');utils.loading(btn,true);try{await api.withdrawMain({amount:parseFloat(f.amount.value),wallet_address:f.wallet.value});utils.toast('Main withdraw submitted!','success');App.navigate('/history');}catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}utils.loading(btn,false);};
    document.getElementById('profit-wd-form').onsubmit=async(e)=>{e.preventDefault();const f=e.target,err=document.getElementById('profit-err'),btn=document.getElementById('profit-btn');err.classList.add('hidden');utils.loading(btn,true);try{await api.withdrawProfit({amount:parseFloat(f.amount.value),wallet_address:f.wallet.value});utils.toast('Profit withdraw submitted!','success');App.navigate('/history');}catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}utils.loading(btn,false);};
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
Pages._mfee=function(inp,feePct,isLocked){const v=parseFloat(inp.value)||0,fee=isLocked?parseFloat((v*feePct/100).toFixed(2)):0;const el=document.getElementById('main-fee-info');if(el&&v>0)el.innerHTML=`Fee: <strong class="${fee>0?'text-orange-500':'text-green-500'}">${fee>0?`${feePct}%=$${fee.toFixed(2)}`:'$0'}</strong> · Receive: <strong>$${(v-fee).toFixed(2)}</strong>`;};
