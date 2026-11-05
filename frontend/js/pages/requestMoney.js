// pages/requestMoney.js — user requests a balance correction from admin
Pages.requestMoney=async function(){
  try{
    const reqs=await api.getMyMoneyRequests();
    const pending=reqs.find(r=>r.status==='pending');
    Components.layout(`<div class="max-w-2xl">
      <h1 class="text-xl font-bold mb-1">Request Money</h1>
      <p class="text-sm text-gray-400 mb-6">If a deposit was not credited or your balance looks wrong, request a correction. Admin reviews it and adds the amount to your Main Balance when approved.</p>
      ${pending?`<div class="alert-warning mb-4 text-sm">You have a pending request for <strong>${utils.fmtMoney(pending.amount_cents)}</strong>. Please wait for admin review before sending another.</div>`:''}
      <div class="card mb-6">
        <h2 class="font-bold mb-4">New Request</h2>
        <form id="mr-form" class="space-y-3">
          <div><label class="input-label">Amount (USD)</label><input name="amount" type="number" step="0.01" min="0.01" class="input-field" placeholder="0.00" ${pending?'disabled':''} required></div>
          <div><label class="input-label">Reason</label><textarea name="reason" class="input-field" rows="3" placeholder="e.g. I deposited $50 via Binance Pay, TxID ... but it is not showing in my balance." ${pending?'disabled':''}></textarea></div>
          <div id="mr-err" class="alert-danger hidden"></div>
          <button type="submit" id="mr-btn" class="btn-primary" ${pending?'disabled':''}>Send Request</button>
        </form>
      </div>
      <div class="card">
        <h2 class="font-bold mb-4">My Requests</h2>
        ${reqs.length?reqs.map(r=>`<div class="flex items-start justify-between gap-3 py-3 border-b last:border-0">
          <div class="min-w-0"><div class="font-bold">${utils.fmtMoney(r.amount_cents)}</div>
          <div class="text-sm text-gray-500 break-words">${r.reason||'—'}</div>
          ${r.admin_note?`<div class="text-sm text-red-500 mt-1">Admin note: ${r.admin_note}</div>`:''}
          <div class="text-xs text-gray-400 mt-1">${utils.fmtDateTime(r.created_at)}</div></div>
          <span class="${utils.statusBadge(r.status)}">${r.status}</span>
        </div>`).join(''):'<p class="text-sm text-gray-400">No requests yet.</p>'}
      </div>
    </div>`,'Request Money','');
    document.getElementById('mr-form').onsubmit=async(e)=>{e.preventDefault();const f=e.target,err=document.getElementById('mr-err'),btn=document.getElementById('mr-btn');err.classList.add('hidden');utils.loading(btn,true);try{await api.requestMoney({amount:parseFloat(f.amount.value),reason:f.reason.value});utils.toast('Request sent to admin!','success');Pages.requestMoney();}catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}utils.loading(btn,false);};
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
