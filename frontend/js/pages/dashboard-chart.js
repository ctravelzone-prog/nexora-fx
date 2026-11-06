/*
 * dashboard-chart.js — Live TradingView Advanced Chart for the dashboard.
 *
 * Embeds the official TradingView Advanced Chart widget (OANDA:XAUUSD
 * gold by default) and lets the user switch symbol, interval and style.
 * Replaces the old fake SVG chart (seeded random numbers). No sample
 * chart is ever shown as live: if TradingView cannot load, a plain
 * "live unavailable" notice is shown instead.
 *
 * Key functions:
 * - Pages._loadTvChart — (re)builds the widget for the current symbol,
 *   interval and style; shows the fallback notice after 8s with no iframe.
 * - Pages._switchTvSymbol — switch chart symbol (XAUUSD, BTC/USD, US Oil).
 * - Pages._setTvInterval — switch chart interval (1m, 5m, 15m, 1H, 4H, 1D).
 * - Pages._setTvStyle — switch chart style (1 = candles, 3 = area).
 *
 * Gotcha: the ?v= cache version in script tags must be bumped on every
 * release, or browsers may serve stale code.
 */
Pages._tv = Pages._tv || { symbol: 'OANDA:XAUUSD', interval: '15', style: '1' };

// Display title and icon for each chart symbol.
Pages._tvMeta = {
  'OANDA:XAUUSD': { icon: 'Au', title: 'XAUUSD — Gold' },
  'BITSTAMP:BTCUSD': { icon: '₿', title: 'BTC/USD — Bitcoin' },
  'TVC:USOIL': { icon: '🛢', title: 'US Oil — WTI Crude' }
};

// (Re)build the TradingView widget for the current symbol, interval
// and style. The container is rebuilt fresh on every switch.
Pages._loadTvChart = function() {
  var holder = document.getElementById('nx-tv-chart');
  if (!holder) return;
  var meta = Pages._tvMeta[Pages._tv.symbol] || Pages._tvMeta['OANDA:XAUUSD'];
  var titleEl = document.getElementById('nx-chart-title');
  var iconEl = document.getElementById('nx-chart-icon');
  if (titleEl) titleEl.textContent = meta.title;
  if (iconEl) iconEl.textContent = meta.icon;
  // Rebuild the widget container fresh for every switch.
  holder.style.height = '560px';
  holder.innerHTML = '<div class="tradingview-widget-container" style="height:560px"><div class="tradingview-widget-container__widget" style="height:560px"></div></div>';
  var container = holder.querySelector('.tradingview-widget-container');
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.text = JSON.stringify({
    autosize: true,
    symbol: Pages._tv.symbol,
    interval: Pages._tv.interval,
    timezone: 'Asia/Dhaka',
    theme: 'light',
    style: Pages._tv.style,
    locale: 'en',
    allow_symbol_change: false,
    hide_top_toolbar: true,
    hide_side_toolbar: false,
    support_host: 'https://www.tradingview.com'
  });
  container.appendChild(script);
  // Fallback: no TradingView iframe in 8s -> show the notice, never a fake chart.
  setTimeout(function() {
    var fb = document.getElementById('nx-chart-fallback');
    var live = holder.querySelector('iframe');
    if (fb && !live) fb.style.display = 'block';
  }, 8000);
};

// Switch the chart symbol, highlight the clicked button, reload chart.
Pages._switchTvSymbol = function(symbol, btn) {
  Pages._tv.symbol = symbol;
  document.querySelectorAll('[data-tv-symbol]').forEach(function(b) {
    b.style.background = '#fff'; b.style.color = 'var(--body)'; b.style.borderColor = 'var(--border)';
  });
  if (btn) { btn.style.background = 'var(--orange)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--orange)'; }
  Pages._loadTvChart();
};

// Switch the chart interval, highlight the clicked button, reload chart.
Pages._setTvInterval = function(interval, btn) {
  Pages._tv.interval = interval;
  document.querySelectorAll('[data-tv-interval]').forEach(function(b) {
    b.style.background = '#fff'; b.style.color = 'var(--body)'; b.style.borderColor = 'var(--border)';
  });
  if (btn) { btn.style.background = 'var(--orange)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--orange)'; }
  Pages._loadTvChart();
};

// Switch the chart style (candles / area), highlight the button, reload.
Pages._setTvStyle = function(style, btn) {
  Pages._tv.style = style;
  document.querySelectorAll('[data-tv-style]').forEach(function(b) {
    b.style.background = '#fff'; b.style.color = 'var(--body)'; b.style.borderColor = 'var(--border)';
  });
  if (btn) { btn.style.background = 'var(--orange)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--orange)'; }
  Pages._loadTvChart();
};
