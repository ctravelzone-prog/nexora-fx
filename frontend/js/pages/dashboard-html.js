/*
 * dashboard-html.js — Dashboard HTML, part 1 (Nexora FX).
 *
 * Builds the top half of the dashboard markup: the KYC banner, the
 * welcome row, the pending-approval strip, the Total Value band with
 * Daily PnL, and the Balance Breakdown (Main + Copy = Total).
 *
 * Key function:
 * - Pages._db(b, u, dailyPnl, total, mPct, cPct, copies, kycNeeded,
 *   pending) — returns the HTML string; the second half comes from
 *   Pages._db2 in dashboard-html2.js.
 *
 * Rules: money is integer cents; display via utils.fmtMoney. Balances
 * come from GET /api/user/me. Daily PnL is earned on Copy Invested only;
 * withdrawal is from Main Balance only. Showcase accounts
 * (is_showcase=1) show DISPLAY balances set by the admin.
 * Gotcha: the ?v= cache version in script tags must be bumped on every
 * release, or browsers may serve stale code.
 * Note: this file uses CRLF line endings — preserve them on every edit.
 */
// Dashboard HTML, part 1: KYC banner, welcome row, pending strip,
// Total Value band and Balance Breakdown. See the header for details.
Pages._db=function(b,u,dailyPnl,total,mPct,cPct,copies,kycNeeded,pending){
  var f=utils.fmtMoney, html='';
  if(kycNeeded) html+='<div class="kyc-banner"><div class="kb-icon"><svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z"/></svg></div><div class="kb-body" style="flex:1"><h4>KYC Not Verified — action needed</h4><p>Complete KYC to unlock withdrawals.</p></div><button class="btn-kyc" onclick="App.navigate(\'/kyc\')">Complete KYC →</button></div>';
  html+='<div class="dash-welcome">'+utils.avatar(u.full_name||'',u.profile_photo,46)+'<div class="wc-text"><b>Welcome, '+u.username+'</b><span style="color:var(--muted);font-size:13px">Here is your account overview for today.</span></div><div class="head-actions"><button class="head-btn">⭐ Promotion</button><button class="head-btn">📰 News</button></div></div>';
  if(pending&&pending.length) html+='<div class="card" style="padding:14px 16px;margin-bottom:16px;border:1px solid #FED7AA;background:#FFFBEB"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:16px">\u23f3</span><b style="font-size:14px">Pending Approval</b><span style="font-size:12px;color:var(--muted)">'+pending.length+' request'+(pending.length>1?'s':'')+' awaiting approval</span><button onclick="App.navigate(\'/history\')" style="margin-left:auto;background:none;border:none;color:#EA580C;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit">View History \u2192</button></div>'+pending.map(function(x){return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;padding-top:8px"><span>'+(x.type==='deposit'?'\u2193 Deposit':(x.type||'').indexOf('withdraw')===0?'\u2191 Withdraw':(x.type||'').replace(/_/g,' '))+' \u00b7 '+utils.fmtDate(x.created_at)+'</span><span style="font-weight:800;color:'+(x.direction==='in'?'var(--green-d)':'var(--red)')+'">'+(x.direction==='in'?'+':'-')+utils.fmtMoney(x.amount_cents)+'</span></div>';}).join('')+'</div>';
  html+='<div class="value-band"><div class="vb-top"><div class="vb-main"><div class="vb-total"><small>TOTAL VALUE</small><div class="amt">'+f(total)+'<span class="unit"> USD</span></div></div>';
  html+='<div class="daily-pnl'+(dailyPnl<0?' neg':'')+'" style="margin-top:10px"><span>+Daily PnL</span> <span>'+(dailyPnl>=0?'+':'')+f(dailyPnl)+'</span><span class="dp-date"> · Today</span></div></div>';
  html+='<div class="vb-actions"><button class="vb-btn vb-btn-w" onclick="App.navigate(\'/withdraw\')">↑ Withdraw<small style="display:block;font-size:10px;opacity:.7;margin-top:2px">Bep20 USDT</small></button><button class="vb-btn vb-btn-d" onclick="App.navigate(\'/deposit\')">↓ Deposit<small style="display:block;font-size:10px;opacity:.8;margin-top:2px">Binance Pay · USDT</small></button></div></div>';
  html+='<div class="vb-divider"></div><div class="vb-stats"><div class="vb-stat"><small>MAIN BALANCE · AVAILABLE</small><span class="vb-amt">'+f(b.main_cents)+'</span><span class="vb-sub">Withdraw from here only</span></div><div class="vb-stat"><small>COPY INVESTED</small><span class="vb-amt orange">'+f(b.copy_cents)+'</span><span class="vb-sub">Profit on this only</span></div><div class="vb-stat"><small>TOTAL PNL</small><span class="vb-amt '+(b.profit_cents>=0?'green':'')+'">'+f(b.profit_cents)+'</span></div></div>';
  html+='<p class="vb-note">Daily PnL only on <b>'+f(b.copy_cents)+' Copy Invested</b>. <button onclick="App.navigate(\'/copy-trade\')" style="background:none;border:none;color:#FF9A40;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px">Start Copy Trading →</button></p></div>';
  html+='<div class="card" style="padding:20px;margin-bottom:16px"><h3 style="font-size:15px;font-weight:800;color:var(--ink);margin-bottom:10px">Balance Breakdown</h3>';
  html+='<div class="bb-eq"><span class="eq-chip">Main <b>'+f(b.main_cents)+'</b></span><span class="eq-arrow">+</span><span class="eq-chip">Copy <b>'+f(b.copy_cents)+'</b></span><span class="eq-arrow">=</span><span class="eq-chip" style="background:var(--dark2);color:#fff;border-color:var(--dark2)">Total <b>'+f(total)+'</b></span></div>';
  html+='<div class="alloc" style="margin-top:14px"><div class="alloc-bar"><span class="a-main" style="width:'+mPct+'%"></span><span class="a-copy" style="width:'+cPct+'%"></span></div><div class="alloc-legend"><span><b>Main</b> '+f(b.main_cents)+' · '+mPct+'%</span><span><b>Copy</b> '+f(b.copy_cents)+' · '+cPct+'%</span></div></div>';
  html+='</div>';
  return html+Pages._db2(b,u,copies,f);
};
