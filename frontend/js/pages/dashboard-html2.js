/*
 * dashboard-html2.js — Dashboard HTML, part 2 (Nexora FX).
 *
 * Builds the lower half of the dashboard markup, called by Pages._db
 * in dashboard-html.js: the compact overview grid, the My Copies card,
 * the live TradingView chart card, and the referral link card.
 *
 * Key function:
 * - Pages._db2(b, u, copies, f) — returns the HTML string for the
 *   overview grid, active copies, chart controls and referral URL.
 *
 * Rules: money is integer cents; display via utils.fmtMoney. The
 * overview grid shows Main Balance, Referral Bonus, Total PnL, Total
 * Deposit, Total Withdraw, plus Withdrawable (Main only) when the Main
 * Balance is above zero, otherwise Copy Invested. The chart itself is
 * loaded by Pages._loadTvChart in dashboard-chart.js; the fallback
 * notice is shown, never a fake chart. Referral is a one-time 4% of
 * the referred user's deposit. Website UI text is always English.
 * Gotcha: the ?v= cache version in script tags must be bumped on every
 * release, or browsers may serve stale code.
 */
// Dashboard HTML, part 2: overview grid, My Copies, live chart card
// and referral link. Called by Pages._db in dashboard-html.js.
Pages._db2=function(b,u,copies,f){
  var html='';
  html+='<h3 style="font-size:14.5px;font-weight:800;color:var(--ink);margin-bottom:8px">Quick actions &amp; balances</h3><div class="compact-grid">';
  html+='<div class="c-card"><small>MAIN BALANCE</small><div class="cv">'+f(b.main_cents)+'</div></div>';
  html+='<div class="c-card"><small>REFERRAL BONUS</small><div class="cv">'+f(b.referral_cents)+'</div></div>';
  html+='<div class="c-card"><small>TOTAL PNL</small><div class="cv '+(b.profit_cents>=0?'green':'')+'">'+f(b.profit_cents)+'</div></div>';
  html+='<div class="c-card"><small>TOTAL DEPOSIT</small><div class="cv">'+f(b.total_deposited_cents)+'</div></div>';
  html+='<div class="c-card"><small>TOTAL WITHDRAW</small><div class="cv">'+f(b.total_withdrawn_cents)+'</div></div>';
  html+=b.main_cents>0?'<div class="c-card withdrawable"><small>WITHDRAWABLE</small><div class="cv"><span onclick="App.navigate(\'/withdraw\')" style="cursor:pointer;color:var(--orange)">Withdraw '+f(b.main_cents)+' →</span></div></div>':'<div class="c-card"><small>COPY INVESTED</small><div class="cv">'+f(b.copy_cents)+'</div></div>';
  html+='</div>';
  // Only active copies are shown in the My Copies card.
  var act=(copies||[]).filter(function(c){return c.status==='active';});
  if(act.length>0){
    html+='<div class="card" style="padding:20px;margin-top:16px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><h3 style="font-size:16px;font-weight:800">My Copies</h3><span style="background:#ECFDF5;color:#059669;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px">'+act.length+' ACTIVE</span><button onclick="App.navigate(\'/my-copies\')" style="margin-left:auto;background:linear-gradient(135deg,var(--orange),var(--orange2));color:#fff;border:none;border-radius:10px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">Manage →</button></div>';
    act.forEach(function(c){html+='<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--border)">'+utils.avatar(c.trader_name||'T',null,36)+'<div style="flex:1"><div style="font-weight:700;font-size:14px">'+c.trader_name+'</div><div style="font-size:12px;color:var(--muted)">'+f(c.amount_cents)+' copied</div></div><div style="font-weight:800;font-size:15px;color:var(--green-d)">'+(c.daily_pnl_cents>=0?'+':'')+f(c.daily_pnl_cents)+'</div></div>';});
    html+='</div>';
  }
  html+='<div class="card" style="padding:22px;margin-top:16px">'
    + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><div id="nx-chart-icon" style="width:44px;height:44px;border-radius:13px;background:linear-gradient(145deg,#F59E0B,#D97706);color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px">Au</div>'
    + '<h3 style="font-size:15px;font-weight:800"><span id="nx-chart-title">XAUUSD — Gold</span> <span style="background:#ECFDF5;color:#059669;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;margin-left:6px">LIVE</span></h3></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">'
    + '<button data-tv-symbol onclick="Pages._switchTvSymbol(\'OANDA:XAUUSD\',this)" style="background:var(--orange);color:#fff;border:1.5px solid var(--orange);border-radius:10px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">XAUUSD — Gold</button>'
    + '<button data-tv-symbol onclick="Pages._switchTvSymbol(\'BITSTAMP:BTCUSD\',this)" style="background:#fff;color:var(--body);border:1.5px solid var(--border);border-radius:10px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">BTC/USD</button>'
    + '<button data-tv-symbol onclick="Pages._switchTvSymbol(\'TVC:USOIL\',this)" style="background:#fff;color:var(--body);border:1.5px solid var(--border);border-radius:10px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">US Oil — WTI</button>'
    + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;align-items:center">'
    + '<button data-tv-interval onclick="Pages._setTvInterval(\'1\',this)" style="background:#fff;color:var(--body);border:1.5px solid var(--border);border-radius:8px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit">1m</button>'
    + '<button data-tv-interval onclick="Pages._setTvInterval(\'5\',this)" style="background:#fff;color:var(--body);border:1.5px solid var(--border);border-radius:8px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit">5m</button>'
    + '<button data-tv-interval onclick="Pages._setTvInterval(\'15\',this)" style="background:var(--orange);color:#fff;border:1.5px solid var(--orange);border-radius:8px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit">15m</button>'
    + '<button data-tv-interval onclick="Pages._setTvInterval(\'60\',this)" style="background:#fff;color:var(--body);border:1.5px solid var(--border);border-radius:8px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit">1H</button>'
    + '<button data-tv-interval onclick="Pages._setTvInterval(\'240\',this)" style="background:#fff;color:var(--body);border:1.5px solid var(--border);border-radius:8px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit">4H</button>'
    + '<button data-tv-interval onclick="Pages._setTvInterval(\'D\',this)" style="background:#fff;color:var(--body);border:1.5px solid var(--border);border-radius:8px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit">1D</button>'
    + '<span style="margin-left:8px"></span>'
    + '<button data-tv-style onclick="Pages._setTvStyle(\'1\',this)" style="background:var(--orange);color:#fff;border:1.5px solid var(--orange);border-radius:8px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit">Candles</button>'
    + '<button data-tv-style onclick="Pages._setTvStyle(\'3\',this)" style="background:#fff;color:var(--body);border:1.5px solid var(--border);border-radius:8px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit">Area</button>'
    + '</div>'
    + '<div id="nx-tv-chart" style="margin-top:14px;border:1px solid var(--border);border-radius:14px;overflow:hidden;height:560px"></div>'
    + '<div id="nx-chart-fallback" style="display:none;margin-top:12px;padding:14px;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:12px;color:#991B1B;font-size:13px">Live chart unavailable — TradingView load hoyni. Connection check kore page refresh dao. Fake chart dekhano hobe na.</div>'
    + '</div>';
  // Where We Work (same section as the home page): below the market chart,
  // above the Referral card.
  html+='<div style="margin-top:16px">'+Components.whereWeWork()+'</div>';
  var refUrl=window.location.origin+'/register?ref='+(u.referral_code||'');
  html+='<div class="card" style="padding:20px;margin-top:16px"><span style="font-size:11px;font-weight:800;letter-spacing:.7px;color:var(--faint);display:block;margin-bottom:8px">REFERRAL URL</span><div style="display:flex"><input id="ref-inp" readonly value="'+refUrl+'" style="flex:1;border:1.5px solid var(--border);border-right:0;border-radius:12px 0 0 12px;padding:12px 14px;font-size:12px;color:var(--body);background:var(--bg);min-width:0;font-family:inherit"><button onclick="navigator.clipboard.writeText(document.getElementById(\'ref-inp\').value);utils.toast(\'Copied!\',\'success\')" style="border:0;background:var(--orange);color:#fff;font-weight:800;font-size:13px;padding:0 16px;border-radius:0 12px 12px 0;cursor:pointer;font-family:inherit">COPY</button></div><p style="font-size:12px;color:var(--muted);margin-top:8px">Share your link and earn 4% commission.</p></div>';
  return html;
};
