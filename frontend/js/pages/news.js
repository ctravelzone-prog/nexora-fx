// pages/news.js — Forex News: daily economic calendar (same events Forex Factory shows).
// Forex Factory blocks automated access (Cloudflare), so the calendar is the
// TradingView Economic Calendar widget — same daily forex events (NFP, CPI,
// FOMC, GDP...), always live, in Dhaka time. If TradingView cannot load, a
// plain notice is shown, never a fake calendar.
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
  setTimeout(function(){
    var holder=document.getElementById('nx-news-holder');
    if(holder && !holder.querySelector('iframe')){
      document.getElementById('nx-news-fallback').style.display='block';
    }
  },8000);
};
