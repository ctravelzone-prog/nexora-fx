/*
 * landing.js — Public landing page for Nexora FX.
 *
 * Renders the home page from App.state.settings (brand, hero image,
 * announcement bar, logo and footer text) and starts the live market
 * prices in the hero cards and the streaming ticker.
 *
 * Key function:
 * - Pages.landing — renders the page, loads the TradingView Ticker
 *   Tape widget, and starts the live hero prices (BTC + XAU).
 *
 * Page sections, in order (all inside one template literal below, so
 * section notes live here in JS code, never inside the template):
 * - Hero — slogan "Trade Smarter, Not Harder.", Sign Up / Log In,
 *   SECURE / FAST / TRUSTED badges, hero image with golden particles,
 *   smoke and fire sparks, and live BTC / XAU price cards.
 * - LIVE MARKETS pill — centered between the hero and the ticker.
 * - Ticker — official TradingView Ticker Tape (XAU/USD first, then
 *   EUR/USD, BTC, USD/JPY); a labelled last-sample fallback shows
 *   if TradingView cannot load, never passed off as live.
 * - Quick actions — Promotion, News, Schedule and Webinar cards.
 * - Where We Work — Binance, Exness, Bybit and XM glass cards
 *   with real broker logos and feature lists.
 * - Download — Android app download button.
 * - Footer — NX logo and brand name, Risk / Terms / Privacy links.
 *
 * Rules: theme color is orange; brand is Nexora FX. Hero prices start
 * as samples and are replaced as soon as live data arrives; if every
 * live source is down, the samples stay (never a blank card).
 * Gotcha: script tags inside innerHTML do not execute, so the
 * TradingView widget script is appended dynamically after render.
 * Gotcha: the ?v= cache version in script tags must be bumped on every
 * release, or browsers may serve stale code.
 */
