// admin-finance.js — Deposits + Withdrawals
AdminPages.deposits=async function(){
  try{
    const deps=await adminApi.getDeposits({limit:50});
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Deposits</h2>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>ID</th><th>User</th><th>Amount</th><th>TxID</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
      ${deps.map(d=>`<tr><td>#${d.id}</td><td>${d.full_name}<br><small class="text-gray-400">@${d.username}</small></td><td class="font-bold">${utils.fmtMoney(d.amount_cents)}</td><td class="text-xs max-w-xs truncate">${d.txid||'—'}</td><td>${utils.statusBadge(d.status)}</td><td class="text-xs">${utils.fmtDate(d.created_at)}</td><td>${d.status==='pending'?`<button onclick="AdminPages._approveDep(${d.id})" class="btn-primary text-xs mr-1" style="width:auto;padding:5px 10px">Approve</button><button onclick="AdminPages._rejectDep(${d.id})" class="btn-danger text-xs" style="padding:5px 10px">Reject</button>`:'—'}</td></tr>`).join('')}
      ${deps.length===0?'<tr><td colspan="7" class="text-center py-8 text-gray-400">No deposits</td></tr>':''}
    </tbody></table></div>`,'Deposits');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
AdminPages._approveDep=function(id){
  utils.confirm(`Approve deposit #${id}?`,async()=>{
    try{await adminApi.approveDeposit(id);utils.toast('Deposit approved!','success');AdminPages.deposits();}
    catch(e){utils.toast(e.message,'error');}
  },'Approve');
};
AdminPages._rejectDep=function(id){
  utils.showModal(`<div class="modal"><h2 class="font-bold mb-3">Reject Deposit #${id}</h2><label class="input-label">Admin Note</label><input id="rej-n" type="text" class="input-field mb-3" placeholder="Reason (optional)"><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="adminApi.rejectDeposit(${id},{note:document.getElementById('rej-n').value}).then(()=>{utils.closeModal();utils.toast('Rejected','success');AdminPages.deposits();}).catch(e=>utils.toast(e.message,'error'))" class="btn-danger flex-1">Reject</button></div></div>`);
};

AdminPages.withdrawals=async function(){
  try{
    const wds=await adminApi.getWithdrawals({limit:50});
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Withdrawals</h2>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>ID</th><th>User</th><th>Type</th><th>Amount</th><th>Fee</th><th>Net</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
      ${wds.map(w=>`<tr><td>#${w.id}</td><td>${w.full_name}</td><td><span class="badge ${w.type==='profit'?'badge-green':'badge-gray'}">${w.type}</span></td><td>${utils.fmtMoney(w.amount_cents)}</td><td class="text-orange-500">${utils.fmtMoney(w.fee_cents)}</td><td class="profit font-bold">${utils.fmtMoney(w.net_cents)}</td><td>${utils.statusBadge(w.status)}</td><td class="text-xs">${utils.fmtDate(w.created_at)}</td><td>${w.status==='pending'?`<button onclick="AdminPages._processWd(${w.id},'approve')" class="btn-primary text-xs mr-1" style="width:auto;padding:5px 10px">Approve</button><button onclick="AdminPages._processWd(${w.id},'reject')" class="btn-danger text-xs" style="padding:5px 10px">Reject</button>`:'—'}</td></tr>`).join('')}
      ${wds.length===0?'<tr><td colspan="9" class="text-center py-8 text-gray-400">No withdrawals</td></tr>':''}
    </tbody></table></div>`,'Withdrawals');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
AdminPages._processWd=function(id,action){
  utils.confirm(`${action==='approve'?'Approve':'Reject'} withdrawal #${id}?`,async()=>{
    try{await adminApi.processWithdrawal(id,{action});utils.toast(`${action==='approve'?'Approved':'Rejected'}!`,'success');AdminPages.withdrawals();}
    catch(e){utils.toast(e.message,'error');}
  },action==='approve'?'Approve':'Reject');
};
