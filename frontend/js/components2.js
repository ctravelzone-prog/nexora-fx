/*
 * components2.js - Shared layout components for the Nexora FX user site.
 * What it does: builds the public top bar, the logged-in sidebar and page
 * header (with the notification bell), the mobile bottom nav, and the
 * overall page layout that every Pages.* handler renders into.
 * Key functions: brandNameHtml(), topbarPublic(), publicLayout(),
 * navLink(), openSidebar(), closeSidebar(), sidebar(), appHeader(),
 * toggleBell(), bellItemClick(), updateBellBadge(), markAllRead(),
 * bottomNav(), layout().
 * Important rules: the brand name comes from admin settings (last word
 * orange unless per-word colors are set); the bell badge caps at "9+";
 * the sidebar is fixed on desktop and slides in on mobile. Money is
 * integer cents; display it only through utils.fmtMoney().
 */
const Components={
  // Brand name from admin settings: last word in orange (the Nexora FX style).
  // Brand name HTML from admin settings. Per-word colors (JSON array of
  // hex colors, one per word) win; otherwise the last word is orange.
  brandNameHtml(){
    const s=(typeof App!=='undefined'&&App.state&&App.state.settings)||{};
    const brand=(((s.header_brand_name||'Nexora FX').trim())||'Nexora FX');
    const parts=brand.split(/\s+/);
    // Per-word colors (set in Admin > Site Settings / CMS > Header / Top Bar).
    // Stored as a JSON array of hex colors, one per word. Fallback: last word orange.
    let colors=null;
    try{ colors=JSON.parse(s.header_brand_word_colors||'null'); }catch(e){ colors=null; }
    if(Array.isArray(colors)&&colors.length===parts.length&&colors.every(c=>/^#[0-9a-fA-F]{6}$/.test(c||''))){
      return parts.map((w,i)=>'<span style="color:'+colors[i]+'">'+w+'</span>').join(' ');
    }
    const last=parts.pop();const first=parts.join(' ');
    return first?first+' <span class="text-orange-500">'+last+'</span>':'<span class="text-orange-500">'+last+'</span>';
  },
  // Where We Work — the broker/exchange cards (Binance, Exness, Bybit, XM).
  // Shared by the landing page and the user dashboard (chart -> this ->
  // Referral). The .broker-card styles live in css/app.css so both pages
  // get the liquid-glass look + shine sweep.
  whereWeWork(){
    const brokers=[
      {name:'Binance',type:'Crypto Exchange',logo:'/assets/brokers/binance.svg',box:'bg-white',accent:'#F3BA2F',features:['World\u2019s largest crypto exchange','Low trading fees','Deep liquidity','Binance Pay for fast deposits']},
      {name:'Exness',type:'Forex Broker',logo:'/assets/brokers/exness.svg',box:'bg-white',accent:'#141D22',features:['Ultra-tight spreads','Instant withdrawals','Regulated & trusted','Lightning-fast execution']},
      {name:'Bybit',type:'Crypto Exchange',logo:'/assets/brokers/bybit.svg',box:'bg-white',accent:'#F6A500',features:['Top crypto derivatives exchange','Low fees & deep liquidity','Advanced trading tools','Fast, reliable platform']},
      {name:'XM',type:'Forex Broker',logo:'/assets/brokers/xm.jpg',box:'bg-black',accent:'#E11D2E',features:['Regulated in multiple regions','Wide range of instruments','Tight spreads','Trusted by traders worldwide']},
    ];
    return '<h2 class="text-2xl font-bold">Where We Work</h2>'
      + '<p class="text-sm text-gray-500 mt-1 mb-6">Nexora connects your copy trading to the world\u2019s leading brokers and exchanges.</p>'
      + '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">'
      + brokers.map(b=>'<div class="broker-card p-5 pb-8 flex flex-col">'
        + '<div class="rounded-xl h-16 flex items-center justify-center p-3 shadow-sm mb-4 '+b.box+'">'
        + '<img src="'+b.logo+'" alt="'+b.name+' logo" class="max-h-10 max-w-full object-contain" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.querySelector(\'.logo-fallback\').style.display=\'flex\'">'
        + '<span class="logo-fallback hidden items-center justify-center w-10 h-10 rounded-full text-white text-lg font-bold" style="background:'+b.accent+'">'+b.name[0]+'</span>'
        + '</div>'
        + '<div class="flex items-center gap-2 mb-1"><h3 class="text-lg font-bold">'+b.name+'</h3><span class="text-[11px] font-semibold px-2 py-0.5 rounded-full '+(b.type==='Crypto Exchange'?'bg-orange-100 text-orange-600':'bg-blue-100 text-blue-600')+'">'+b.type+'</span></div>'
        + '<ul class="mt-2 space-y-2">'+b.features.map(f=>'<li class="flex items-start gap-2 text-sm text-gray-600"><span class="text-orange-500 font-bold leading-5">\u2713</span><span>'+f+'</span></li>').join('')+'</ul>'
        + '</div>').join('')
      + '</div>';
  },
  // Public top bar (landing, login, register): logo, brand name,
  // tagline and Log In / Sign Up buttons, all controlled by admin settings.
  topbarPublic(page){
    const s=App.state.settings;
    const logo='<img src="'+(s.logo_url||'/assets/logo-nx-mark-transparent.png')+'" style="height:32px" alt="NX">';
    const tagline=s.header_tagline===undefined?'COPY TRADING PLATFORM':s.header_tagline;
    const showLogin=s.header_show_login!=='0';
    const showSignup=s.header_show_signup!=='0';
    const bg=s.header_bg||'#FFFFFF';
    let right='';
    if(page==='login'){ if(showSignup) right='<a href="/register" class="btn-primary text-sm" style="padding:8px 20px;width:auto">Sign Up</a>'; }
    else if(page==='register'){ if(showLogin) right='<a href="/login" class="font-semibold text-sm text-gray-700">Log In</a>'; }
    else{
      if(showLogin) right+='<a href="/login" class="font-semibold text-sm text-gray-700 mr-3">Log In</a>';
      if(showSignup) right+='<a href="/register" class="btn-primary text-sm" style="padding:8px 20px;width:auto">Sign Up</a>';
    }
    return '<header class="border-b border-gray-100 sticky top-0 z-30" style="background:'+bg+'"><div class="nx-container py-3 flex items-center justify-between"><a href="/" class="flex items-center gap-2">'+logo+'<div><div class="font-bold text-base">'+Components.brandNameHtml()+'</div>'+(tagline?'<div class="text-xs text-gray-400 hidden sm:block">'+tagline+'</div>':'')+'</div></a><div class="flex items-center gap-2">'+right+'</div></div></header>';
  },
  // Public page layout (no login needed): public header + content + back link.
  // Used by News / Schedule / Promotion so visitors can open them from the landing page.
  publicLayout(html){
    document.getElementById('app').innerHTML=Components.topbarPublic('')+'<main class="nx-container py-8">'+html+'</main>';
  },
  // One sidebar link. Adds the active class when its href matches the
  // current path, and closes the mobile sidebar on tap.
  navLink(href,label,icon){
    const active=window.location.pathname===href;
    return '<a href="'+href+'" onclick="Components.closeSidebar()" class="sidebar-link'+(active?' active':'')+'">'+icon+'<span>'+label+'</span></a>';
  },
  // Open the mobile sidebar and lock page scrolling behind it.
  openSidebar(){
    const s=document.getElementById('sidebar'),o=document.getElementById('sb-ov');
    if(s)s.classList.add('open');
    if(o)o.classList.add('show');
    document.body.style.overflow='hidden';
  },
  // Close the mobile sidebar and restore page scrolling. Called on
  // every navigation in App.route() so the page never stays locked.
  closeSidebar(){
    const s=document.getElementById('sidebar'),o=document.getElementById('sb-ov');
    if(s)s.classList.remove('open');
    if(o)o.classList.remove('show');
    document.body.style.overflow='';
  },
  // Logged-in sidebar: logo + brand, grouped nav links (General, Stake,
  // Finance, Referral, Account) and a red Sign Out button at the bottom.
  sidebar(){
    const u=App.state.user||{};
    const xbtn='<button class="ml-auto p-1 lg:hidden text-gray-400 hover:text-gray-700" onclick="Components.closeSidebar()"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M6 18L18 6M6 6l12 12"/></svg></button>';
    const links=[
      ['General',''],
      ['/dashboard','Dashboard',svgIcons.dashboard],
      ['/history','Transactions',svgIcons.list],
      ['Stake',''],
      ['/copy-trade','Copy Trade',svgIcons.copy],
      ['/my-copies','My Copies',svgIcons.layers],
      ['/copy-history','Copy History',svgIcons.history],
      ['/trade-history','Trade History',svgIcons.chart],
      ['Finance',''],
      ['/deposit','Create Deposit',svgIcons.deposit],
      ['/withdraw','Withdraw',svgIcons.withdraw],
      ['/request-money','Request Money',svgIcons.deposit],
      ['Referral',''],
      ['/referred-users','Referred Users',svgIcons.users],
      ['/referral-commissions','Commissions',svgIcons.commission],
      ['/friends','Friends',svgIcons.friends],
      ['Account',''],
      ['/edit-profile','Edit Profile',svgIcons.profile],
      ['/kyc','KYC Verification',svgIcons.kyc],
      ['/2fa','2FA Security',svgIcons.lock],
      ['/change-password','Change Password',svgIcons.password],
      ['/support','Support Tickets',svgIcons.support],
      ['/notifications','Notifications',svgIcons.bell],
      ['/risk-terms','Risk & Terms',svgIcons.info],
    ];
    let nav='';
    for(const l of links){
      if(l[1]==='') nav+='<div class="sidebar-group">'+l[0]+'</div>';
      else nav+=Components.navLink(l[0],l[1],l[2]);
    }
    return '<aside class="sidebar" id="sidebar">'
      +'<div class="p-4 border-b border-gray-100 flex items-center gap-3">'
      +'<img src="'+(App.state.settings.logo_url||'/assets/logo-nx-mark-transparent.png')+'" style="height:40px;width:40px;object-fit:contain" alt="Nexora FX">'
      +'<div class="min-w-0 flex-1"><div class="font-extrabold text-xl leading-none">'+Components.brandNameHtml()+'</div></div>'
      +xbtn+'</div>'
      +'<nav class="flex-1 py-2 overflow-y-auto text-sm">'+nav+'</nav>'
      +'<div class="p-3 border-t border-gray-100"><button onclick="App.logout()" class="sidebar-link w-full" style="color:#EF4444">'+svgIcons.logout+'<span>Sign Out</span></button></div>'
      +'</aside>'
      +'<div class="sidebar-overlay" id="sb-ov" onclick="Components.closeSidebar()"></div>';
  },
};


// Page header for logged-in pages: menu button (mobile), title,
// notification bell with unread badge, profile avatar and Sign Out.
Components.appHeader=function(title,sub){
  const u=App.state.user||{}, n=App.state.unreadCount||0;
  const bellBadge=n>0?'<span id=\"bell-badge\" class="absolute top-0.5 right-0.5 w-4 h-4 bg-orange-500 text-white rounded-full" style="font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700">'+(n>9?'9+':n)+'</span>':'';
  return '<div class="page-header"><div class="flex items-center gap-3">'
    +'<button class="p-2 rounded-xl hover:bg-gray-100 lg:hidden" onclick="Components.openSidebar()">'+svgIcons.menu+'</button>'
    +'<div><h1 class="text-base font-bold leading-tight">'+(title||'')+'</h1>'+(sub?'<p class="text-xs hidden sm:block" style="color:var(--muted)">'+sub+'</p>':'')+'</div></div>'
    +'<div class="flex items-center gap-2" style="position:relative">'
      +'<button class="relative p-2 rounded-xl hover:bg-gray-100" id="bell-btn" onclick="Components.toggleBell(event)">'+svgIcons.bell+bellBadge+'</button>'
      +'<div id="bell-dd" style="display:none;position:absolute;top:calc(100% + 8px);right:0;width:320px;max-width:calc(100vw - 32px);background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.15);border:1px solid var(--border);z-index:100;overflow:hidden">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--border)"><span style="font-weight:800;font-size:14.5px;color:var(--ink)">Notifications</span><button onclick="Components.markAllRead()" style="font-size:12px;font-weight:700;color:var(--orange);border:none;background:none;cursor:pointer;font-family:inherit">Mark all read</button></div>'
        +'<div id="bell-list" style="overflow-y:auto;max-height:280px"></div>'
        +'<div style="border-top:1px solid var(--border);padding:10px 16px;text-align:center"><button onclick="App.navigate(\'/notifications\');Components.closeBell()" style="font-size:13px;font-weight:700;color:var(--orange);border:none;background:none;cursor:pointer;font-family:inherit;width:100%">View All Notifications →</button></div>'
      +'</div>'
      +'<button onclick="App.navigate(\'/edit-profile\')" class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">'+utils.avatar(u.full_name||'',u.profile_photo,32)+'</button>'
      +'<button onclick="App.logout()" title="Sign Out" class="p-2 rounded-xl hover:bg-gray-100 flex-shrink-0" style="color:#EF4444">'+svgIcons.logout+'</button>'
    +'</div></div>';
};
// Open/close the notification dropdown. On open it loads the latest
// notifications via GET /api/user/notifications (shows at most 8).
Components.toggleBell=function(e){
  e.stopPropagation();
  const dd=document.getElementById('bell-dd');
  if(!dd)return;
  const isOpen=dd.style.display!=='none';
  if(isOpen){dd.style.display='none';return;}
  dd.style.display='block';
  // Load notifications into dropdown
  const list=document.getElementById('bell-list');
  if(list)list.innerHTML='<div style="padding:16px;text-align:center"><div class="spinner page-loader"></div></div>';
  api.getNotifications().then(function(d){
    App.state.unreadCount=d.unread_count||0;
    Components.updateBellBadge();
    if(!list)return;
    if(!d.notifications.length){list.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No notifications</p>';return;}
    // Show only the 8 most recent notifications in the dropdown.
    list.innerHTML=d.notifications.slice(0,8).map(function(n){
      // Icon and colors per notification type (success / warning / info).
    // Icon and colors per notification type (success / warning / info).
    const icon=n.type==='success'?'✓':n.type==='warning'?'⚠':'ℹ';
      const color=n.type==='success'?'#ECFDF5;color:#059669':n.type==='warning'?'#FFFBEB;color:#B45309':'#EFF6FF;color:#2563EB';
      return '<div onclick="Components.bellItemClick('+n.id+',\''+( n.action_url||'/notifications')+'\')" style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;'+(n.is_read?'':'background:#FAFAFA;')+'hover:background:var(--bg2)">'
        +'<div style="width:32px;height:32px;border-radius:10px;flex:none;display:grid;place-items:center;font-size:13px;background:'+color+'">'+icon+'</div>'
        +'<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:'+(n.is_read?'500':'700')+';color:var(--ink);line-height:1.4">'+n.title+'</div>'
        +'<div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+utils.timeAgo(n.created_at)+'</div></div>'
        +(n.is_read?'':'<div style="width:8px;height:8px;border-radius:50%;background:var(--orange);flex:none;margin-top:4px"></div>')
      +'</div>';
    }).join('');
  }).catch(function(){if(list)list.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted)">Error loading</p>';});
  // Close on outside click
  setTimeout(function(){document.addEventListener('click',Components._bellOutside,{once:true});},10);
};
// Close the bell dropdown when the user clicks anywhere outside it.
Components._bellOutside=function(e){
  const dd=document.getElementById('bell-dd');
  const btn=document.getElementById('bell-btn');
  if(dd&&!dd.contains(e.target)&&btn&&!btn.contains(e.target)){dd.style.display='none';}
};
// Hide the notification dropdown without loading anything.
Components.closeBell=function(){const dd=document.getElementById('bell-dd');if(dd)dd.style.display='none';};
// A notification was tapped: mark it read, drop the unread count by one,
// close the dropdown, then navigate to its action URL (or /notifications).
Components.bellItemClick=function(id,url){
  api.request('PUT','/api/user/notifications/'+id+'/read').catch(function(){});
  App.state.unreadCount=Math.max(0,(App.state.unreadCount||1)-1);
  Components.updateBellBadge();
  Components.closeBell();
  if(url&&url!='/notifications')App.navigate(url);
  else App.navigate('/notifications');
};
// Keep the bell badge in sync without a page navigation. The header HTML is
// rendered once, so changing App.state.unreadCount alone never moves the badge.
Components.updateBellBadge=function(){
  var b=document.getElementById('bell-badge');
  var n=App.state.unreadCount||0;
  if(n>0){
    if(b){ b.textContent=(n>9?'9+':n); b.style.display='flex'; }
    else{
      var btn=document.getElementById('bell-btn');
      if(btn){
        var s=document.createElement('span');
        s.id='bell-badge';
        s.className='absolute top-0.5 right-0.5 w-4 h-4 bg-orange-500 text-white rounded-full';
        s.style.cssText='font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700';
        s.textContent=(n>9?'9+':n);
        btn.appendChild(s);
      }
    }
  } else if(b){ b.remove(); }
};
// Live bell poll: refresh the unread count every 15s while logged in, so
// admin actions (deposit approved, KYC, profit...) show on the bell and
// as a toast without a page reload. 15s = 60 calls per 15 min, well inside
// the 200-request user rate limit. Skips hidden tabs; stops after 3
// consecutive failures (e.g. token expired).
Components._bellPoll=null;
Components._bellPollFails=0;
Components.startBellPoll=function(){
  if(Components._bellPoll)return;
  if(typeof utils==='undefined'||!utils.isLoggedIn())return;
  var tick=function(){
    if(document.hidden)return;
    api.getNotifications().then(function(d){
      Components._bellPollFails=0;
      var prev=App.state.unreadCount||0;
      var now=d.unread_count||0;
      App.state.unreadCount=now;
      Components.updateBellBadge();
      if(now>prev){
        var dd=document.getElementById('bell-dd');
        var newest=null;var list=d.notifications||[];
        for(var i=0;i<list.length;i++){if(!list[i].is_read){newest=list[i];break;}}
        if(newest&&(!dd||dd.style.display==='none')){
          try{utils.toast(newest.title,'success');}catch(e){}
        }
      }
    }).catch(function(){
      Components._bellPollFails=(Components._bellPollFails||0)+1;
      if(Components._bellPollFails>=3&&Components._bellPoll){clearInterval(Components._bellPoll);Components._bellPoll=null;}
    });
  };
  Components._bellPollTick=tick;
  tick();
  Components._bellPoll=setInterval(tick,15000);
};
// Live push: a persistent WebSocket to /ws/live, so an admin action
// (deposit approved, profit, KYC, reply...) shows on the user's bell +
// toast the moment it is sent — not after the 15-second bell poll. On a
// push it runs the same bell tick as the poller (badge + newest toast),
// so the two paths can never disagree. Reconnects with backoff; a 1008
// close means a dead token — stop (the bell poll stops too when logged out).
Components._livePush=null;
Components._livePushDelay=2000;
Components.startLivePush=function(){
  if(Components._livePush||typeof WebSocket==='undefined')return;
  if(typeof utils==='undefined'||!utils.isLoggedIn())return;
  var token=null;
  try{token=api.getToken();}catch(e){}
  if(!token)return;
  var url=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/ws/live';
  var ws;
  try{ws=new WebSocket(url);}catch(e){return;}
  Components._livePush=ws;
  ws.onopen=function(){Components._livePushDelay=2000;try{ws.send(JSON.stringify({type:'auth',token:token}));}catch(e){}};
  ws.onmessage=function(ev){
    var m=null;try{m=JSON.parse(ev.data);}catch(e){return;}
    if(!m||m.type!=='notification')return;
    if(typeof Components._bellPollTick==='function'){try{Components._bellPollTick();}catch(e){}}
    else{try{utils.toast(m.title||'New notification','success');}catch(e){}}
  };
  ws.onclose=function(ev){
    Components._livePush=null;
    if(ev&&ev.code===1008)return; // dead token — do not reconnect
    var d=Components._livePushDelay;
    Components._livePushDelay=Math.min(d*2,60000);
    setTimeout(function(){Components.startLivePush();},d);
  };
  ws.onerror=function(){try{ws.close();}catch(e){}};
};
// Mark all notifications read via PUT /api/user/notifications/read-all,
// clear the badge and close the dropdown.
Components.markAllRead=function(){
  api.readAllNotifications().then(function(){
    App.state.unreadCount=0;
    Components.updateBellBadge();
    Components.closeBell();
    utils.toast('All notifications marked as read','success');
  }).catch(function(){});
};
// Mobile bottom nav (Home, Copy, Deposit, Withdraw, Alerts). Hidden on
// desktop by CSS; the Alerts tab carries the unread-count badge.
Components.bottomNav=function(){
  const p=window.location.pathname,n=App.state.unreadCount||0;
  function it(h,lbl,ic,b){
    const badge=b>0?'<span style="position:absolute;top:2px;right:calc(50% - 18px);width:14px;height:14px;background:#FF6A00;color:#fff;border-radius:50%;font-size:8px;display:flex;align-items:center;justify-content:center">'+(b>9?'9+':b)+'</span>':'';
    return '<a href="'+h+'" class="bottom-nav-item'+(p===h?' active':'')+'" style="position:relative">'+ic+badge+'<span>'+lbl+'</span></a>';
  }
  return '<nav class="bottom-nav lg:hidden">'+it('/','Home',svgIcons.home,0)+it('/copy-trade','Copy',svgIcons.copy,0)+it('/deposit','Deposit',svgIcons.deposit,0)+it('/withdraw','Withdraw',svgIcons.withdraw,0)+it('/notifications','Alerts',svgIcons.bell,n)+'</nav>';
};
// Full logged-in page layout: sidebar + header + content + bottom nav.
// Also refreshes the unread notification count for the bell badge.
Components.layout=function(html,title,sub){
  document.getElementById('app').innerHTML=Components.sidebar()+'<div class="with-sidebar">'+Components.appHeader(title,sub)+'<main class="p-4 pb-36 lg:p-6">'+html+'</main></div>'+Components.bottomNav();
  api.getNotifications().then(function(d){App.state.unreadCount=d.unread_count||0;}).catch(function(){});
};
