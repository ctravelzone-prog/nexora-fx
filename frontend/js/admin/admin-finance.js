/*
 * admin-finance.js — Deposits and Withdrawals review pages.
 *
 * Renders the /admin/deposits list (Binance Pay deposits with TxID) and the
 * /admin/withdrawals list (USDT BEP20 payouts with wallet address, fee and
 * net amount), with Approve / Reject actions for pending items.
 * Key functions: AdminPages.deposits, AdminPages._approveDep,
 * AdminPages._rejectDep, AdminPages.withdrawals, AdminPages._processWd.
 *
 * Gotchas:
 * - A deposit only credits Main Balance after admin approval; until then it
 *   shows as Pending in the user's History.
 * - Withdrawals come from Main Balance only. Profit withdrawals need a
 *   $10 minimum and carry no fee or lock deduction.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/deposits: Binance Pay deposits (TxID, amount, status).
  // Fetches up to 50 rows via adminApi.getDeposits.
AdminPages.deposits=async function(){
  try{
    const _gen=AdminApp._gen;
    const [deps,att]=await Promise.all([adminApi.getDeposits({limit:50}),adminApi.getPaymentAttempts({limit:50}).catch(()=>({attempts:[]}))]);if(_gen!==AdminApp._gen)return;
    const attempts=att.attempts||[];
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Deposits</h2>
    ${attempts.length?`<div class="card mb-4" style="border-color:#F59E0B"><h3 class="font-bold mb-1">Needs review (${attempts.length})</h3><p class="text-xs text-gray-400 mb-3">Auto-verify failed for these payments — the money is not lost. Check the reason and the real on-chain detail, then approve or reject the matching deposit below.</p>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>User</th><th>Method</th><th>Reference</th><th>Reason</th><th>Expected</th><th>On-chain detail</th><th>Date</th><th></th></tr></thead><tbody>
      ${attempts.map(a=>{let det=null;try{det=a.detail?JSON.parse(a.detail):null;}catch(_){}
        return `<tr><td data-label="User">${a.full_name}<br><small class="text-gray-400">@${a.username}</small></td><td data-label="Method">${a.method==='bep20'?'BEP20':'Binance Pay'}</td><td data-label="Reference" class="text-xs max-w-xs truncate">${a.tx_ref||'—'}</td><td data-label="Reason"><span class="badge badge-gray">${a.reason}</span></td><td data-label="Expected" class="font-bold">${a.expected_amount_cents!=null?utils.fmtMoney(a.expected_amount_cents):'—'}</td><td data-label="Detail" class="text-xs">${det?`from ${String(det.from||'').slice(0,10)}… · to ${String(det.to||'').slice(0,10)}… · $${det.amountUsdt||'?'}`:'—'}</td><td data-label="Date" class="text-xs">${utils.fmtDate(a.created_at)}</td><td data-label=""><button onclick="AdminPages._reviewAttempt(${a.id})" class="btn-secondary text-xs" style="width:auto;padding:5px 10px;white-space:nowrap">Dismiss</button></td></tr>`;}).join('')}
    </tbody></table></div></div>`:''}
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>ID</th><th>User</th><th>Amount</th><th>TxID</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
      ${deps.map(d=>`<tr><td data-label="ID">#${d.id}</td><td data-label="User"><div>${d.full_name}${d.is_showcase?` <span style="background:#FEF3C7;color:#92400E;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px">SHOWCASE</span>`:''}<br><small class="text-gray-400">@${d.username}</small></div></td><td data-label="Amount" class="font-bold">${utils.fmtMoney(d.amount_cents)}</td><td data-label="TxID" class="text-xs max-w-xs truncate">${d.txid||'—'}${d.auto?` <span style="background:#DCFCE7;color:#166534;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px">AUTO</span>`:''}</td><td data-label="Status">${utils.statusBadge(d.status)}</td><td data-label="Date" class="text-xs">${utils.fmtDate(d.created_at)}</td><td data-label="Actions">${d.status==='pending'?`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button onclick="AdminPages._approveDep(${d.id},${d.is_showcase?1:0})" class="btn-primary text-xs" style="width:auto;padding:5px 10px;white-space:nowrap">Approve</button><button onclick="AdminPages._rejectDep(${d.id},${d.is_showcase?1:0})" class="btn-danger text-xs" style="width:auto;padding:5px 10px;white-space:nowrap">Reject</button></div>`:'—'}</td></tr>`).join('')}
      ${deps.length===0?'<tr><td colspan="7" class="text-center py-8 text-gray-400">No deposits</td></tr>':''}
    </tbody></table></div>`,'Deposits');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Dismiss a payment attempt (mark it reviewed) and refresh the page.
AdminPages._reviewAttempt=function(id){
  adminApi.reviewPaymentAttempt(id).then(()=>{utils.toast('Reviewed','success');AdminPages.deposits();}).catch(e=>utils.toast(e.message,'error'));
};
// Confirms, then approves a pending deposit via adminApi.approveDeposit.
  // Approval credits the user's Main Balance.
AdminPages._approveDep=function(id,isSc){
  utils.confirm(`Approve deposit #${id}?`,async()=>{
    try{await adminApi.approveDeposit(id,isSc===1);utils.toast('Deposit approved!','success');AdminPages.deposits();}
    catch(e){utils.toast(e.message,'error');}
  },'Approve');
};
// Opens a modal to reject a deposit with an optional admin note.
AdminPages._rejectDep=function(id,isSc){
  utils.showModal(`<div class="modal"><h2 class="font-bold mb-3">Reject Deposit #${id}</h2><label class="input-label">Admin Note</label><input id="rej-n" type="text" class="input-field mb-3" placeholder="Reason (optional)"><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="adminApi.rejectDeposit(${id},{note:document.getElementById('rej-n').value,is_showcase:${isSc}===1}).then(()=>{utils.closeModal();utils.toast('Rejected','success');AdminPages.deposits();}).catch(e=>utils.toast(e.message,'error'))" class="btn-danger flex-1">Reject</button></div></div>`);
};

// Renders /admin/withdrawals: USDT BEP20 payouts with wallet address,
  // fee and net amount. Fetches up to 50 rows via adminApi.getWithdrawals.
AdminPages.withdrawals=async function(){
  try{
    const _gen=AdminApp._gen;
    const wds=await adminApi.getWithdrawals({limit:50});if(_gen!==AdminApp._gen)return;
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Withdrawals</h2>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>ID</th><th>User</th><th>Type</th><th>Amount</th><th>Fee</th><th>Net</th><th>Wallet (BEP20)</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
      ${wds.map(w=>`<tr><td data-label="ID">#${w.id}</td><td data-label="User">${w.full_name}${w.is_showcase?` <span style="background:#FEF3C7;color:#92400E;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px">SHOWCASE</span>`:''}</td><td data-label="Type"><span class="badge ${w.type==='profit'?'badge-green':'badge-gray'}">${w.type}</span></td><td data-label="Amount">${utils.fmtMoney(w.amount_cents)}</td><td data-label="Fee" class="text-orange-500">${utils.fmtMoney(w.fee_cents)}</td><td data-label="Net" class="profit font-bold">${utils.fmtMoney(w.net_cents)}</td><td data-label="Wallet"><div style="display:flex;align-items:center;gap:6px;max-width:220px"><code style="font-size:11px;word-break:break-all;color:#334155">${w.wallet_address||'—'}</code>${w.wallet_address?`<button onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent).then(()=>utils.toast('Address copied','success'))" class="btn-secondary text-xs" style="width:auto;padding:3px 8px;flex-shrink:0">Copy</button>`:''}</div>${w.tx_hash?`<div class="text-xs text-gray-400 mt-1">Tx: <code style="font-size:11px;word-break:break-all">${w.tx_hash}</code></div>`:''}</td><td data-label="Status">${utils.statusBadge(w.status)}${w.auto?` <span style="background:#DCFCE7;color:#166534;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px">AUTO</span>`:''}${w.status==='pending'&&w.fail_reason?`<div class="text-xs text-orange-500 mt-1">auto: ${w.fail_reason}</div>`:''}</td><td data-label="Date" class="text-xs">${utils.fmtDate(w.created_at)}</td><td data-label="Actions">${w.status==='pending'?`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button onclick="AdminPages._processWd(${w.id},'approve',${w.is_showcase?1:0})" class="btn-primary text-xs" style="width:auto;padding:5px 10px;white-space:nowrap">Approve</button><button onclick="AdminPages._processWd(${w.id},'reject',${w.is_showcase?1:0})" class="btn-danger text-xs" style="width:auto;padding:5px 10px;white-space:nowrap">Reject</button></div>`:'—'}</td></tr>`).join('')}
      ${wds.length===0?'<tr><td colspan="10" class="text-center py-8 text-gray-400">No withdrawals</td></tr>':''}
    </tbody></table></div>`,'Withdrawals');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Confirms, then approves or rejects a pending withdrawal via
  // adminApi.processWithdrawal.
AdminPages._processWd=function(id,action,isSc){
  utils.confirm(`${action==='approve'?'Approve':'Reject'} withdrawal #${id}?`,async()=>{
    try{await adminApi.processWithdrawal(id,{action,is_showcase:isSc===1});utils.toast(`${action==='approve'?'Approved':'Rejected'}!`,'success');AdminPages.withdrawals();}
    catch(e){utils.toast(e.message,'error');}
  },action==='approve'?'Approve':'Reject');
};
