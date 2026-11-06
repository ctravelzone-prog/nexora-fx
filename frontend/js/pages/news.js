/*
 * pages/news.js — Forex News: daily economic calendar.
 * Shows the same daily events Forex Factory shows (NFP, CPI, FOMC,
 * GDP and others), always live, in Dhaka time. Red = high impact.
 * The calendar is the TradingView Economic Calendar widget, because
 * Forex Factory blocks automated access (Cloudflare). If TradingView
 * cannot load, a plain notice is shown, never a fake calendar.
 * Key functions:
 * - Pages.news() renders the page (public when logged out, inside
 *   the app layout when logged in) and injects the widget script.
 * Rules / gotchas:
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Balances come from GET /api/user/me; showcase accounts
 *   (is_showcase=1) show DISPLAY balances set by the admin.
 * - The ?v= cache version in script tags must be bumped on every
 *   release or browsers may serve stale code.
 */
// Renders the Forex News page and loads the TradingView Economic
// Calendar widget (currencies: USD, EUR, GBP, JPY, CHF, CAD, AUD,
// NZD, CNY; all importance levels). No backend API call is made.
Pages.news=function(){
  var loggedIn=utils.isLoggedIn()&&App.state.user!==null;
  var pageHtml=`
    <div class="mb-5">
      <h2 class="text-xl font-bold">📰 Forex News</h2>
      <p class="text-sm text-gray-500 mt-1">Daily economic calendar — market-moving events for the currencies you trade. Times in Dhaka (GMT+6). Red = high impact.</p>
    </div>
    <div id="nx-news-holder" style="border:1px solid var(--border);border-radius:14px;overflow:hidden;background:#fff">
      <div class="tradingview-widget-container" style="height:600px"><div class="tradingview-widget-container__widget" style="height:600px"></div></div>
    </div>
    <div id="nx-news-fallback" style="display:none" class="card mt-4 text-sm text-gray-500">Live calendar unavailable right now — please check your connection and reload the page.</div>
    <p class="text-xs text-gray-400 mt-3">Source: TradingView Economic Calendar (same daily events as Forex Factory). High-impact USD news can move gold sharply — check before you trade.</p>
  `;
  if(loggedIn) Components.layout(pageHtml,'Forex News','Daily economic calendar');
  else Components.publicLayout(pageHtml);
  var container=document.querySelector('#nx-news-holder .tradingview-widget-container');
  var script=document.createElement('script');
  script.type='text/javascript';
  script.async=true;
  script.src='https://s3.tradingview.com/external-embedding/embed-widget-events.js';
  script.text=JSON.stringify({
    colorTheme:'light',
    isTransparent:false,
    width:'100%',
    height:600,
    locale:'en',
    importanceFilter:'-1,0,1',
    currencyFilter:'USD,EUR,GBP,JPY,CHF,CAD,AUD,NZD,CNY'
  });
  container.appendChild(script);
// Fallback check: if the widget did not render an iframe within
// 8 seconds, show the plain 'unavailable' notice instead.
  setTimeout(function(){
    var holder=document.getElementById('nx-news-holder');
    if(holder && !holder.querySelector('iframe')){
      document.getElementById('nx-news-fallback').style.display='block';
    }
  },8000);
};
