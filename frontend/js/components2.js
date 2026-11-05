// components2.js Part 1 — topbar + sidebar helpers
const Components={
  topbarPublic(page){
    const s=App.state.settings;
    const logo='<img src="'+(s.logo_url||'/assets/logo-nx-mark-transparent.png')+'" style="height:32px" alt="NX">';
    let right='';
    if(page==='login') right='<a href="/register" class="btn-primary text-sm" style="padding:8px 20px;width:auto">Sign Up</a>';
    else if(page==='register') right='<a href="/login" class="font-semibold text-sm text-gray-700">Log In</a>';
    else right='<a href="/login" class="font-semibold text-sm text-gray-700 mr-3">Log In</a><a href="/register" class="btn-primary text-sm" style="padding:8px 20px;width:auto">Sign Up</a>';
    return '<header class="bg-white border-b border-gray-100 sticky top-0 z-30"><div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between"><a href="/" class="flex items-center gap-2">'+logo+'<div><div class="font-bold text-base">Nexora <span class="text-orange-500">FX</span></div><div class="text-xs text-gray-400 hidden sm:block">COPY TRADING PLATFORM</div></div></a><div class="flex items-center gap-2">'+right+'</div></div></header>';
  },
  navLink(href,label,icon){
    const active=window.location.pathname===href;
    return '<a href="'+href+'" class="sidebar-link'+(active?' active':'')+'">'+icon+'<span>'+label+'</span></a>';
  },
  openSidebar(){
    const s=document.getElementById('sidebar'),o=document.getElementById('sb-ov');
    if(s)s.classList.add('open');
    if(o)o.classList.add('show');
    document.body.style.overflow='hidden';
  },
  closeSidebar(){
    const s=document.getElementById('sidebar'),o=document.getElementById('sb-ov');
    if(s)s.classList.remove('open');
    if(o)o.classList.remove('show');
    document.body.style.overflow='';
  },
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
      +'<img src="/assets/logo-nx-mark-transparent.png" style="height:40px;width:40px;object-fit:contain" alt="Nexora FX">'
      +'<div class="min-w-0 flex-1"><div class="font-extrabold text-xl leading-none">Nexora <span class="text-orange-500">FX</span></div></div>'
      +xbtn+'</div>'
      +'<nav class="flex-1 py-2 overflow-y-auto text-sm">'+nav+'</nav>'
      +'<div class="p-3 border-t border-gray-100"><button onclick="App.logout()" class="sidebar-link w-full" style="color:#EF4444">'+svgIcons.logout+'<span>Sign Out</span></button></div>'
      +'</aside>'
      +'<div class="sidebar-overlay" id="sb-ov" onclick="Components.closeSidebar()"></div>';
  },
};


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
    list.innerHTML=d.notifications.slice(0,8).map(function(n){
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
Components._bellOutside=function(e){
  const dd=document.getElementById('bell-dd');
  const btn=document.getElementById('bell-btn');
  if(dd&&!dd.contains(e.target)&&btn&&!btn.contains(e.target)){dd.style.display='none';}
};
Components.closeBell=function(){const dd=document.getElementById('bell-dd');if(dd)dd.style.display='none';};
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
Components.markAllRead=function(){
  api.readAllNotifications().then(function(){
    App.state.unreadCount=0;
    Components.updateBellBadge();
    Components.closeBell();
    utils.toast('All notifications marked as read','success');
  }).catch(function(){});
};
Components.bottomNav=function(){
  const p=window.location.pathname,n=App.state.unreadCount||0;
  function it(h,lbl,ic,b){
    const badge=b>0?'<span style="position:absolute;top:2px;right:calc(50% - 18px);width:14px;height:14px;background:#FF6A00;color:#fff;border-radius:50%;font-size:8px;display:flex;align-items:center;justify-content:center">'+(b>9?'9+':b)+'</span>':'';
    return '<a href="'+h+'" class="bottom-nav-item'+(p===h?' active':'')+'" style="position:relative">'+ic+badge+'<span>'+lbl+'</span></a>';
  }
  return '<nav class="bottom-nav lg:hidden">'+it('/','Home',svgIcons.home,0)+it('/copy-trade','Copy',svgIcons.copy,0)+it('/deposit','Deposit',svgIcons.deposit,0)+it('/withdraw','Withdraw',svgIcons.withdraw,0)+it('/notifications','Alerts',svgIcons.bell,n)+'</nav>';
};
Components.layout=function(html,title,sub){
  document.getElementById('app').innerHTML=Components.sidebar()+'<div class="with-sidebar">'+Components.appHeader(title,sub)+'<main class="p-4 lg:p-6">'+html+'</main></div>'+Components.bottomNav();
  api.getNotifications().then(function(d){App.state.unreadCount=d.unread_count||0;}).catch(function(){});
};
App.logout=function(){api.clearToken();App.state.user=null;localStorage.removeItem('nx_prev_user_token');document.getElementById('impersonation-banner')?.remove();window.location.href='/';};
