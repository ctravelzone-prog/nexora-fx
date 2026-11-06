/*
 * dashboard.js — Dashboard page for Nexora FX.
 *
 * Loads the user's balances and copies, then renders the dashboard
 * through Pages._db (dashboard-html.js) and starts the live chart.
 *
 * Key function:
 * - Pages.dashboard — GET /api/user/me for balances, api.getMyCopies
 *   for copies, api.getTransactions for pending requests; renders the
 *   dashboard and loads the TradingView chart after a short delay.
 *
 * Rules: money is integer cents; display via utils.fmtMoney. Total
 * Value is Main + Copy + Profit. Daily PnL is the sum of each copy's
 * daily PnL (profit is earned on Copy Invested only). Showcase
 * accounts (is_showcase=1) show DISPLAY balances set by the admin.
 * Gotcha: the ?v= cache version in script tags must be bumped on every
 * release, or browsers may serve stale code.
 */
// Dashboard page. Loads balances, copies and pending requests, then
// renders the dashboard and starts the live TradingView chart.
Pages.dashboard=async function(){
  document.getElementById('app').innerHTML='<div class="with-sidebar"><div class="page-header"><div class="spinner page-loader"></div></div></div>';
  try{
    var me=await api.getMe();
    var copies=await api.getMyCopies().catch(function(){return[];});
    // Pending deposit/withdraw requests, shown in the approval strip.
    var pending=(await api.getTransactions({limit:100}).catch(function(){return[];})).filter(function(x){return x.status==='pending';});
    App.state.user=me.user;App.state.balance=me.balance;
    var b=me.balance,u=me.user;
    // Total Value is Main + Copy + Profit (all integer cents).
    var total=b.main_cents+b.copy_cents+b.profit_cents;
    var dailyPnl=copies.reduce(function(a,c){return a+c.daily_pnl_cents;},0);
    // KYC is on when the admin enabled it, or this user was asked for it.
    var kycEnabled=(App.state.settings&&App.state.settings.kyc_enabled==='1')||u.kyc_requested===1||u.kyc_requested==='1';
    var mPct=total>0?Math.round(b.main_cents/total*100):0;
    var cPct=total>0?Math.round(b.copy_cents/total*100):0;
    Components.layout(
      Pages._db(b,u,dailyPnl,total,mPct,cPct,copies,kycEnabled&&u.kyc_status!=='approved',pending),
      'Dashboard','Here is your account overview for today.'
    );
    // Load the chart after render, so its container exists first.
    setTimeout(function(){if(Pages._loadTvChart)Pages._loadTvChart();},150);
  }catch(e){document.getElementById('app').innerHTML='<p style="padding:32px;color:var(--red)">'+e.message+'</p>';}
};
