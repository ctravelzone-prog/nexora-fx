// admin-finance2.js — Transactions + Referrals
AdminPages.transactions=async function(){
  try{
    const d=await adminApi.getTransactions({limit:100});
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-3">Transactions Ledger</h2>
    <div class="grid grid-cols-4 gap-4 mb-4">${[['Total In',utils.fmtMoney(d.totals.in),'profit'],['Total Out',utils.fmtMoney(d.totals.out),'loss'],['Fees',utils.fmtMoney(d.totals.fees),'text-orange-500'],['Net',utils.fmtMoney(d.totals.net),'font-bold']].map(([l,v,c])=>`<div class="card"><div class="text-xs text-gray-400 uppercase mb-1">${l}</div><div class="text-lg font-bold ${c}">${v}</div></div>`).join('')}</div>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>ID</th><th>User</th><th>Type</th><th>Dir</th><th>Amount</th><th>Fee</th><th>Net</th><th>Status</th><th>Reason</th><th>Date</th></tr></thead><tbody>
      ${d.transactions.map(t=>`<tr><td>#${t.id}</td><td>${t.username}</td><td class="capitalize text-xs">${t.type.replace(/_/g,' ')}</td><td><span class="${t.direction==='in'?'profit':'loss'} font-bold">${t.direction}</span></td><td>${utils.fmtMoney(t.amount_cents)}</td><td>${utils.fmtMoney(t.fee_cents)}</td><td>${utils.fmtMoney(t.net_cents)}</td><td>${utils.statusBadge(t.status)}</td><td class="text-xs text-gray-400 max-w-xs truncate">${t.reason||'—'}</td><td class="text-xs">${utils.fmtDate(t.created_at)}</td></tr>`).join('')}
      ${d.transactions.length===0?'<tr><td colspan="10" class="text-center py-8 text-gray-400">No transactions</td></tr>':''}
    </tbody></table></div>`,'Transactions Ledger');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};

AdminPages.referrals=async function(){
  try{
    const refs=await adminApi.getReferrals();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Referrals</h2>
    <p class="text-sm text-gray-400 mb-4">One-time 4% of deposit commission — paid once per referred user's first deposit.</p>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Referrer</th><th>Referred User</th><th>Deposit</th><th>Commission (4%)</th><th>Status</th><th>Date</th></tr></thead><tbody>
      ${refs.map(r=>`<tr><td>${r.referrer_name} (@${r.referrer_username})</td><td>${r.referred_name} (@${r.referred_username})</td><td>${utils.fmtMoney(r.deposit_amount_cents)}</td><td class="profit font-bold">${utils.fmtMoney(r.commission_cents)}</td><td>${utils.statusBadge(r.status)}</td><td class="text-xs">${utils.fmtDate(r.created_at)}</td></tr>`).join('')}
      ${refs.length===0?'<tr><td colspan="6" class="text-center py-8 text-gray-400">No referrals yet</td></tr>':''}
    </tbody></table></div>`,'Referrals');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
