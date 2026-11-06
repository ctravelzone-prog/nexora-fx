/*
 * copyTrade.js — Copy Trade page for Nexora FX.
 *
 * Shows real traders only (no fake numbers): a hero summary, a
 * TRENDING NOW strip, a Top 5 list ranked by win rate, the user's own
 * copies, and a searchable, filterable, sortable list of all traders.
 *
 * Key functions:
 * - Pages.copyTrade — loads traders (api.getTraders) and the user's
 *   copies (api.getMyCopies), then renders the page.
 * - Pages._ctList / Pages._ctSet — filter and sort the trader list
 *   (search text, My Traders, risk, Top/New, win rate / ROI / followers).
 * - Pages._tCard — one trader card, with tier frame and crown badge
 *   for the Top 5, real flag image, ROI, win rate, drawdown and risk.
 * - Pages._copyModal / Pages._doCopy — start copying a trader
 *   (api.getMe for the Main Balance, then api.startCopy).
 * - Pages.traderDetail — single trader page (api.getTrader).
 *
 * Rules: money is integer cents; display via utils.fmtMoney. Copying
 * moves money from Main Balance to Copy Invested. Flags are real
 * flagcdn.com images, mapped from flag emoji in Pages._flagInfo.
 * Gotcha: the ?v= cache version in script tags must be bumped on every
 * release, or browsers may serve stale code.
 */
