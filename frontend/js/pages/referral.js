/*
 * pages/referral.js — Referred Users, Referral Commissions, Friends.
 * Three related referral pages: who the user referred, the commissions
 * earned from them, and a simple friends list.
 * Key functions:
 * - Pages.referredUsers() — referred users table + referral link
 *   (api.getReferredUsers(), api.getReferralLink()).
 * - Pages.referralCommissions() — commission history and total
 *   (api.getReferralCommissions()).
 * - Pages.friends() — referred friends list (api.getFriends()).
 * Rules / gotchas:
 * - Referral commission is a one-time 4% of each referred user's
 *   first deposit only, never on profit and never recurring.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Balances come from GET /api/user/me; showcase accounts
 *   (is_showcase=1) show DISPLAY balances set by the admin.
 * - The ?v= cache version in script tags must be bumped on every
 *   release or browsers may serve stale code.
 */
// Renders the Referred Users page: referral link card plus a table of
// referred users (name, username, joined date, deposit, commission, status).
Pages.referredUsers=async function(){
  try{
    const [users,link]=await Promise.all([api.getReferredUsers(),api.getReferralLink()]);
    Components.layout(`
      <div class="card mb-6"><h3 class="font-bold mb-2">Your Referral Link</h3>
        <div class="flex gap-2"><input type="text" value="${link.link}" readonly class="input-field flex-1 text-sm bg-gray-50">
        <button onclick="navigator.clipboard.writeText('${link.link}');utils.toast('Copied!','success')" class="btn-primary text-sm" style="width:auto;padding:10px 16px">Copy Link</button></div>
        <p class="text-xs text-gray-400 mt-2">Your code: <strong>${link.code}</strong> · Share to earn 4% of each referred user's first deposit (one-time).</p>
      </div>
      <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Name</th><th>Username</th><th>Joined</th><th>Deposit</th><th>Commission</th><th>Status</th></tr></thead><tbody>
        ${users.map(u=>`<tr><td>${u.full_name}</td><td>@${u.username}</td><td>${utils.fmtDate(u.created_at)}</td><td>${utils.fmtMoney(u.deposit_amount_cents)}</td><td class="profit">${utils.fmtMoney(u.commission_cents)}</td><td>${utils.statusBadge(u.status)}</td></tr>`).join('')}
        ${users.length===0?'<tr><td colspan="6" class="text-center py-8 text-gray-400">No referred users yet</td></tr>':''}
      </tbody></table></div>
    `,'Referred Users','Friends you referred');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Renders the Referral Commissions page: total earned plus one row per
// commission (referred user, deposit, 4% commission, status, date).
Pages.referralCommissions=async function(){
  try{
    const data=await api.getReferralCommissions();
    Components.layout(`
      <div class="card mb-4"><div class="text-xs text-gray-400 uppercase mb-1">Total Commissions Earned</div><div class="text-2xl font-bold text-green-500">${utils.fmtMoney(data.total_cents)}</div></div>
      <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Referred User</th><th>Deposit</th><th>Commission (4%)</th><th>Status</th><th>Date</th></tr></thead><tbody>
        ${data.commissions.map(c=>`<tr><td>${c.full_name} (@${c.username})</td><td>${utils.fmtMoney(c.deposit_amount_cents)}</td><td class="profit font-bold">${utils.fmtMoney(c.commission_cents)}</td><td>${utils.statusBadge(c.status)}</td><td>${utils.fmtDate(c.created_at)}</td></tr>`).join('')}
        ${data.commissions.length===0?'<tr><td colspan="5" class="text-center py-8 text-gray-400">No commissions yet</td></tr>':''}
      </tbody></table></div>
    `,'Referral Commissions','One-time 4% of each referred deposit');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Renders the Friends page: a simple list of people the user referred.
Pages.friends=async function(){
  try{
    const friends=await api.getFriends();
    Components.layout(`
      <div class="grid gap-3">
        ${friends.map(f=>`<div class="card flex items-center gap-3">${utils.avatar(f.full_name,null,40)}<div><div class="font-semibold">${f.full_name}</div><div class="text-xs text-gray-400">@${f.username} · Joined ${utils.fmtDate(f.created_at)}</div></div></div>`).join('')}
        ${friends.length===0?'<div class="card text-center py-12 text-gray-400">No friends referred yet. Share your referral link to earn commissions!</div>':''}
      </div>
    `,'Friends','People you referred');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
