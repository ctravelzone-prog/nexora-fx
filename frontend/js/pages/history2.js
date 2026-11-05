// pages/history2.js — Copy History + Trade History
Pages.copyHistory=async function(){
  try{
    const copies=await api.getCopyHistory();
    const backBtn='<button onclick="history.back()" style="width:36px;height:36px;border:1px solid var(--border);border-radius:10px;background:#fff;cursor:pointer;display:grid;place-items:center">'+svgIcons.arrow_left+'</button>';
    Components.layout(
      '<div class="flex items-center gap-3 mb-4">'+backBtn+'<h1 style="font-size:21px;font-weight:800">Copy History</h1></div>'
      +'<div class="card" style="padding:0;overflow:hidden"><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Trader</th><th>Amount</th><th>Profit</th><th>Status</th><th>Started</th><th>Stopped</th></tr></thead><tbody>'
      +copies.map(c=>'<tr><td>'+c.trader_name+'</td><td>'+utils.fmtMoney(c.amount_cents)+'</td><td style="color:var(--green-d);font-weight:700">'+(c.profit_cents>=0?'+':'')+utils.fmtMoney(c.profit_cents)+'</td><td>'+utils.statusBadge(c.status)+'</td><td style="font-size:12px">'+utils.fmtDate(c.created_at)+'</td><td style="font-size:12px">'+(c.stopped_at?utils.fmtDate(c.stopped_at):'—')+'</td></tr>').join('')
      +(copies.length===0?'<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">No copy history yet</td></tr>':'')
      +'</tbody></table></div></div>'
    ,'Copy History','');
  }catch(e){document.getElementById('app').innerHTML='<p class="p-8" style="color:var(--red)">'+e.message+'</p>';}
};

Pages.tradeHistory=async function(){
  try{
    const logs=await api.getDailyPnlLog();
    const backBtn='<button onclick="history.back()" style="width:36px;height:36px;border:1px solid var(--border);border-radius:10px;background:#fff;cursor:pointer;display:grid;place-items:center">'+svgIcons.arrow_left+'</button>';
    Components.layout(
      '<div class="flex items-center gap-3 mb-4">'+backBtn+'<h1 style="font-size:21px;font-weight:800">Trade History</h1></div>'
      +'<div class="card" style="padding:0;overflow:hidden"><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Trader</th><th>Day</th><th>Rate</th><th>PnL</th><th>Date</th></tr></thead><tbody>'
      +logs.map(l=>'<tr><td>'+l.trader_name+'</td><td>Day '+l.day_number+'/22</td><td style="font-weight:800;color:'+(l.rate_bp>=0?'var(--green-d)':'var(--red)')+'">'+( l.rate_bp>=0?'+':'')+( l.rate_bp/100).toFixed(2)+'%</td><td style="font-weight:800;color:'+(l.amount_cents>=0?'var(--green-d)':'var(--red)')+'">'+( l.amount_cents>=0?'+':'')+utils.fmtMoney(Math.abs(l.amount_cents))+'</td><td style="font-size:12px">'+utils.fmtDateTime(l.applied_at)+'</td></tr>').join('')
      +(logs.length===0?'<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">No trade history yet</td></tr>':'')
      +'</tbody></table></div></div>'
    ,'Trade History','');
  }catch(e){document.getElementById('app').innerHTML='<p class="p-8" style="color:var(--red)">'+e.message+'</p>';}
};
