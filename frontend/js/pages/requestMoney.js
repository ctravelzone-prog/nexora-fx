/*
 * pages/requestMoney.js — Request Money: user asks the admin for a
 * balance correction (for example a deposit that was not credited).
 * Key functions:
 * - Pages.requestMoney() renders the page (api.getMyMoneyRequests())
 *   and submits new requests (api.requestMoney()).
 * Rules / gotchas:
 * - Only one pending request at a time: while one is pending the form
 *   is disabled and a warning is shown.
 * - An approved request is added to Main Balance by the admin.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Balances come from GET /api/user/me; showcase accounts
 *   (is_showcase=1) show DISPLAY balances set by the admin.
 * - The ?v= cache version in script tags must be bumped on every
 *   release or browsers may serve stale code.
 */
// Renders the Request Money page: new-request form plus the history
// of past requests with their status and any admin note.
// API: api.getMyMoneyRequests().
Pages.requestMoney=async function(){
  try{
    const [reqs,me]=await Promise.all([api.getMyMoneyRequests(),api.getMe()]);
    const rmOff=me.user?.request_money_enabled===0;
// Find the open request, if any. A pending request blocks a new one.
    const pending=reqs.find(r=>r.status==='pending');
    Components.layout(`<div class="max-w-2xl">
      <h1 class="text-xl font-bold mb-1">Request Money</h1>
      <p class="text-sm text-gray-400 mb-6">If a deposit was not credited or your balance looks wrong, request a correction. Nexora FX reviews it and adds the amount to your Main Balance when approved.</p>
      ${pending?`<div class="alert-warning mb-4 text-sm">You have a pending request for <strong>${utils.fmtMoney(pending.amount_cents)}</strong>. Please wait for Nexora FX review before sending another.</div>`:''}
      ${rmOff?'<div class="alert-warning mb-4 text-sm">Request Money is disabled for your account. Please contact support.</div>':''}
      <div class="card mb-6">
        <h2 class="font-bold mb-4">New Request</h2>
        <form id="mr-form" class="space-y-3">
          <div><label class="input-label">Amount (USD)</label><input name="amount" type="number" step="0.01" min="0.01" class="input-field" placeholder="0.00" ${(pending||rmOff)?'disabled':''} required></div>
          <div><label class="input-label">Reason</label><textarea name="reason" class="input-field" rows="3" placeholder="e.g. I deposited $50 via Binance Pay, TxID ... but it is not showing in my balance." ${(pending||rmOff)?'disabled':''}></textarea></div>
          <div id="mr-err" class="alert-danger hidden"></div>
          <button type="submit" id="mr-btn" class="btn-primary" ${(pending||rmOff)?'disabled':''}>Send Request</button>
        </form>
      </div>
      <div class="card">
        <h2 class="font-bold mb-4">My Requests</h2>
        ${reqs.length?reqs.map(r=>`<div class="flex items-start justify-between gap-3 py-3 border-b last:border-0">
          <div class="min-w-0"><div class="font-bold">${utils.fmtMoney(r.amount_cents)}</div>
          <div class="text-sm text-gray-500 break-words">${r.reason||'—'}</div>
          ${r.admin_note?`<div class="text-sm text-red-500 mt-1">Nexora FX note: ${r.admin_note}</div>`:''}
          <div class="text-xs text-gray-400 mt-1">${utils.fmtDateTime(r.created_at)}</div></div>
          <span class="${utils.statusBadge(r.status)}">${r.status}</span>
        </div>`).join(''):'<p class="text-sm text-gray-400">No requests yet.</p>'}
      </div>
    </div>`,'Request Money','');
// New-request form submit. API: api.requestMoney(). Reloads the page
// on success so the new request appears in the history below.
    if(!rmOff) document.getElementById('mr-form').onsubmit=async(e)=>{e.preventDefault();const f=e.target,err=document.getElementById('mr-err'),btn=document.getElementById('mr-btn');err.classList.add('hidden');utils.loading(btn,true);try{await api.requestMoney({amount:parseFloat(f.amount.value),reason:f.reason.value});utils.toast('Request sent to Nexora FX!','success');Pages.requestMoney();}catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}utils.loading(btn,false);};
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
