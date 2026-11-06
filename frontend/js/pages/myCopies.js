/*
 * pages/myCopies.js — My Copies page (active copy trades).
 * Shows the user's active copies with Main Balance, Copy Invested
 * and Total Value at the top, plus Increase / Decrease / Stop Copy
 * actions for each copy.
 * Key functions:
 * - Pages.myCopies() renders the page (GET /api/user/me and
 *   api.getMyCopies()).
 * - Pages._adjCopy() / Pages._doAdj() open and submit the
 *   Increase / Decrease Balance dialog.
 * - Pages._stopCopyDlg() / Pages._doStop() confirm and submit
 *   Stop Copy, which settles the copy's funds back to Main.
 * Rules / gotchas:
 * - Profit applies ONLY to Copy Invested, never to Main Balance.
 * - Withdraw is from Main Balance only; stop a copy first to
 *   move its money back to Main.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Balances come from GET /api/user/me; showcase accounts
 *   (is_showcase=1) show DISPLAY balances set by the admin.
 * - The ?v= cache version in script tags must be bumped on every
 *   release or browsers may serve stale code.
 */
// Renders the My Copies page: balance summary cards plus one card
// per active copy (copied amount, profit, daily PnL, action buttons).
// APIs: api.getMe() for balances, api.getMyCopies() for the copies.
Pages.myCopies=async function(){
  try{
    const [me,copies]=await Promise.all([api.getMe(),api.getMyCopies()]);
    const b=me.balance;
    Components.layout(`
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="card"><div class="text-xs text-gray-400 uppercase mb-1">Main Balance</div><div class="text-xl font-bold">${utils.fmtMoney(b.main_cents)}</div></div>
        <div class="card"><div class="text-xs text-gray-400 uppercase mb-1">Copy Invested</div><div class="text-xl font-bold text-orange-500">${utils.fmtMoney(b.copy_cents)}</div></div>
        <div class="card"><div class="text-xs text-gray-400 uppercase mb-1">Total Value</div><div class="text-xl font-bold">${utils.fmtMoney(b.main_cents+b.copy_cents+b.profit_cents)}</div></div>
      </div>
      <div class="alert-success mb-4 text-sm">Rule: profit applies <strong>only</strong> to Copy Invested. Withdraw is from Main only — stop a copy to move money back first.</div>
      <div class="grid gap-4">${copies.map(c=>`<div class="card"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-3">${utils.avatar(c.trader_name||'T',c.trader_avatar,44)}<div><div class="font-bold">${c.trader_name||'Trader'}</div><div class="text-xs text-gray-400">${c.strategy||''}</div></div></div><span class="pill pill-green text-xs">● ACTIVE</span></div><div class="grid grid-cols-3 gap-4 py-3 border-t border-gray-100 text-sm mb-3"><div><div class="text-xs text-gray-400 uppercase">Copied</div><div class="font-bold text-lg">${utils.fmtMoney(c.amount_cents)}</div></div><div><div class="text-xs text-gray-400 uppercase">Profit</div><div class="font-bold text-lg profit">${c.profit_cents>=0?'+':''}${utils.fmtMoney(c.profit_cents)}</div></div><div><div class="text-xs text-gray-400 uppercase">Daily PnL</div><div class="font-bold text-lg profit">${c.daily_pnl_cents>=0?'+':''}${utils.fmtMoney(c.daily_pnl_cents)}</div></div></div><div class="flex flex-col sm:flex-row gap-2 copy-btn-row"><button onclick="Pages._adjCopy(${c.id},'inc','${c.trader_name}')" class="btn-primary flex-1 text-sm" style="padding:10px">+ Increase Balance</button><button onclick="Pages._adjCopy(${c.id},'dec','${c.trader_name}')" class="btn-secondary flex-1 text-sm" style="padding:10px">− Decrease Balance</button><button onclick="Pages._stopCopyDlg(${c.id},'${c.trader_name}',${c.amount_cents},${c.profit_cents})" class="btn-danger flex-1 text-sm" style="padding:10px">Stop Copy</button></div></div>`).join('')}
      ${copies.length===0?'<div class="card text-center py-12 text-gray-400"><p class="text-lg mb-3">No active copies</p><button onclick="App.navigate(\'/copy-trade\')" class="btn-primary" style="width:auto;padding:10px 24px">Start Copying</button></div>':''}
      </div>
      <button onclick="App.navigate('/copy-trade')" class="w-full mt-4 py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-orange-300 hover:text-orange-500 font-semibold transition-colors">+ Copy another trader</button>
    `,'My Copies · Active Copies','');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Opens the Increase / Decrease Balance dialog for one copy.
// `action` is 'inc' or 'dec'; `name` is the trader's display name.
Pages._adjCopy=function(id,action,name){
  utils.showModal(`<div class="modal"><h2 class="text-lg font-bold mb-3">${action==='inc'?'Increase':'Decrease'} Copy — ${name}</h2><label class="input-label">Amount (USD)</label><input id="adj-amt" type="number" step="0.01" min="0.01" class="input-field mb-3"><div id="adj-err" class="alert-danger hidden mb-3"></div><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button id="adj-ok" onclick="Pages._doAdj(${id},'${action}')" class="btn-primary flex-1">Confirm</button></div></div>`);
};
// Submits the Increase / Decrease request from the dialog.
// APIs: api.increaseCopy() or api.decreaseCopy(). Reloads the page on success.
Pages._doAdj=async function(id,action){
  const btn=document.getElementById('adj-ok'),err=document.getElementById('adj-err');
  const amt=parseFloat(document.getElementById('adj-amt').value);
  if(!amt||amt<=0){err.textContent='Enter valid amount';err.classList.remove('hidden');return;}
  utils.loading(btn,true);
  try{if(action==='inc')await api.increaseCopy({copy_id:id,amount:amt});else await api.decreaseCopy({copy_id:id,amount:amt});utils.closeModal();utils.toast('Updated!','success');Pages.myCopies();}
  catch(e){err.textContent=e.message;err.classList.remove('hidden');utils.loading(btn,false);}
};
// Opens the Stop Copy confirmation dialog, showing principal and
// profit up to yesterday. Today's Daily PnL is $0.00 at this point.
Pages._stopCopyDlg=function(id,name,principal,profit){
  utils.showModal(`<div class="modal"><h2 class="text-lg font-bold mb-3">Stop Copy — ${name}?</h2><div class="card bg-gray-50 mb-4"><div class="text-sm">Principal: <strong>${utils.fmtMoney(principal)}</strong></div><div class="text-sm">Profit (up to yesterday): <strong class="text-green-500">${utils.fmtMoney(profit)}</strong></div><div class="text-sm text-gray-400">Today's Daily PnL: $0.00</div></div><p class="text-sm text-gray-500 mb-4">Stopping moves all funds back to Main Balance. Today's PnL is $0.00.</p><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button id="stop-ok" onclick="Pages._doStop(${id})" class="btn-danger flex-1">Stop Copy</button></div></div>`);
};
// Submits Stop Copy. API: api.stopCopy(). Funds return to Main Balance.
Pages._doStop=async function(id){
  utils.loading(document.getElementById('stop-ok'),true);
  try{await api.stopCopy({copy_id:id});utils.closeModal();utils.toast('Copy stopped. Funds returned to Main.','success');Pages.myCopies();}
  catch(e){utils.toast(e.message,'error');}
};