// Landing page. Renders the home page and starts live market prices.
Pages.landing = async function() {
  const s = App.state.settings;
  // Hero image: the admin-set image if present, else the default
  // local WebP (with PNG fallback) trading image.
  const heroImg = s.hero_image_url ? `<img src="${s.hero_image_url}" class="w-full h-full object-cover rounded-2xl" alt="Trading">` :
    `<div class="w-full h-full rounded-2xl flex items-center justify-center" style="background:linear-gradient(135deg,#1E2329,#2D3748)"><picture class="w-full h-full"><source srcset="/assets/hero-trading.webp" type="image/webp"><img src="/assets/hero-trading.png" class="w-full h-full object-cover rounded-2xl" alt="Trading" fetchpriority="high" onerror="this.style.display='none'"></picture></div>`;

  // Render the page. Sections in order: hero, LIVE MARKETS pill,
  // ticker, quick actions, Where We Work, download, footer (see the
  // header block above for details on each section).
  document.getElementById('app').innerHTML = `
    ${Components.topbarPublic('')}
    ${s.announcement_bar ? `<div class="bg-orange-500 text-white text-center text-sm font-medium py-2 px-4">${s.announcement_bar}</div>` : ''}
    <main>
      <!-- Hero -->
      <section class="nx-container py-12 lg:py-16 2xl:py-20 hero-cover">
        <div class="hero-particles" aria-hidden="true">
        <span style="--x:32.4%;--y:15.1%;--s:9px;--d:9.3s;--t:11.5s;--dx:-56px;--dy:-7px"></span>
        <span style="--x:58.3%;--y:91.0%;--s:5px;--d:9.2s;--t:6.1s;--dx:-63px;--dy:-39px"></span>
        <span style="--x:9.1%;--y:42.5%;--s:8px;--d:9.7s;--t:3.1s;--dx:80px;--dy:49px"></span>
        <span style="--x:94.8%;--y:57.7%;--s:7px;--d:9.3s;--t:3.1s;--dx:62px;--dy:-66px"></span>
        <span style="--x:29.0%;--y:14.4%;--s:4px;--d:12.4s;--t:7.8s;--dx:-34px;--dy:-74px"></span>
        <span style="--x:58.2%;--y:63.9%;--s:6px;--d:9.6s;--t:10.0s;--dx:64px;--dy:-85px"></span>
        <span style="--x:61.9%;--y:49.6%;--s:8px;--d:11.6s;--t:4.4s;--dx:69px;--dy:16px"></span>
        <span style="--x:36.2%;--y:24.8%;--s:5px;--d:13.2s;--t:3.4s;--dx:67px;--dy:-24px"></span>
        <span style="--x:52.5%;--y:87.5%;--s:9px;--d:11.7s;--t:8.5s;--dx:-62px;--dy:-70px"></span>
        <span style="--x:51.2%;--y:16.5%;--s:6px;--d:9.9s;--t:6.8s;--dx:-70px;--dy:71px"></span>
        <span style="--x:7.8%;--y:55.8%;--s:6px;--d:11.0s;--t:4.9s;--dx:47px;--dy:48px"></span>
        <span style="--x:79.7%;--y:6.9%;--s:4px;--d:14.7s;--t:6.6s;--dx:-64px;--dy:-85px"></span>
        <span style="--x:73.1%;--y:31.0%;--s:8px;--d:15.0s;--t:11.5s;--dx:-8px;--dy:83px"></span>
        <span style="--x:38.6%;--y:66.9%;--s:4px;--d:14.6s;--t:5.0s;--dx:76px;--dy:-71px"></span>
        <span style="--x:49.4%;--y:21.8%;--s:6px;--d:9.8s;--t:3.5s;--dx:20px;--dy:27px"></span>
        <span style="--x:8.1%;--y:44.9%;--s:8px;--d:10.7s;--t:1.9s;--dx:30px;--dy:40px"></span>
        <span style="--x:27.8%;--y:41.5%;--s:6px;--d:13.1s;--t:5.3s;--dx:-21px;--dy:-62px"></span>
        <span style="--x:8.3%;--y:15.1%;--s:9px;--d:10.4s;--t:6.8s;--dx:70px;--dy:-54px"></span>
        <span style="--x:26.3%;--y:0.4%;--s:7px;--d:12.2s;--t:8.5s;--dx:1px;--dy:-68px"></span>
        <span style="--x:69.0%;--y:51.5%;--s:8px;--d:12.9s;--t:10.4s;--dx:36px;--dy:99px"></span>
        <span style="--x:95.2%;--y:68.1%;--s:8px;--d:11.4s;--t:5.6s;--dx:-54px;--dy:23px"></span>
        <span style="--x:63.4%;--y:6.2%;--s:4px;--d:14.9s;--t:6.2s;--dx:-52px;--dy:-13px"></span>
        <span style="--x:60.1%;--y:10.2%;--s:8px;--d:9.9s;--t:1.4s;--dx:13px;--dy:57px"></span>
        <span style="--x:2.6%;--y:87.4%;--s:8px;--d:11.3s;--t:8.9s;--dx:8px;--dy:54px"></span>
        <span style="--x:36.4%;--y:12.3%;--s:7px;--d:15.0s;--t:6.5s;--dx:43px;--dy:-21px"></span>
        <span style="--x:8.6%;--y:10.2%;--s:6px;--d:13.4s;--t:6.7s;--dx:-39px;--dy:32px"></span>
        <span style="--x:2.3%;--y:95.1%;--s:8px;--d:11.2s;--t:9.7s;--dx:-74px;--dy:94px"></span>
        <span style="--x:52.8%;--y:97.9%;--s:4px;--d:13.2s;--t:3.7s;--dx:13px;--dy:-58px"></span>
        <span style="--x:35.6%;--y:22.3%;--s:8px;--d:13.7s;--t:4.6s;--dx:-23px;--dy:56px"></span>
        <span style="--x:81.2%;--y:98.5%;--s:5px;--d:13.8s;--t:11.5s;--dx:-22px;--dy:-49px"></span>
        <span style="--x:51.8%;--y:35.6%;--s:4px;--d:14.9s;--t:11.1s;--dx:40px;--dy:-34px"></span>
        <span style="--x:19.4%;--y:60.5%;--s:6px;--d:11.7s;--t:13.1s;--dx:9px;--dy:-7px"></span>
        <span style="--x:8.1%;--y:10.2%;--s:7px;--d:10.2s;--t:2.9s;--dx:79px;--dy:56px"></span>
        <span style="--x:84.0%;--y:47.9%;--s:9px;--d:11.1s;--t:9.0s;--dx:-50px;--dy:-1px"></span>
        <span style="--x:78.2%;--y:75.0%;--s:7px;--d:14.3s;--t:6.1s;--dx:5px;--dy:-78px"></span>
        <span style="--x:80.1%;--y:97.2%;--s:7px;--d:11.8s;--t:10.4s;--dx:-59px;--dy:85px"></span>
        <span style="--x:15.9%;--y:99.3%;--s:4px;--d:9.9s;--t:12.7s;--dx:-43px;--dy:56px"></span>
        <span style="--x:82.7%;--y:98.0%;--s:9px;--d:14.6s;--t:2.2s;--dx:60px;--dy:-67px"></span>
        <span style="--x:2.1%;--y:79.9%;--s:9px;--d:12.9s;--t:7.4s;--dx:-45px;--dy:11px"></span>
        <span style="--x:98.7%;--y:19.5%;--s:5px;--d:9.2s;--t:3.0s;--dx:48px;--dy:-39px"></span>
        <span style="--x:76.4%;--y:32.6%;--s:8px;--d:11.5s;--t:1.8s;--dx:10px;--dy:17px"></span>
        <span style="--x:66.2%;--y:81.5%;--s:8px;--d:11.5s;--t:12.8s;--dx:48px;--dy:-67px"></span>
        <span style="--x:53.2%;--y:52.4%;--s:4px;--d:14.2s;--t:10.9s;--dx:75px;--dy:-99px"></span>
        <span style="--x:77.6%;--y:15.0%;--s:5px;--d:11.8s;--t:10.2s;--dx:62px;--dy:-85px"></span>
        <span style="--x:32.6%;--y:51.8%;--s:8px;--d:11.9s;--t:10.9s;--dx:63px;--dy:-86px"></span>
        <span style="--x:24.8%;--y:27.7%;--s:4px;--d:12.0s;--t:7.9s;--dx:-64px;--dy:13px"></span>
        <span style="--x:32.6%;--y:97.3%;--s:8px;--d:12.1s;--t:9.7s;--dx:35px;--dy:30px"></span>
        <span style="--x:53.3%;--y:47.8%;--s:5px;--d:13.2s;--t:12.3s;--dx:-14px;--dy:43px"></span>
        <span style="--x:89.3%;--y:20.3%;--s:7px;--d:9.8s;--t:1.7s;--dx:33px;--dy:-20px"></span>
        <span style="--x:7.3%;--y:24.1%;--s:4px;--d:10.3s;--t:4.2s;--dx:-49px;--dy:98px"></span>
        <span style="--x:15.4%;--y:71.6%;--s:9px;--d:11.2s;--t:3.5s;--dx:-45px;--dy:19px"></span>
        <span style="--x:22.0%;--y:95.3%;--s:7px;--d:14.3s;--t:2.3s;--dx:-23px;--dy:-59px"></span>
        <span style="--x:70.6%;--y:99.4%;--s:7px;--d:11.0s;--t:2.7s;--dx:1px;--dy:-77px"></span>
        <span style="--x:72.2%;--y:1.9%;--s:8px;--d:11.8s;--t:9.8s;--dx:18px;--dy:-16px"></span>
        <span style="--x:51.7%;--y:29.5%;--s:4px;--d:9.7s;--t:12.9s;--dx:-22px;--dy:-74px"></span>
        <span style="--x:8.4%;--y:27.2%;--s:5px;--d:10.6s;--t:1.8s;--dx:28px;--dy:73px"></span>
        <span style="--x:81.9%;--y:25.9%;--s:5px;--d:12.2s;--t:7.2s;--dx:46px;--dy:79px"></span>
        <span style="--x:32.7%;--y:27.9%;--s:9px;--d:10.1s;--t:12.5s;--dx:-12px;--dy:-96px"></span>
        <span style="--x:63.4%;--y:80.2%;--s:4px;--d:12.6s;--t:3.1s;--dx:-13px;--dy:-69px"></span>
        <span style="--x:45.4%;--y:33.9%;--s:8px;--d:11.5s;--t:12.8s;--dx:79px;--dy:-67px"></span>
        <span style="--x:4.3%;--y:71.0%;--s:4px;--d:14.8s;--t:3.7s;--dx:-34px;--dy:-49px"></span>
        <span style="--x:93.2%;--y:62.9%;--s:8px;--d:13.6s;--t:4.1s;--dx:48px;--dy:72px"></span>
        <span style="--x:17.8%;--y:34.7%;--s:4px;--d:15.0s;--t:0.5s;--dx:-76px;--dy:87px"></span>
        <span style="--x:50.6%;--y:97.8%;--s:8px;--d:11.8s;--t:13.1s;--dx:-53px;--dy:68px"></span>
        <span style="--x:81.9%;--y:43.2%;--s:7px;--d:12.3s;--t:12.4s;--dx:49px;--dy:-22px"></span>
        <span style="--x:68.8%;--y:98.2%;--s:6px;--d:10.2s;--t:12.3s;--dx:-45px;--dy:3px"></span>
        <span style="--x:98.9%;--y:98.2%;--s:5px;--d:9.1s;--t:8.8s;--dx:-15px;--dy:10px"></span>
        <span style="--x:16.3%;--y:8.4%;--s:7px;--d:14.2s;--t:9.4s;--dx:-8px;--dy:53px"></span>
        <span style="--x:24.2%;--y:29.3%;--s:7px;--d:10.1s;--t:3.8s;--dx:-80px;--dy:-33px"></span>
        <span style="--x:36.4%;--y:32.9%;--s:8px;--d:10.9s;--t:0.5s;--dx:-1px;--dy:-45px"></span>
        <span style="--x:35.7%;--y:0.1%;--s:7px;--d:9.5s;--t:3.9s;--dx:-29px;--dy:-37px"></span>
        <span style="--x:50.5%;--y:0.5%;--s:6px;--d:13.9s;--t:2.0s;--dx:70px;--dy:-90px"></span>
        <span style="--x:39.4%;--y:30.0%;--s:9px;--d:10.4s;--t:8.2s;--dx:55px;--dy:92px"></span>
        <span style="--x:15.5%;--y:89.3%;--s:8px;--d:11.3s;--t:4.6s;--dx:46px;--dy:-62px"></span>
        <span style="--x:28.4%;--y:61.9%;--s:5px;--d:9.3s;--t:11.7s;--dx:51px;--dy:60px"></span>
        <span style="--x:42.9%;--y:70.1%;--s:8px;--d:9.8s;--t:7.3s;--dx:49px;--dy:45px"></span>
        <span style="--x:83.5%;--y:80.5%;--s:9px;--d:12.5s;--t:12.5s;--dx:-22px;--dy:-79px"></span>
        <span style="--x:3.1%;--y:13.3%;--s:6px;--d:14.8s;--t:5.3s;--dx:35px;--dy:42px"></span>
        <span style="--x:5.1%;--y:1.9%;--s:8px;--d:13.1s;--t:6.9s;--dx:-80px;--dy:16px"></span>
        <span style="--x:79.8%;--y:74.8%;--s:8px;--d:14.4s;--t:1.3s;--dx:54px;--dy:-84px"></span>
        <span style="--x:74.6%;--y:47.4%;--s:4px;--d:14.1s;--t:3.3s;--dx:-28px;--dy:-41px"></span>
        <span style="--x:74.0%;--y:97.6%;--s:7px;--d:14.1s;--t:1.1s;--dx:-7px;--dy:96px"></span>
        <span style="--x:4.7%;--y:63.3%;--s:5px;--d:9.5s;--t:2.1s;--dx:-15px;--dy:66px"></span>
        <span style="--x:74.3%;--y:30.4%;--s:8px;--d:9.8s;--t:6.8s;--dx:44px;--dy:-32px"></span>
        <span style="--x:97.3%;--y:10.0%;--s:5px;--d:13.1s;--t:4.1s;--dx:52px;--dy:-27px"></span>
        <span style="--x:46.5%;--y:46.6%;--s:4px;--d:15.0s;--t:7.7s;--dx:-1px;--dy:-79px"></span>
        <span style="--x:93.6%;--y:1.8%;--s:7px;--d:9.5s;--t:7.1s;--dx:35px;--dy:-32px"></span>
        <span style="--x:38.7%;--y:91.7%;--s:5px;--d:9.4s;--t:1.3s;--dx:54px;--dy:-33px"></span>
        <span style="--x:95.3%;--y:13.3%;--s:9px;--d:12.1s;--t:12.4s;--dx:13px;--dy:-41px"></span>
        <span style="--x:49.8%;--y:87.6%;--s:7px;--d:9.1s;--t:0.1s;--dx:45px;--dy:74px"></span>
        <span style="--x:45.1%;--y:30.2%;--s:5px;--d:11.5s;--t:5.3s;--dx:-50px;--dy:-16px"></span>
        <span style="--x:0.2%;--y:75.1%;--s:7px;--d:9.7s;--t:13.0s;--dx:-77px;--dy:89px"></span>
        <span style="--x:29.0%;--y:37.2%;--s:7px;--d:11.3s;--t:12.2s;--dx:-61px;--dy:-8px"></span>
        <span style="--x:92.5%;--y:75.6%;--s:4px;--d:10.7s;--t:0.7s;--dx:-7px;--dy:62px"></span>
        <span style="--x:93.6%;--y:24.9%;--s:6px;--d:11.6s;--t:4.4s;--dx:15px;--dy:100px"></span>
        <span style="--x:95.6%;--y:88.4%;--s:9px;--d:11.4s;--t:12.3s;--dx:61px;--dy:40px"></span>
        <span style="--x:20.3%;--y:8.1%;--s:9px;--d:11.5s;--t:8.6s;--dx:-45px;--dy:64px"></span>
        <span style="--x:86.9%;--y:48.6%;--s:8px;--d:9.8s;--t:6.6s;--dx:7px;--dy:-28px"></span>
        <span style="--x:29.8%;--y:73.9%;--s:9px;--d:10.6s;--t:9.2s;--dx:-3px;--dy:23px"></span>
        <span style="--x:55.7%;--y:39.4%;--s:5px;--d:12.9s;--t:1.1s;--dx:48px;--dy:27px"></span>
      </div>
        <div class="flex flex-col lg:grid lg:grid-cols-2 gap-8 lg:gap-10 2xl:gap-16 items-center hero-grid">
          <div>
            <h1 class="text-4xl sm:text-5xl 2xl:text-6xl font-extrabold text-gray-900 leading-tight mb-4">
              Trade <span class="text-orange-500">Smarter</span>,<br>Not Harder.
            </h1>
            <p class="text-gray-500 text-lg mb-8">Join thousands of traders worldwide. Start your journey today — copy top strategies, follow live markets, and grow at your own pace.</p>
            <div class="flex flex-col sm:flex-row gap-3 mb-6">
              <a href="/register" class="btn-primary text-center text-lg py-4" style="max-width:320px">Sign Up</a>
            </div>
            <p class="text-sm text-gray-500">Already have an account? <a href="/login" class="text-orange-500 font-semibold">Log In</a></p>
            <div class="flex gap-4 mt-8">
              ${['SECURE|Account security|🛡️','FAST|Instant execution|⚡','TRUSTED|Trader profiles|🏆'].map(x=>{const[t,s,e]=x.split('|');return`<div class="flex items-center gap-2 text-sm"><span class="w-8 h-8 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-base">${e}</span><div><div class="font-bold text-xs">${t}</div><div class="text-gray-400 text-xs">${s}</div></div></div>`;}).join('')}
            </div>
          </div>
          <div class="relative h-80 lg:h-96 2xl:h-[28rem]">${heroImg}
            <div class="hero-smoke" aria-hidden="true"><span style="--x:78%;--y:15%;--w:380px;--h:240px;--d:18s;--t:0s;--dx:-800px;--dy:0px;--br:48% 52% 55% 45% / 52% 48% 55% 45%;--sway:34px"></span><span style="--x:85%;--y:30%;--w:440px;--h:280px;--d:20s;--t:4s;--dx:-900px;--dy:0px;--br:55% 45% 48% 52% / 45% 55% 48% 52%;--sway:42px"></span><span style="--x:72%;--y:45%;--w:340px;--h:220px;--d:16s;--t:8s;--dx:-650px;--dy:0px;--br:45% 55% 52% 48% / 55% 45% 52% 48%;--sway:28px"></span><span style="--x:90%;--y:20%;--w:400px;--h:250px;--d:22s;--t:2s;--dx:-850px;--dy:0px;--br:52% 48% 45% 55% / 48% 52% 55% 45%;--sway:38px"></span><span style="--x:80%;--y:35%;--w:360px;--h:230px;--d:19s;--t:6s;--dx:-950px;--dy:0px;--br:50% 50% 58% 42% / 42% 58% 50% 50%;--sway:46px"></span><span style="--x:88%;--y:50%;--w:320px;--h:210px;--d:17s;--t:10s;--dx:-700px;--dy:0px;--br:58% 42% 50% 50% / 50% 50% 42% 58%;--sway:30px"></span><span style="--x:70%;--y:25%;--w:360px;--h:220px;--d:21s;--t:12s;--dx:-750px;--dy:0px;--br:45% 55% 48% 52% / 52% 48% 45% 55%;--sway:36px"></span><span style="--x:92%;--y:40%;--w:340px;--h:220px;--d:15s;--t:14s;--dx:-880px;--dy:0px;--br:52% 48% 55% 45% / 45% 55% 48% 52%;--sway:40px"></span></div>
            <div class="hero-img-anim" aria-hidden="true"><span style="--ox:78%;--oy:15%;--s:5px;--d:3.2s;--t:0.2s;--dx:-260px;--dy:-90px"></span><span style="--ox:85%;--oy:25%;--s:4px;--d:2.8s;--t:1.1s;--dx:-320px;--dy:-40px"></span><span style="--ox:90%;--oy:35%;--s:6px;--d:3.6s;--t:0.5s;--dx:-180px;--dy:60px"></span><span style="--ox:75%;--oy:45%;--s:4px;--d:3.0s;--t:2.0s;--dx:-300px;--dy:-100px"></span><span style="--ox:88%;--oy:55%;--s:5px;--d:3.4s;--t:0.8s;--dx:-240px;--dy:80px"></span><span style="--ox:82%;--oy:65%;--s:3px;--d:2.6s;--t:1.5s;--dx:-350px;--dy:-60px"></span><span style="--ox:92%;--oy:75%;--s:6px;--d:3.8s;--t:0.3s;--dx:-200px;--dy:-110px"></span><span style="--ox:76%;--oy:85%;--s:4px;--d:3.1s;--t:2.4s;--dx:-280px;--dy:-30px"></span><span style="--ox:86%;--oy:20%;--s:5px;--d:2.9s;--t:1.8s;--dx:-160px;--dy:100px"></span><span style="--ox:80%;--oy:30%;--s:3px;--d:3.3s;--t:0.6s;--dx:-380px;--dy:20px"></span><span style="--ox:94%;--oy:50%;--s:4px;--d:2.7s;--t:2.8s;--dx:-220px;--dy:-80px"></span><span style="--ox:72%;--oy:60%;--s:6px;--d:3.5s;--t:1.3s;--dx:-300px;--dy:50px"></span><span style="--ox:89%;--oy:70%;--s:4px;--d:3.0s;--t:0.1s;--dx:-260px;--dy:-120px"></span><span style="--ox:84%;--oy:80%;--s:5px;--d:3.2s;--t:1.9s;--dx:-340px;--dy:40px"></span><span style="--ox:77%;--oy:40%;--s:3px;--d:2.8s;--t:2.6s;--dx:-190px;--dy:90px"></span><span style="--ox:91%;--oy:10%;--s:4px;--d:3.4s;--t:0.7s;--dx:-280px;--dy:70px"></span><span style="--ox:73%;--oy:90%;--s:5px;--d:3.6s;--t:1.4s;--dx:-320px;--dy:-50px"></span><span style="--ox:87%;--oy:90%;--s:3px;--d:2.9s;--t:2.2s;--dx:-240px;--dy:-90px"></span><span style="--ox:79%;--oy:55%;--s:6px;--d:3.1s;--t:0.4s;--dx:-360px;--dy:10px"></span><span style="--ox:93%;--oy:25%;--s:4px;--d:3.3s;--t:1.7s;--dx:-200px;--dy:110px"></span><span style="--ox:81%;--oy:75%;--s:5px;--d:2.7s;--t:2.9s;--dx:-300px;--dy:-70px"></span><span style="--ox:74%;--oy:22%;--s:4px;--d:3.5s;--t:1.0s;--dx:-250px;--dy:60px"></span></div>
            <div class="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-3" style="z-index:2">
              <div class="bg-white rounded-xl p-3 shadow-lg"><div class="text-xs text-gray-400 font-semibold">BITCOIN · BTC/USD</div><div class="text-lg font-bold" id="hero-btc-price">$75,907</div><div class="text-xs text-green-500 font-semibold" id="hero-btc-change">▲ Live market</div></div>
              <div class="bg-white rounded-xl p-3 shadow-lg"><div class="text-xs text-gray-400 font-semibold">GOLD · XAU/USD</div><div class="text-lg font-bold" id="hero-xau-price">$3,936.10</div><div class="text-xs text-red-500 font-semibold" id="hero-xau-change">▼ −0.37% today</div></div>
            </div>
          </div>
        </div>
      </section>
      <!-- LIVE MARKETS pill: centered between hero and streaming ticker -->
      <div class="flex justify-center py-2">
        <div class="inline-flex items-center gap-2 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-full">
          <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> LIVE MARKETS
        </div>
      </div>
      <!-- Ticker: official TradingView Ticker Tape, real-time + auto-scrolling.
           The script tag is NOT put in innerHTML (it would not execute), it is
           appended dynamically at the end of Pages.landing. If TradingView
           cannot load, the fallback marquee below shows and is honestly
           labelled as unavailable, never passed off as live. -->
      <style>
        /* Golden particles: spread across the WHOLE hero cover (like the first version),
           soft gentle float in every direction. */
        .hero-cover{position:relative;overflow:hidden}
        .hero-cover .hero-grid{position:relative;z-index:1}
        .hero-particles{position:absolute;inset:0;overflow:hidden;pointer-events:none}
        .hero-particles span{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);border-radius:9999px;background:radial-gradient(circle,#FDE68A 0%,#F59E0B 70%,transparent 100%);opacity:0;animation:particleFloat var(--d) ease-in-out infinite;animation-delay:var(--t)}
        @keyframes particleFloat{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:.9}50%{transform:translate(calc(var(--dx)*.5),calc(var(--dy)*.5)) scale(1);opacity:.6}75%{transform:translate(calc(var(--dx)*.8),calc(var(--dy)*.8)) scale(.9);opacity:.3}100%{transform:translate(var(--dx),var(--dy)) scale(.6);opacity:0}}
        /* Animated smoke from the coins — REALISTIC + CONFINED: the smoke layer
           lives INSIDE the hero-image box (left:-100% so it reaches left to the
           "Trade Smarter" headline, right:0/bottom:0 + overflow hidden so it is
           never seen below the image or past its right edge), and sits BELOW the
           BTC/XAU price cards (z-1 < cards z-2) so it never covers them. Each
           wisp is an irregular blob (--br) with a warm core fading to a cool
           edge; it curls left (rotation + --sway) and thins out (blur 32->64px) and melts into the image (mix-blend-mode:screen). */
        .hero-smoke{position:absolute;left:-100%;right:0;top:0;bottom:0;overflow:hidden;pointer-events:none;z-index:1}
        .hero-smoke span{position:absolute;left:var(--x);top:var(--y);width:var(--w);height:var(--h);border-radius:var(--br,50%);background:radial-gradient(ellipse at center,rgba(251,191,36,.25) 0%,rgba(249,115,22,.12) 30%,rgba(251,191,36,.05) 55%,transparent 75%);filter:blur(32px);opacity:0;mix-blend-mode:screen;animation:smokeDrift var(--d) ease-in-out infinite;animation-delay:var(--t)}
        @keyframes smokeDrift{0%{transform:translate(0,0) scale(.5) rotate(0deg);opacity:0;filter:blur(32px)}20%{opacity:.55}40%{transform:translate(calc(var(--dx)*.4),var(--sway)) scale(.9) rotate(6deg);opacity:.45;filter:blur(42px)}65%{transform:translate(calc(var(--dx)*.75),calc(var(--sway)*.5)) scale(1.2) rotate(-5deg);opacity:.28;filter:blur(52px)}90%{opacity:.1}100%{transform:translate(var(--dx),0px) scale(1.55) rotate(4deg);opacity:0;filter:blur(64px)}}
        @media (prefers-reduced-motion: reduce){.hero-smoke span{animation:none}}
        @media (prefers-reduced-motion: reduce){.hero-particles span{animation:none}}
        /* Fire sparks ON the hero image only: sparks burst out of the coin-stack
           joints (right side) and fly across the image like embers, covering it.
           The container is overflow:hidden + rounded, so NO spark ever leaves
           the image. Layer order: image (bottom) < sparks < BTC/XAU price
           cards (top, z-index 2). */
        .hero-img-anim{position:absolute;inset:0;overflow:hidden;border-radius:1rem;pointer-events:none;z-index:1}
        .hero-img-anim span{position:absolute;left:var(--ox);top:var(--oy);width:var(--s);height:var(--s);border-radius:9999px;background:radial-gradient(circle,#FFFBEB 0%,#FDBA74 35%,#F97316 65%,transparent 100%);box-shadow:0 0 10px 2px rgba(249,115,22,.55);opacity:0;animation:sparkFly var(--d) ease-out infinite;animation-delay:var(--t)}
        @keyframes sparkFly{0%{transform:translate(0,0) scale(.7);opacity:0}8%{opacity:1}60%{opacity:.85}100%{transform:translate(var(--dx),var(--dy)) scale(.15);opacity:0}}
        @media (prefers-reduced-motion: reduce){.hero-img-anim span{animation:none}}
        .nx-ticker-wrap{display:flex;align-items:stretch;background:#111827;color:#fff;overflow:hidden;border-radius:12px}
        .nx-ticker-scroll{flex:1;min-width:0}
        .nx-ticker-scroll .tradingview-widget-container__widget{height:46px}
        .nx-streaming{flex-shrink:0;display:flex;align-items:center;gap:6px;padding:0 16px;color:#4ADE80;font-size:13px;font-weight:700;white-space:nowrap;border-left:1px solid #374151}
        .nx-fallback-track{display:flex;gap:32px;white-space:nowrap;animation:nxTickerScroll 30s linear infinite;padding:12px 0;font-size:14px}
        .nx-fallback-track:hover{animation-play-state:paused}
        @keyframes nxTickerScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
      </style>
      <div class="nx-container py-4">
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
      </div>
      <!-- Quick actions -->
      <section class="nx-container py-10">
        <h2 class="text-xl font-bold mb-6">Quick actions</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          ${[['⭐','Promotion','NEW',"App.navigate('/promotion')"],['📰','News','',"App.navigate('/news')"],['📅','Schedule','',"App.navigate('/schedule')"],['📹','Webinar','',"window.open('https://www.youtube.com/@nexorafx00','_blank')"]].map(([e,l,b,a])=>`<div onclick="${a}" class="card hover:shadow-md transition-shadow cursor-pointer flex flex-col items-center gap-2 py-6 relative">${b?`<span class="absolute top-3 right-3 orange-tag">${b}</span>`:''}<span class="text-3xl">${e}</span><span class="text-sm font-semibold text-gray-600">${l}</span></div>`).join('')}
        </div>
      </section>
      <!-- Where We Work (brokers & exchanges) — shared with the user dashboard (Components.whereWeWork). -->
      <section class="nx-container py-10">
          ${Components.whereWeWork()}
      </section>
      <!-- Download app -->
      <section class="nx-container pb-10">
        <div class="flex justify-center">
          <a href="https://github.com/ctravelzone-prog/nexora-fx/releases/download/v1.4.2-android/NexoraFX-1.4.2.apk" class="inline-flex items-center gap-3 bg-gray-900 text-white rounded-2xl px-5 py-3 text-sm font-semibold" style="max-width:280px">
            <span>📱</span> Download Android App
          </a>
        </div>
      </section>
      <!-- Footer -->
      <footer class="border-t border-gray-100 py-10 mt-6">
        <div class="nx-container">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-2"><img src="${s.logo_url||'/assets/logo-nx-mark-transparent.png'}" style="height:28px" alt="NX"><span class="font-bold">${Components.brandNameHtml()}</span></div>
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

  // Ticker section: load the official TradingView Ticker Tape widget
  // (real-time data). innerHTML script tags do not execute, so the
  // script is created here and appended after render.
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

  // Hero price cards: live BTC + XAU prices, refreshed every 5s from
  // /api/market/quotes. The values in the markup are samples; they are
  // replaced as soon as live data arrives.
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
    // Flash a price green (up) or red (down) briefly on each change.
    function flash(el, up){
      el.style.transition = 'color .45s, transform .45s';
      el.style.color = up ? '#16A34A' : '#DC2626';
      el.style.transform = up ? 'translateY(-3px) scale(1.05)' : 'translateY(3px) scale(1.05)';
      (function(e2){ setTimeout(function(){ e2.style.color=''; e2.style.transform=''; }, 900); })(el);
    }
    // Format a price as a dollar string with fixed decimals.
    function fmt(price, decimals){
      return '$' + price.toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
    }
    // Write a price into a hero card, flashing on change. Non-numbers
    // are ignored so a bad tick never blanks the card.
    function setPrice(priceId, price, decimals){
      var p = document.getElementById(priceId);
      if(!p || typeof price !== 'number') return;
      var old = prevPrice[priceId];
      if(typeof old === 'number' && price !== old) flash(p, price > old);
      prevPrice[priceId] = price;
      p.textContent = fmt(price, decimals);
    }
    // Write the 24h change text into a hero card; without a number
    // it falls back to a plain "Live market" label.
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
    // Update one hero card (price + change) from a quote object.
    function setCard(priceId, changeId, q, decimals){
      if(!q || typeof q.price !== 'number') return;
      setPrice(priceId, q.price, decimals);
      setChange(changeId, q.change);
    }
    // Update the ticker fallback marquee (price + change) for a quote.
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
    // Update only the price text in the ticker fallback marquee.
    function setFallbackPrice(priceCls, price, decimals){
      if(typeof price !== 'number') return;
      var txt = fmt(price, decimals);
      document.querySelectorAll('.'+priceCls).forEach(function(el){ el.textContent = txt; });
    }
    // BTC price: Binance public trade stream (wss). Reconnects 5s
    // after a close; the REST poll below covers any gap.
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
    // REST poll (every 5s) for /api/market/quotes. It owns the price
    // only when the faster live sources have gone quiet; otherwise it
    // refreshes just the change text and the fallback marquee.
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
