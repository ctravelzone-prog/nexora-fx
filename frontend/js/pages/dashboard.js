// pages/dashboard.js — clean rewrite
Pages.dashboard=async function(){
  document.getElementById('app').innerHTML='<div class="with-sidebar"><div class="page-header"><div class="spinner page-loader"></div></div></div>';
  try{
    var me=await api.getMe();
    var copies=await api.getMyCopies().catch(function(){return[];});
    var pending=(await api.getTransactions({limit:100}).catch(function(){return[];})).filter(function(x){return x.status==='pending';});
    App.state.user=me.user;App.state.balance=me.balance;
    var b=me.balance,u=me.user;
    var total=b.main_cents+b.copy_cents+b.profit_cents;
    var dailyPnl=copies.reduce(function(a,c){return a+c.daily_pnl_cents;},0);
    var kycEnabled=(App.state.settings&&App.state.settings.kyc_enabled==='1')||u.kyc_requested===1||u.kyc_requested==='1';
    var mPct=total>0?Math.round(b.main_cents/total*100):0;
    var cPct=total>0?Math.round(b.copy_cents/total*100):0;
    Components.layout(
      Pages._db(b,u,dailyPnl,total,mPct,cPct,copies,kycEnabled&&u.kyc_status!=='approved',pending),
      'Dashboard','Here is your account overview for today.'
    );
    setTimeout(function(){if(Pages._loadTvChart)Pages._loadTvChart();},150);
  }catch(e){document.getElementById('app').innerHTML='<p style="padding:32px;color:var(--red)">'+e.message+'</p>';}
};