// Map of flag emoji to flagcdn country code and display name.
Pages._flagInfo={'🇬🇧':{c:'gb',n:'United Kingdom'},'🇺🇸':{c:'us',n:'United States'},'🇧🇷':{c:'br',n:'Brazil'},'🇯🇵':{c:'jp',n:'Japan'},'🇮🇳':{c:'in',n:'India'},'🇧🇩':{c:'bd',n:'Bangladesh'},'🇩🇪':{c:'de',n:'Germany'},'🇫🇷':{c:'fr',n:'France'},'🇦🇺':{c:'au',n:'Australia'},'🇨🇦':{c:'ca',n:'Canada'},'🇦🇪':{c:'ae',n:'UAE'},'🇸🇬':{c:'sg',n:'Singapore'},'🇭🇰':{c:'hk',n:'Hong Kong'},'🇳🇬':{c:'ng',n:'Nigeria'},'🇿🇦':{c:'za',n:'South Africa'},'🇹🇷':{c:'tr',n:'Turkey'},'🇮🇹':{c:'it',n:'Italy'},'🇪🇸':{c:'es',n:'Spain'},'🇳🇱':{c:'nl',n:'Netherlands'},'🇨🇭':{c:'ch',n:'Switzerland'},'🇦🇹':{c:'at',n:'Austria'}};
// Build a real flag image tag for a flag emoji (flagcdn.com).
// Returns an empty string for an unknown emoji.
Pages._flagImg=function(emoji,px,round){var f=Pages._flagInfo[emoji];if(!f)return '';var st=round?('width:'+px+'px;height:'+px+'px;border-radius:50%;object-fit:cover'):('width:'+px+'px;height:auto;border-radius:2px');return '<img src="https://flagcdn.com/w40/'+f.c+'.png" alt="'+f.n+'" style="'+st+'" onerror="this.remove()">';};
// Copy Trade page. Loads traders and the user's copies, computes the
// hero stats and the Trending / Top 5 lists, then renders the page.
Pages.copyTrade=async function(){
  try{
    const traders=await api.getTraders();
    const copies=await api.getMyCopies().catch(()=>[]);
    Pages._ctTraders=traders; Pages._ctCopies=copies;
    Pages._ct={q:'',f:'all',sort:'win',my:false};
    const totalCopied=copies.reduce((a,c)=>a+c.amount_cents,0);
    const totalFollowers=traders.reduce((a,t)=>a+(t.followers||0),0);
    // COPYING on the hero: admin-set copying_count wins (Admin > Traders card);
    // empty or unset falls back to this user's own active copies.
    const _cs=App.state.settings&&App.state.settings.copying_count;
    let copyingShown=copies.length;
    if(_cs!==undefined&&_cs!==null&&String(_cs).trim()!==''){const _n=Number(String(_cs).replace(/,/g,''));if(!isNaN(_n))copyingShown=_n.toLocaleString('en-US');}
    // Trending: top 5 by ROI. Top 5: ranked by win rate, not ROI.
    const trending=[...traders].sort((a,b)=>(b.roi_percent||0)-(a.roi_percent||0)).slice(0,5);
    const top=[...traders].sort((a,b)=>(b.win_rate||0)-(a.win_rate||0)).slice(0,5);
    Components.layout(`
      <div class="rounded-2xl p-6 mb-6 text-white" style="background:linear-gradient(135deg,#FF6A00,#FF8C33)">
        <h2 class="text-2xl font-bold mb-1">Copy Top Traders</h2>
        <p class="text-orange-100 text-sm mb-4">Mirror their trades automatically. Earn while you sleep.</p>
        <button onclick="document.getElementById('all-traders').scrollIntoView({behavior:'smooth'})" class="text-sm font-bold px-4 py-2 rounded-full mb-5" style="background:#fff;color:#EA580C">Start Copying →</button>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div><div class="font-extrabold text-lg leading-none">${traders.length}</div><div class="text-[10px] tracking-wide text-orange-100 mt-1">TRADERS</div></div>
          <div><div class="font-extrabold text-lg leading-none">${totalFollowers.toLocaleString('en-US')}</div><div class="text-[10px] tracking-wide text-orange-100 mt-1">FOLLOWERS</div></div>
          <div><div class="font-extrabold text-lg leading-none">● ${copyingShown}</div><div class="text-[10px] tracking-wide text-orange-100 mt-1">COPYING</div></div>
        </div>
      </div>
      ${trending.length?`<div class="mb-6"><div class="text-sm font-bold mb-2">🔥 TRENDING NOW</div><div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width:none">${trending.map(t=>`<button onclick="App.navigate('/trader/${t.id}')" class="flex items-center gap-2.5 px-3 py-2 rounded-2xl border border-gray-200 bg-white whitespace-nowrap hover:border-orange-300 text-left flex-shrink-0"><span style="width:38px;height:38px;border-radius:50%;overflow:hidden;display:inline-block;flex-shrink:0">${utils.avatar(t.name,t.avatar,38)}</span><span><span class="block text-sm font-bold leading-tight">${t.name}</span><span class="block text-xs font-bold text-green-500">+${(t.roi_percent||0).toFixed(1)}%</span></span></button>`).join('')}</div></div>`:''}
      ${top.length?`<h3 class="font-bold text-base mb-3">🏆 Performing traders this week</h3><div class="grid grid-cols-1 gap-3 mb-8">${top.map((x,i)=>Pages._tCard(x,copies,i+1)).join('')}</div>`:''}
      ${copies.length>0?`<div class="flex items-center justify-between mb-3"><h3 class="font-bold text-base">Your Copies</h3><button onclick="App.navigate('/my-copies')" class="btn-secondary text-sm" style="width:auto;padding:6px 12px">My Copies →</button></div><div class="card mb-8 divide-y divide-gray-100" style="padding:0 16px">${copies.slice(0,5).map(c=>{const p=c.profit_cents||0;return `<div class="flex items-center gap-3 py-3"><span style="width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0">${utils.avatar(c.trader_name,c.trader_avatar,36)}</span><div class="flex-1 min-w-0"><div class="font-semibold text-sm truncate">${c.trader_name} ${c.flag_emoji||''}</div><div class="text-xs text-gray-400">${utils.fmtMoney(c.amount_cents)} invested · ${utils.fmtDate(c.created_at)}</div></div><div class="text-sm font-bold ${p>=0?'text-green-500':'text-red-500'}">${p>=0?'+':''}${utils.fmtMoney(p)}</div></div>`;}).join('')}</div>`:''}
      <div id="all-traders" class="flex items-center justify-between mb-1"><div><h3 class="font-bold text-base">All Traders</h3><p class="text-xs text-gray-400">Pick a trader to start copying</p></div><button id="ct-mybtn" onclick="Pages._ctSet('my',!Pages._ct.my)" class="btn-secondary text-sm" style="width:auto;padding:6px 12px">My Traders</button></div>
      <div class="relative mb-3 mt-3"><span class="absolute left-3 top-1/2" style="transform:translateY(-50%)">🔍</span><input id="ct-search" oninput="Pages._ctSet('q',this.value)" placeholder="Search traders..." class="input-field" style="padding-left:36px" value=""></div>
      <div class="flex items-center gap-2 mb-4 flex-wrap"><div id="ct-pills" class="flex gap-2 flex-wrap">${Pages._ctPills()}</div><select onchange="Pages._ctSet('sort',this.value)" class="ml-auto text-sm border border-gray-200 rounded-full px-3 py-1.5 bg-white" style="width:auto"><option value="win" ${Pages._ct.sort==='win'?'selected':''}>Sort: Win Rate</option><option value="roi" ${Pages._ct.sort==='roi'?'selected':''}>Sort: ROI</option><option value="followers" ${Pages._ct.sort==='followers'?'selected':''}>Sort: Followers</option><option value="new" ${Pages._ct.sort==='new'?'selected':''}>Sort: Newest</option></select></div>
      <div id="ct-all-grid" class="grid grid-cols-1 gap-4">${Pages._ctList().map(x=>Pages._tCard(x,copies)).join('')||'<p class="text-sm text-gray-400 py-6 text-center">No traders match your search.</p>'}</div>
    `,'Copy Trade','Copy top traders and earn daily profit.');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Render the All / Top / Low Risk / New filter pills.
Pages._ctPills=function(){
  const pills=[['all','All'],['top','Top'],['low','Low Risk'],['new','New']];
  return pills.map(([k,label])=>`<button onclick="Pages._ctSet('f','${k}')" class="text-sm font-semibold px-4 py-1.5 rounded-full ${Pages._ct.f===k?'text-white':'bg-white border border-gray-200 text-gray-600'}" style="${Pages._ct.f===k?'background:#EA580C':''}">${label}</button>`).join('');
};
// Apply the current search, filter and sort to the trader list.
Pages._ctList=function(){
  let list=[...(Pages._ctTraders||[])];
  const q=(Pages._ct.q||'').toLowerCase();
  if(q) list=list.filter(t=>(t.name||'').toLowerCase().includes(q));
  if(Pages._ct.my){const ids=new Set((Pages._ctCopies||[]).map(c=>c.trader_id));list=list.filter(t=>ids.has(t.id));}
  if(Pages._ct.f==='low') list=list.filter(t=>t.risk_level==='Low');
  if(Pages._ct.f==='new') list=[...list].sort((a,b)=>b.id-a.id);
  else if(Pages._ct.f==='top') list=[...list].sort((a,b)=>(b.win_rate||0)-(a.win_rate||0));
  if(Pages._ct.sort==='roi') list=[...list].sort((a,b)=>(b.roi_percent||0)-(a.roi_percent||0));
  else if(Pages._ct.sort==='followers') list=[...list].sort((a,b)=>(b.followers||0)-(a.followers||0));
  else if(Pages._ct.sort==='new') list=[...list].sort((a,b)=>b.id-a.id);
  else list=[...list].sort((a,b)=>(b.win_rate||0)-(a.win_rate||0));
  return list;
};
// Update one filter/sort state value, then re-render the trader
// grid, the pills and the My Traders button in place.
Pages._ctSet=function(key,val){
  Pages._ct[key]=val;
  const grid=document.getElementById('ct-all-grid');
  if(grid){const list=Pages._ctList();grid.innerHTML=list.map(x=>Pages._tCard(x,Pages._ctCopies)).join('')||'<p class="text-sm text-gray-400 py-6 text-center">No traders match your search.</p>';}
  const pills=document.getElementById('ct-pills');
  if(pills) pills.innerHTML=Pages._ctPills();
  const myBtn=document.getElementById('ct-mybtn');
  if(myBtn){myBtn.style.background=Pages._ct.my?'#EA580C':'';myBtn.style.color=Pages._ct.my?'#fff':'';myBtn.style.borderColor=Pages._ct.my?'#EA580C':'';}
};
// Render one trader card. Ranks 1-5 get a tier frame and crown badge
// (Platinum, Gold, Silver, Bronze, Emerald); other traders get the
// plain card with a risk badge. Shows real trader data only.
Pages._tCard=function(t,copies,rank){
  const rankStyle={1:{tier:'PLATINUM',c:'#38BDF8',txt:'#fff',frame:'/assets/frames/frame-platinum.png'},2:{tier:'GOLD',c:'#FFB800',txt:'#1F2937',frame:'/assets/frames/frame-gold.png'},3:{tier:'SILVER',c:'#9CA3AF',txt:'#1F2937',frame:'/assets/frames/frame-silver.png'},4:{tier:'BRONZE',c:'#B45309',txt:'#fff',frame:'/assets/frames/frame-bronze.png'},5:{tier:'EMERALD',c:'#059669',txt:'#fff',frame:'/assets/frames/frame-emerald.png'}}[rank]||null;
  const rankBg={1:'border-color:#86EFAC;background:#F0FDF4',2:'border-color:#BFDBFE;background:#EFF6FF',3:'border-color:#FED7AA;background:#FFF7ED'}[rank]||'';
  const riskBadge={Low:['#ECFDF5','#059669'],Medium:['#FFFBEB','#D97706'],High:['#FEF2F2','#DC2626']}[t.risk_level]||['#F3F4F6','#374151'];
  const copying=copies&&copies.some(c=>c.trader_id===t.id);
  const country=(Pages._flagInfo[t.flag_emoji]||{}).n||'';
  const flagBadgeHtml=t.flag_emoji?`<span style="position:absolute;right:0;bottom:0;width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid #E5E7EB;display:grid;place-items:center;z-index:3;box-shadow:0 1px 3px rgba(0,0,0,.2);overflow:hidden">${Pages._flagImg(t.flag_emoji,20,true)}</span>`:'';
  const avatarHtml=rank&&rankStyle?`<div style="position:relative;width:110px;height:110px;flex-shrink:0"><div style="position:absolute;left:50%;top:54.9%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;overflow:hidden">${utils.avatar(t.name,t.avatar,46)}</div><img src="${rankStyle.frame}" style="position:absolute;inset:0;width:110px;height:110px;pointer-events:none;z-index:2" alt="">${flagBadgeHtml}</div>`:`<span style="position:relative;width:44px;height:44px;flex-shrink:0;display:inline-block"><span style="width:44px;height:44px;border-radius:50%;overflow:hidden;display:block">${utils.avatar(t.name,t.avatar,44)}</span>${flagBadgeHtml}</span>`;
  const crownBadge=rank&&rankStyle?`<span class="pill text-xs mt-1" style="background:${rankStyle.c};color:${rankStyle.txt};font-weight:800;letter-spacing:.5px;display:inline-block">👑 ${rankStyle.tier} #${rank}</span>`:'';
  return `<div class="card" style="${rankBg}">
    <div class="flex items-center gap-3 mb-3">
      ${avatarHtml}
      <div class="flex-1 min-w-0"><div class="flex items-center gap-1.5 font-bold truncate">${t.name}${t.verified?'<span class="text-blue-500 text-sm">✓</span>':''}</div>${country?`<div class="text-xs text-gray-500 mt-0.5" style="display:flex;align-items:center;gap:4px">${Pages._flagImg(t.flag_emoji,16,false)}<span>${country}</span></div>`:''}<div class="text-xs text-gray-400 truncate">${t.strategy||''}</div>${crownBadge}</div>
      <div class="text-right flex-shrink-0"><div class="font-extrabold text-green-500 text-lg leading-none">+${(t.roi_percent||0).toFixed(1)}%</div><div class="text-[11px] text-gray-400 mt-1">ROI</div></div>
    </div>
    <div class="grid grid-cols-4 gap-2 py-3 border-t border-b border-gray-100 text-center mb-3">
      <div><div class="text-[11px] text-gray-400">WIN</div><div class="font-bold text-sm">${(t.win_rate||0).toFixed(1)}%</div></div>
      <div><div class="text-[11px] text-gray-400">DRAWDOWN</div><div class="font-bold text-sm text-red-500">${(t.drawdown||0).toFixed(1)}%</div></div>
      <div><div class="text-[11px] text-gray-400">RISK</div><div class="font-bold text-sm">${t.risk_level||'—'}</div></div>
      <div><div class="text-[11px] text-gray-400">FOLLOWERS</div><div class="font-bold text-sm">${(t.followers||0).toLocaleString('en-US')}</div></div>
    </div>
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="text-xs text-gray-400">Min: <strong>${utils.fmtMoney(t.min_copy_cents)}</strong>${rank?'':` · <span class="font-semibold px-2 py-0.5 rounded-full" style="background:${riskBadge[0]};color:${riskBadge[1]}">${(t.risk_level||'').toUpperCase()} RISK</span>`}</div>
      <div class="flex gap-2">${copying?'<span class="pill pill-green text-xs self-center">● Copying</span>':''}<button onclick="App.navigate('/trader/${t.id}')" class="btn-secondary text-sm" style="padding:8px 14px">View</button><button onclick="Pages._copyModal(${t.id},'${t.name}',${t.min_copy_cents})" class="btn-primary text-sm" style="width:auto;padding:8px 16px">Copy Now</button></div>
    </div>
  </div>`;
};
// Copy confirmation modal. Shows the available Main Balance
// (GET /api/user/me) and the trader's minimum copy amount.
Pages._copyModal=async function(tid,name,minC){
  const me=await api.getMe().catch(()=>null),main=me?.balance?.main_cents||0;
  utils.showModal(`<div class="modal"><h2 class="text-lg font-bold mb-2">Copy ${name}</h2><p class="text-sm text-gray-400 mb-4">Main Balance available: ${utils.fmtMoney(main)}</p><label class="input-label">Amount (USD)</label><input id="copy-amt" type="number" step="0.01" min="${minC/100}" class="input-field mb-1"><p class="text-xs text-gray-400 mb-4">Min: ${utils.fmtMoney(minC)}</p><div id="copy-err" class="alert-danger hidden mb-3"></div><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button id="copy-ok" onclick="Pages._doCopy(${tid})" class="btn-primary flex-1">Confirm Copy</button></div></div>`);
};
// Submit a copy: validate the amount, call api.startCopy, then
// reload the Copy Trade page so the new copy appears.
Pages._doCopy=async function(tid){
  const btn=document.getElementById('copy-ok'),err=document.getElementById('copy-err'),amt=parseFloat(document.getElementById('copy-amt').value);
  if(!amt||amt<=0){err.textContent='Please enter a valid amount';err.classList.remove('hidden');return;}
  utils.loading(btn,true);
  try{await api.startCopy({trader_id:tid,amount:amt});utils.closeModal();utils.toast('Copy started!','success');Pages.copyTrade();}
  catch(e){err.textContent=e.message;err.classList.remove('hidden');utils.loading(btn,false);}
};
// Trader detail page. Loads one trader (api.getTrader) and shows
// the same trader card with a back link to Copy Trade.
Pages.traderDetail=async function(id){
  try{const t=await api.getTrader(id);
    Components.layout(`<div class="max-w-2xl"><div class="flex items-center gap-3 mb-4"><button onclick="App.navigate('/copy-trade')" class="p-2 rounded-lg hover:bg-gray-100">${svgIcons.arrow_left}</button><h1 class="text-xl font-bold flex-1">Trader Detail</h1><button onclick="App.navigate('/copy-trade')" class="btn-secondary text-sm" style="width:auto;padding:8px 16px">← Back to Copy Trade</button></div><div class="card">${Pages._tCard(t,[])}</div></div>`,'Trader Detail','');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
