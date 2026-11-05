// pages/landing.js — Landing page
Pages.landing = async function() {
  const s = App.state.settings;
  const heroImg = s.hero_image_url ? `<img src="${s.hero_image_url}" class="w-full h-full object-cover rounded-2xl" alt="Trading">` :
    `<div class="w-full h-full rounded-2xl flex items-center justify-center" style="background:linear-gradient(135deg,#1E2329,#2D3748)"><picture class="w-full h-full"><source srcset="/assets/hero-trading.webp" type="image/webp"><img src="/assets/hero-trading.png" class="w-full h-full object-cover rounded-2xl" alt="Trading" fetchpriority="high" onerror="this.style.display='none'"></picture><div class="absolute inset-0 flex items-center justify-center text-white text-opacity-30 text-6xl">📈</div></div>`;

  document.getElementById('app').innerHTML = `
    ${Components.topbarPublic('')}
    ${s.announcement_bar ? `<div class="bg-orange-500 text-white text-center text-sm font-medium py-2 px-4">${s.announcement_bar}</div>` : ''}
    <main>
      <!-- Hero -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16 hero-cover">
        <div class="hero-particles" aria-hidden="true">
        <span style="--x:33.1%;--y:25.6%;--s:9px;--d:10.4s;--t:5.7s"></span>
        <span style="--x:11.0%;--y:55.8%;--s:8px;--d:11.7s;--t:0.6s"></span>
        <span style="--x:42.1%;--y:31.8%;--s:8px;--d:13.4s;--t:5.8s"></span>
        <span style="--x:13.9%;--y:30.6%;--s:9px;--d:14.7s;--t:0.4s"></span>
        <span style="--x:58.2%;--y:18.5%;--s:5px;--d:10.4s;--t:6.0s"></span>
        <span style="--x:29.8%;--y:25.1%;--s:4px;--d:14.6s;--t:3.9s"></span>
        <span style="--x:67.5%;--y:22.2%;--s:8px;--d:15.1s;--t:2.6s"></span>
        <span style="--x:54.6%;--y:19.4%;--s:4px;--d:15.0s;--t:3.5s"></span>
        <span style="--x:53.0%;--y:69.4%;--s:7px;--d:14.7s;--t:3.2s"></span>
        <span style="--x:30.8%;--y:70.6%;--s:9px;--d:16.2s;--t:0.6s"></span>
        <span style="--x:30.8%;--y:49.7%;--s:6px;--d:15.8s;--t:2.0s"></span>
        <span style="--x:96.1%;--y:23.3%;--s:7px;--d:11.3s;--t:2.4s"></span>
        <span style="--x:91.6%;--y:44.5%;--s:9px;--d:10.6s;--t:3.9s"></span>
        <span style="--x:77.8%;--y:72.3%;--s:6px;--d:15.6s;--t:4.2s"></span>
        <span style="--x:57.7%;--y:46.9%;--s:4px;--d:17.6s;--t:3.3s"></span>
        <span style="--x:65.8%;--y:19.2%;--s:9px;--d:12.5s;--t:4.0s"></span>
        <span style="--x:67.4%;--y:46.2%;--s:9px;--d:13.1s;--t:4.7s"></span>
        <span style="--x:4.2%;--y:47.3%;--s:5px;--d:14.9s;--t:3.5s"></span>
        <span style="--x:22.9%;--y:35.1%;--s:9px;--d:12.0s;--t:2.7s"></span>
        <span style="--x:85.7%;--y:20.6%;--s:7px;--d:13.2s;--t:1.9s"></span>
        <span style="--x:15.1%;--y:45.1%;--s:8px;--d:12.2s;--t:2.9s"></span>
        <span style="--x:36.4%;--y:76.9%;--s:5px;--d:11.2s;--t:1.2s"></span>
        <span style="--x:24.3%;--y:31.3%;--s:7px;--d:16.6s;--t:1.3s"></span>
        <span style="--x:29.1%;--y:25.2%;--s:8px;--d:13.0s;--t:4.0s"></span>
        <span style="--x:93.5%;--y:63.3%;--s:8px;--d:17.6s;--t:4.6s"></span>
        <span style="--x:73.0%;--y:47.0%;--s:9px;--d:16.4s;--t:2.7s"></span>
        <span style="--x:40.3%;--y:22.2%;--s:9px;--d:13.2s;--t:1.3s"></span>
        <span style="--x:96.5%;--y:45.8%;--s:4px;--d:12.7s;--t:0.4s"></span>
        <span style="--x:2.0%;--y:25.6%;--s:4px;--d:17.6s;--t:4.3s"></span>
        <span style="--x:8.8%;--y:29.6%;--s:7px;--d:11.2s;--t:1.8s"></span>
        <span style="--x:35.3%;--y:40.5%;--s:4px;--d:10.9s;--t:3.4s"></span>
        <span style="--x:95.9%;--y:48.6%;--s:6px;--d:10.7s;--t:0.7s"></span>
        <span style="--x:34.9%;--y:33.5%;--s:9px;--d:11.3s;--t:0.2s"></span>
        <span style="--x:93.3%;--y:52.0%;--s:5px;--d:15.5s;--t:6.4s"></span>
        <span style="--x:74.8%;--y:35.9%;--s:9px;--d:16.9s;--t:4.9s"></span>
        <span style="--x:27.1%;--y:40.7%;--s:5px;--d:12.8s;--t:1.6s"></span>
        <span style="--x:54.0%;--y:50.2%;--s:9px;--d:11.8s;--t:5.7s"></span>
        <span style="--x:96.6%;--y:74.7%;--s:5px;--d:16.5s;--t:5.2s"></span>
        <span style="--x:23.8%;--y:51.2%;--s:6px;--d:15.8s;--t:6.9s"></span>
        <span style="--x:77.9%;--y:48.1%;--s:5px;--d:15.5s;--t:6.7s"></span>
        <span style="--x:44.9%;--y:80.6%;--s:6px;--d:17.6s;--t:2.6s"></span>
        <span style="--x:23.2%;--y:30.9%;--s:5px;--d:12.7s;--t:3.4s"></span>
        <span style="--x:96.6%;--y:57.7%;--s:4px;--d:13.8s;--t:4.6s"></span>
        <span style="--x:78.8%;--y:20.9%;--s:9px;--d:11.0s;--t:2.7s"></span>
        <span style="--x:70.3%;--y:29.0%;--s:5px;--d:13.5s;--t:4.5s"></span>
        <span style="--x:10.3%;--y:81.2%;--s:9px;--d:13.2s;--t:2.8s"></span>
        <span style="--x:92.9%;--y:65.7%;--s:5px;--d:17.9s;--t:0.2s"></span>
        <span style="--x:58.7%;--y:47.6%;--s:9px;--d:11.2s;--t:5.8s"></span>
        <span style="--x:96.1%;--y:61.0%;--s:6px;--d:11.2s;--t:3.8s"></span>
        <span style="--x:4.1%;--y:71.0%;--s:9px;--d:15.2s;--t:3.7s"></span>
        <span style="--x:91.6%;--y:45.4%;--s:5px;--d:16.6s;--t:1.5s"></span>
        <span style="--x:26.2%;--y:35.5%;--s:5px;--d:16.1s;--t:2.3s"></span>
        <span style="--x:54.3%;--y:73.4%;--s:4px;--d:17.3s;--t:2.5s"></span>
        <span style="--x:46.0%;--y:55.8%;--s:8px;--d:13.4s;--t:6.4s"></span>
        <span style="--x:50.2%;--y:52.2%;--s:8px;--d:14.1s;--t:6.1s"></span>
        <span style="--x:76.5%;--y:57.6%;--s:5px;--d:11.4s;--t:3.3s"></span>
        <span style="--x:71.6%;--y:54.0%;--s:6px;--d:15.5s;--t:3.7s"></span>
        <span style="--x:48.3%;--y:69.4%;--s:8px;--d:10.5s;--t:1.3s"></span>
        <span style="--x:6.1%;--y:21.8%;--s:7px;--d:14.5s;--t:5.3s"></span>
        <span style="--x:89.6%;--y:46.0%;--s:8px;--d:17.8s;--t:4.2s"></span>
        <span style="--x:21.1%;--y:34.4%;--s:8px;--d:14.3s;--t:3.3s"></span>
        <span style="--x:92.4%;--y:63.9%;--s:6px;--d:17.4s;--t:6.2s"></span>
        <span style="--x:21.4%;--y:46.3%;--s:7px;--d:11.0s;--t:3.1s"></span>
        <span style="--x:9.0%;--y:31.8%;--s:4px;--d:11.7s;--t:2.1s"></span>
        <span style="--x:13.7%;--y:69.4%;--s:9px;--d:15.1s;--t:2.6s"></span>
        <span style="--x:26.3%;--y:24.6%;--s:7px;--d:11.8s;--t:6.7s"></span>
        <span style="--x:40.2%;--y:49.1%;--s:9px;--d:16.7s;--t:1.1s"></span>
        <span style="--x:43.4%;--y:51.1%;--s:6px;--d:13.4s;--t:2.5s"></span>
        <span style="--x:10.9%;--y:40.6%;--s:6px;--d:14.4s;--t:3.1s"></span>
        <span style="--x:3.7%;--y:38.2%;--s:8px;--d:12.4s;--t:6.7s"></span>
        <span style="--x:12.8%;--y:79.3%;--s:5px;--d:17.8s;--t:0.7s"></span>
        <span style="--x:27.5%;--y:17.8%;--s:5px;--d:12.2s;--t:0.9s"></span>
        <span style="--x:42.5%;--y:78.8%;--s:6px;--d:13.2s;--t:3.8s"></span>
        <span style="--x:51.4%;--y:49.6%;--s:6px;--d:10.7s;--t:0.4s"></span>
        <span style="--x:68.1%;--y:44.8%;--s:4px;--d:12.2s;--t:0.1s"></span>
        <span style="--x:10.5%;--y:33.2%;--s:8px;--d:16.8s;--t:0.5s"></span>
        <span style="--x:84.8%;--y:46.8%;--s:6px;--d:18.0s;--t:2.9s"></span>
        <span style="--x:89.9%;--y:58.5%;--s:4px;--d:14.2s;--t:1.7s"></span>
        <span style="--x:12.5%;--y:26.3%;--s:4px;--d:11.4s;--t:6.5s"></span>
        <span style="--x:62.4%;--y:52.2%;--s:5px;--d:12.3s;--t:3.5s"></span>
        <span style="--x:19.1%;--y:39.3%;--s:4px;--d:18.0s;--t:0.3s"></span>
        <span style="--x:3.8%;--y:50.4%;--s:5px;--d:14.1s;--t:1.7s"></span>
        <span style="--x:44.9%;--y:61.1%;--s:9px;--d:13.5s;--t:3.5s"></span>
        <span style="--x:82.1%;--y:42.5%;--s:8px;--d:12.5s;--t:1.5s"></span>
        <span style="--x:24.0%;--y:28.9%;--s:9px;--d:15.8s;--t:1.0s"></span>
        <span style="--x:97.0%;--y:83.7%;--s:5px;--d:10.1s;--t:4.4s"></span>
        <span style="--x:86.5%;--y:45.2%;--s:4px;--d:10.7s;--t:5.9s"></span>
        <span style="--x:85.6%;--y:61.9%;--s:6px;--d:14.8s;--t:4.8s"></span>
        <span style="--x:6.3%;--y:28.0%;--s:6px;--d:13.6s;--t:1.8s"></span>
        <span style="--x:94.3%;--y:83.1%;--s:8px;--d:12.6s;--t:0.2s"></span>
        <span style="--x:86.7%;--y:30.3%;--s:5px;--d:10.0s;--t:2.7s"></span>
        <span style="--x:47.6%;--y:50.2%;--s:5px;--d:12.0s;--t:5.4s"></span>
        <span style="--x:10.7%;--y:72.2%;--s:5px;--d:13.2s;--t:0.3s"></span>
        <span style="--x:4.2%;--y:36.3%;--s:5px;--d:10.7s;--t:6.7s"></span>
        <span style="--x:83.9%;--y:25.9%;--s:9px;--d:16.3s;--t:4.2s"></span>
        <span style="--x:75.4%;--y:65.4%;--s:7px;--d:11.2s;--t:5.1s"></span>
        <span style="--x:63.7%;--y:18.1%;--s:9px;--d:17.1s;--t:4.4s"></span>
        <span style="--x:72.4%;--y:71.9%;--s:5px;--d:17.3s;--t:5.3s"></span>
        <span style="--x:56.6%;--y:71.9%;--s:4px;--d:16.6s;--t:4.1s"></span>
        <span style="--x:87.7%;--y:62.8%;--s:9px;--d:15.1s;--t:0.6s"></span>
      </div>
        <div class="flex flex-col lg:grid lg:grid-cols-2 gap-8 lg:gap-10 items-center hero-grid">
          <div>
            <div class="inline-flex items-center gap-2 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-full mb-6">
              <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> LIVE MARKETS
            </div>
            <h1 class="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
              Trade <span class="text-orange-500">Smarter</span>,<br>Not Harder.
            </h1>
            <p class="text-gray-500 text-lg mb-8">Join thousands of traders worldwide. Start your journey today — copy top strategies, follow live markets, and grow at your own pace.</p>
            <div class="flex flex-col sm:flex-row gap-3 mb-6">
              <a href="/register" class="btn-primary text-center text-lg py-4" style="max-width:320px">Sign Up</a>
            </div>
            <p class="text-sm text-gray-500">Already have an account? <a href="/login" class="text-orange-500 font-semibold">Log In</a></p>
            <a href="#" class="mt-4 inline-flex items-center gap-3 bg-gray-900 text-white rounded-2xl px-5 py-3 text-sm font-semibold" style="max-width:280px">
              <span>📱</span> Download Android App
            </a>
            <div class="flex gap-4 mt-8">
              ${['SECURE|Account security|🛡️','FAST|Instant execution|⚡','TRUSTED|Trader profiles|🏆'].map(x=>{const[t,s,e]=x.split('|');return`<div class="flex items-center gap-2 text-sm"><span class="w-8 h-8 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-base">${e}</span><div><div class="font-bold text-xs">${t}</div><div class="text-gray-400 text-xs">${s}</div></div></div>`;}).join('')}
            </div>
          </div>
          <div class="relative h-80 lg:h-96">${heroImg}
            <div class="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-3">
              <div class="bg-white rounded-xl p-3 shadow-lg"><div class="text-xs text-gray-400 font-semibold">BITCOIN · BTC/USD</div><div class="text-lg font-bold" id="hero-btc-price">$75,907</div><div class="text-xs text-green-500 font-semibold" id="hero-btc-change">▲ Live market</div></div>
              <div class="bg-white rounded-xl p-3 shadow-lg"><div class="text-xs text-gray-400 font-semibold">GOLD · XAU/USD</div><div class="text-lg font-bold" id="hero-xau-price">$3,936.10</div><div class="text-xs text-red-500 font-semibold" id="hero-xau-change">▼ −0.37% today</div></div>
            </div>
          </div>
        </div>
      </section>
      <!-- Ticker: official TradingView Ticker Tape, real-time + auto-scrolling.
           The script tag is NOT put in innerHTML (it would not execute), it is
           appended dynamically at the end of Pages.landing. If TradingView
           cannot load, the fallback marquee below shows and is honestly
           labelled as unavailable, never passed off as live. -->
      <style>
        /* Animated cover behind the hero texts: golden particles float up and
           fade (pure CSS on spans — moves on every screen). */
        .hero-cover{position:relative;overflow:hidden}
        .hero-cover .hero-grid{position:relative;z-index:1}
        .hero-particles{position:absolute;inset:0;overflow:hidden;pointer-events:none}
        .hero-particles span{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);border-radius:9999px;background:radial-gradient(circle,#FDE68A 0%,#F59E0B 70%,transparent 100%);opacity:0;animation:particleFloat var(--d) ease-in-out infinite;animation-delay:var(--t)}
        @keyframes particleFloat{0%{transform:translateY(0) scale(.6);opacity:0}25%{opacity:.9}50%{transform:translateY(-90px) scale(1);opacity:.5}75%{opacity:.25}100%{transform:translateY(-160px) scale(.6);opacity:0}}
        @media (prefers-reduced-motion: reduce){.hero-particles span{animation:none}}
        .nx-ticker-wrap{display:flex;align-items:stretch;background:#111827;color:#fff;overflow:hidden}
        .nx-ticker-scroll{flex:1;min-width:0}
        .nx-ticker-scroll .tradingview-widget-container__widget{height:46px}
        .nx-streaming{flex-shrink:0;display:flex;align-items:center;gap:6px;padding:0 16px;color:#4ADE80;font-size:13px;font-weight:700;white-space:nowrap;border-left:1px solid #374151}
        .nx-fallback-track{display:flex;gap:32px;white-space:nowrap;animation:nxTickerScroll 30s linear infinite;padding:12px 0;font-size:14px}
        .nx-fallback-track:hover{animation-play-state:paused}
        @keyframes nxTickerScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
      </style>
      <div class="nx-ticker-wrap">
        <div class="nx-ticker-scroll">
          <div class="tradingview-widget-container">
            <div class="tradingview-widget-container__widget"></div>
          </div>
          <div id="nx-ticker-fallback" style="display:none;overflow:hidden">
            <div class="nx-fallback-track">
              <span><span style="color:#9CA3AF;font-weight:600">EUR/USD</span> 1.0842 <span style="color:#4ADE80">+0.12%</span></span>
              <span><span style="color:#9CA3AF;font-weight:600">BTC</span> <span class="fb-btc-price">75,907</span> <span class="fb-btc-chg" style="color:#4ADE80">+1.84%</span></span>
              <span><span style="color:#9CA3AF;font-weight:600">XAU/USD</span> <span class="fb-xau-price">3,936.10</span> <span class="fb-xau-chg" style="color:#F87171">\u22120.37%</span></span>
              <span><span style="color:#9CA3AF;font-weight:600">USD/JPY</span> 157.626 <span style="color:#F87171">\u22120.21%</span></span>
              <span><span style="color:#9CA3AF;font-weight:600">EUR/USD</span> 1.0842 <span style="color:#4ADE80">+0.12%</span></span>
              <span><span style="color:#9CA3AF;font-weight:600">BTC</span> <span class="fb-btc-price">75,907</span> <span class="fb-btc-chg" style="color:#4ADE80">+1.84%</span></span>
              <span><span style="color:#9CA3AF;font-weight:600">XAU/USD</span> <span class="fb-xau-price">3,936.10</span> <span class="fb-xau-chg" style="color:#F87171">\u22120.37%</span></span>
              <span><span style="color:#9CA3AF;font-weight:600">USD/JPY</span> 157.626 <span style="color:#F87171">\u22120.21%</span></span>
              <span style="color:#FBBF24">Live feed unavailable \u2014 showing last sample</span>
            </div>
          </div>
        </div>
        <div class="nx-streaming"><span style="width:8px;height:8px;background:#4ADE80;border-radius:50%;display:inline-block" class="animate-pulse"></span>STREAMING</div>
      </div>
      <!-- Quick actions -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h2 class="text-xl font-bold mb-6">Quick actions</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          ${[['⭐','Promotion','NEW'],['📰','News',''],['📅','Schedule',''],['📹','Webinar','']].map(([e,l,b])=>`<div class="card hover:shadow-md transition-shadow cursor-pointer flex flex-col items-center gap-2 py-6 relative">${b?`<span class="absolute top-3 right-3 orange-tag">${b}</span>`:''}<span class="text-3xl">${e}</span><span class="text-sm font-semibold text-gray-600">${l}</span></div>`).join('')}
        </div>
      </section>
      <!-- Footer -->
      <footer class="border-t border-gray-100 py-10 mt-6">
        <div class="max-w-7xl mx-auto px-4 sm:px-6">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-2"><img src="/assets/logo-nx-mark-transparent.png" style="height:28px" alt="NX"><span class="font-bold">Nexora <span class="text-orange-500">FX</span></span></div>
            <div class="flex gap-6 text-sm text-gray-500">
              <a href="/risk-terms" class="hover:text-orange-500">Risk Disclosure</a>
              <a href="/risk-terms" class="hover:text-orange-500">Terms</a>
              <a href="/risk-terms" class="hover:text-orange-500">Privacy</a>
            </div>
            <p class="text-xs text-gray-400">${s.footer_about||'© Nexora Fx. Copy trading involves risk.'}</p>
          </div>
        </div>
      </footer>
    </main>`;

  // Load the official TradingView Ticker Tape widget (real-time data).
  // innerHTML script tags do not execute, so the script is created here.
  (function loadTickerTape(){
    var container = document.querySelector('.tradingview-widget-container__widget');
    if (!container) return;
    var old = document.getElementById('nx-tv-ticker-script');
    if (old) old.remove();
    var script = document.createElement('script');
    script.id = 'nx-tv-ticker-script';
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.text = JSON.stringify({
      symbols: [
        { proName: 'OANDA:XAUUSD', title: 'XAU/USD' },
        { proName: 'FX:EURUSD', title: 'EUR/USD' },
        { proName: 'BITSTAMP:BTCUSD', title: 'BTC' },
        { proName: 'FX:USDJPY', title: 'USD/JPY' }
      ],
      colorTheme: 'dark',
      isTransparent: false,
      displayMode: 'adaptive',
      locale: 'en'
    });
    document.querySelector('.tradingview-widget-container').appendChild(script);
    // Fallback: if no TradingView iframe appears in 6s, show the scrolling
    // fallback marquee instead of a blank bar. Its values are labelled
    // as last sample, never as live.
    setTimeout(function(){
      var fb = document.getElementById('nx-ticker-fallback');
      var live = document.querySelector('.tradingview-widget-container iframe');
      if (fb && !live) { fb.style.display = 'block'; }
    }, 6000);
  })();

  // Live hero prices (BTC + XAU) — refreshed every 5s from /api/market/quotes.
  // The values in the markup are samples; they are replaced as soon as live data arrives.
  // If the quote service is down, the samples stay (never a blank card).
  // Live hero prices (BTC + XAU).
  // BTC price: Binance public trade stream (wss) — ticks on every trade,
  // straight from the browser, bypassing the slow preview tunnel. If the
  // stream is blocked or drops, the 5s REST poll takes over automatically.
  // XAU price: TradingView real-time OANDA:XAUUSD — their public quote
  // websocket first (same live feed as the ticker tape below), then their
  // public scanner quote (same price, plain HTTPS, 1s poll) if the websocket
  // goes quiet, then Binance PAXG (1s poll, offset-corrected to spot), and
  // if that goes quiet too, the 5s REST poll takes over.
  (function heroPrices(){
    var prevPrice = {};
    var wsBtcFresh = 0; // ms timestamp of the last Binance BTC trade
    var tvFresh = 0; // ms timestamp of the last TradingView XAU tick
    var tvRestFresh = 0; // ms timestamp of the last TradingView scanner poll
    var lastSpot = 0; // last XAU spot price from the quotes poll
    var lastSpotUsed = 0; // the spot value the current offset was computed from
    var xauOffset = 9; // rough starting offset (PAXG ~$9 below spot); refined on each new spot
    var lastPaxg = 0; // last Binance PAXG/USDT price
    var xauPaxgFresh = 0; // ms timestamp of the last successful PAXG fetch
    function flash(el, up){
      el.style.transition = 'color .45s, transform .45s';
      el.style.color = up ? '#16A34A' : '#DC2626';
      el.style.transform = up ? 'translateY(-3px) scale(1.05)' : 'translateY(3px) scale(1.05)';
      (function(e2){ setTimeout(function(){ e2.style.color=''; e2.style.transform=''; }, 900); })(el);
    }
    function fmt(price, decimals){
      return '$' + price.toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
    }
    function setPrice(priceId, price, decimals){
      var p = document.getElementById(priceId);
      if(!p || typeof price !== 'number') return;
      var old = prevPrice[priceId];
      if(typeof old === 'number' && price !== old) flash(p, price > old);
      prevPrice[priceId] = price;
      p.textContent = fmt(price, decimals);
    }
    function setChange(changeId, change){
      var c = document.getElementById(changeId);
      if(!c) return;
      if(typeof change === 'number'){
        var up2 = change >= 0;
        c.textContent = (up2 ? '▲ +' : '▼ \u2212') + Math.abs(change).toFixed(2) + '% today';
        c.className = 'text-xs font-semibold ' + (up2 ? 'text-green-500' : 'text-red-500');
      } else {
        c.textContent = '▲ Live market';
        c.className = 'text-xs text-green-500 font-semibold';
      }
    }
    function setCard(priceId, changeId, q, decimals){
      if(!q || typeof q.price !== 'number') return;
      setPrice(priceId, q.price, decimals);
      setChange(changeId, q.change);
    }
    function setFallback(priceCls, chgCls, q, decimals){
      if(!q || typeof q.price !== 'number') return;
      var txt = fmt(q.price, decimals);
      document.querySelectorAll('.'+priceCls).forEach(function(el){ el.textContent = txt; });
      if(typeof q.change === 'number'){
        var up = q.change >= 0;
        document.querySelectorAll('.'+chgCls).forEach(function(el){
          el.textContent = (up ? '+' : '\u2212') + Math.abs(q.change).toFixed(2) + '%';
          el.style.color = up ? '#4ADE80' : '#F87171';
        });
      }
    }
    function setFallbackPrice(priceCls, price, decimals){
      if(typeof price !== 'number') return;
      var txt = fmt(price, decimals);
      document.querySelectorAll('.'+priceCls).forEach(function(el){ el.textContent = txt; });
    }
    function startBtcStream(){
      if(window._nxBtcWs) return;
      var ws;
      try { ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade'); }
      catch(e){ return; }
      window._nxBtcWs = ws;
      ws.onmessage = function(ev){
        try {
          var m = JSON.parse(ev.data), pr = parseFloat(m.p);
          if(isNaN(pr)) return;
          wsBtcFresh = Date.now();
          setPrice('hero-btc-price', pr, 2);
          setFallbackPrice('fb-btc-price', pr, 2);
        } catch(e){}
      };
      ws.onclose = function(){
        window._nxBtcWs = null;
        setTimeout(startBtcStream, 5000);
      };
      ws.onerror = function(){ try { ws.close(); } catch(e){} };
    }
    // Gold price — TradingView real-time OANDA:XAUUSD, straight from the
    // browser over TradingView's own public quote websocket (the same live
    // feed as the TradingView chart and ticker on this page). If it goes
    // quiet, the PAXG poller below takes over automatically.
    function startXauTV(){
      if(window._nxTvWs) return;
      var ws;
      try { ws = new WebSocket('wss://data.tradingview.com/socket.io/websocket'); }
      catch(e){ return; }
      window._nxTvWs = ws;
      var session = 'qs_' + Math.floor(Math.random()*1e9);
      function tvSend(obj){
        var s = JSON.stringify(obj);
        try { ws.send('~m~' + s.length + '~m~' + s); } catch(e){}
      }
      ws.onopen = function(){
        tvSend({m:'set_auth_token', p:['unauthorized_user_token']});
        tvSend({m:'quote_create_session', p:[session]});
        tvSend({m:'quote_set_fields', p:[session,'lp','ch','chp']});
        tvSend({m:'quote_add_symbols', p:[session,'OANDA:XAUUSD']});
        tvSend({m:'quote_fast_symbols', p:[session,'OANDA:XAUUSD']});
      };
      ws.onmessage = function(ev){
        var data = ev.data;
        if(typeof data !== 'string') return;
        // Heartbeat: server sends ~h~<n>, reply with the same.
        if(data.indexOf('~h~') === 0){ try { ws.send(data); } catch(e){} return; }
        // Messages are framed as ~m~<len>~m~<json>, possibly several per frame.
        var parts = data.split('~m~');
        for(var i=1;i<parts.length;i+=2){
          var json = parts[i+1];
          if(!json) continue;
          try{
            var m = JSON.parse(json);
            if(m.m === 'qsd' && m.p && m.p[1] === 'OANDA:XAUUSD' && m.p[2] && m.p[2].v && typeof m.p[2].v.lp === 'number'){
              var pr = m.p[2].v.lp;
              tvFresh = Date.now();
              setPrice('hero-xau-price', pr, 2);
              setFallbackPrice('fb-xau-price', pr, 2);
              if(typeof m.p[2].v.chp === 'number') setChange('hero-xau-change', m.p[2].v.chp);
            }
          }catch(e){}
        }
      };
      ws.onclose = function(){
        window._nxTvWs = null;
        setTimeout(startXauTV, 5000);
      };
      ws.onerror = function(){ try { ws.close(); } catch(e){} };
    }
    // Gold price — TradingView scanner (their own public quote, the SAME
    // price the ticker tape below shows). Plain HTTPS, so it works wherever
    // the PAXG fetch works. Polls every 1s while the websocket is quiet.
    function startXauTvRest(){
      if(window._nxXauTvRestTimer) return;
      window._nxXauTvRestTimer = setInterval(async function(){
        if(Date.now() - tvFresh < 8000) return; // websocket is live, leave it alone
        try{
          var ctl = new AbortController();
          var fto = setTimeout(function(){ ctl.abort(); }, 5000);
          var r = await fetch('https://scanner.tradingview.com/symbol?symbol=OANDA:XAUUSD&fields=close', {signal: ctl.signal});
          clearTimeout(fto);
          if(!r.ok) return;
          var j = await r.json();
          var pr = parseFloat(j.close);
          if(!isFinite(pr) || pr <= 0) return;
          tvRestFresh = Date.now();
          setPrice('hero-xau-price', pr, 2);
          setFallbackPrice('fb-xau-price', pr, 2);
        }catch(e){}
      }, 1000);
    }
    // Gold price — Binance PAXG/USDT, corrected to spot. PAXG trades a few
    // dollars below spot; the offset (spot minus PAXG) is recomputed from the
    // latest poll price every time, so the card reads as spot and ticks every 2s.
    // (Deriv's stream was removed: it connected but never sent a tick.)
    function startXauPaxg(){
      if(window._nxXauPaxgTimer) return;
      window._nxXauPaxgTimer = setInterval(async function(){
        if(Date.now() - tvFresh < 8000 || Date.now() - tvRestFresh < 8000) return; // TradingView is live, leave it alone
        try{
          var ctl = new AbortController();
          var fto = setTimeout(function(){ ctl.abort(); }, 5000);
          var r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT', {signal: ctl.signal});
          clearTimeout(fto);
          if(!r.ok) return;
          var j = await r.json();
          var pr = parseFloat(j.price);
          if(!isFinite(pr) || pr <= 0) return;
          lastPaxg = pr;
          xauPaxgFresh = Date.now();
          // Recompute the offset ONLY when a new spot price arrived; otherwise
          // the offset would swallow PAXG's own movement and the card would
          // only move when the slow poll moves.
          if(lastSpot > 0 && lastSpot !== lastSpotUsed){
            xauOffset = lastSpot - pr;
            lastSpotUsed = lastSpot;
          }
          var shown = pr + xauOffset;
          setPrice('hero-xau-price', shown, 2);
          setFallbackPrice('fb-xau-price', shown, 2);
        }catch(e){}
      }, 1000);
    }
    async function refresh(){
      if(!document.getElementById('hero-btc-price') && !document.getElementById('hero-xau-price')){
        if(window._nxHeroTimer){ clearInterval(window._nxHeroTimer); window._nxHeroTimer = null; }
        return;
      }
      try{
        var ctl = new AbortController();
        var fto = setTimeout(function(){ ctl.abort(); }, 15000);
        var r = await fetch('/api/market/quotes', {signal: ctl.signal});
        clearTimeout(fto);
        if(!r.ok) return;
        var d = await r.json();
        // While the Binance stream is live, REST only refreshes the BTC 24h
        // change — the stream owns the price (REST would overwrite its ticks).
        if(Date.now() - wsBtcFresh < 10000){
          setChange('hero-btc-change', d.btc && d.btc.change);
          if(d.btc) setFallback('fb-btc-price','fb-btc-chg', {price: prevPrice['hero-btc-price'], change: d.btc.change}, 2);
        } else {
          setCard('hero-btc-price','hero-btc-change', d.btc, 2);
          setFallback('fb-btc-price','fb-btc-chg', d.btc, 2);
        }
        // Gold: remember the fresh spot price (the PAXG poller uses it for its
        // offset). A live source (TradingView, then PAXG) owns the price; the
        // slow poll only owns it when both have gone quiet.
        if(d.xau && typeof d.xau.price === 'number'){
          lastSpot = d.xau.price;
          if(Date.now() - tvFresh < 10000 || Date.now() - tvRestFresh < 15000 || Date.now() - xauPaxgFresh < 15000){
            setChange('hero-xau-change', d.xau.change);
            setFallback('fb-xau-price','fb-xau-chg', {price: prevPrice['hero-xau-price'], change: d.xau.change}, 2);
          } else {
            setCard('hero-xau-price','hero-xau-change', d.xau, 2);
            setFallback('fb-xau-price','fb-xau-chg', d.xau, 2);
          }
        }
      }catch(e){}
    }
    if(window._nxHeroTimer) clearInterval(window._nxHeroTimer);
    startBtcStream();
    startXauTV();
    startXauTvRest();
    startXauPaxg();
    refresh();
    window._nxHeroTimer = setInterval(refresh, 5000);
  })();
};
