// pages/copyTrade.js — Copy Trade page (screenshot design, real trader data)
Pages.copyTrade=async function(){
  try{
    const traders=await api.getTraders();
    const copies=await api.getMyCopies().catch(()=>[]);
    Pages._ctTraders=traders; Pages._ctCopies=copies;
    Pages._ct={q:'',f:'all',sort:'win',my:false};
    const totalCopied=copies.reduce((a,c)=>a+c.amount_cents,0);
    const rois=traders.map(t=>t.roi_percent||0);
    const roiMin=rois.length?Math.min(...rois):0, roiMax=rois.length?Math.max(...rois):0;
    const roiLabel=roiMin===roiMax?roiMin.toFixed(1)+'%':roiMin.toFixed(1)+'–'+roiMax.toFixed(1)+'%';
    const totalFollowers=traders.reduce((a,t)=>a+(t.followers||0),0);
    const trending=[...traders].sort((a,b)=>(b.roi_percent||0)-(a.roi_percent||0)).slice(0,5);
    const top=[...traders].sort((a,b)=>(b.win_rate||0)-(a.win_rate||0)).slice(0,5);
    Components.layout(`
      <div class="rounded-2xl p-6 mb-6 text-white" style="background:linear-gradient(135deg,#FF6A00,#FF8C33)">
        <h2 class="text-2xl font-bold mb-1">Copy Top Traders</h2>
        <p class="text-orange-100 text-sm mb-4">Mirror their trades automatically. Earn while you sleep.</p>
        <button onclick="document.getElementById('all-traders').scrollIntoView({behavior:'smooth'})" class="text-sm font-bold px-4 py-2 rounded-full mb-5" style="background:#fff;color:#EA580C">Start Copying →</button>
        <div class="grid grid-cols-4 gap-2 text-center">
          <div><div class="font-extrabold text-lg leading-none">${traders.length}</div><div class="text-[10px] tracking-wide text-orange-100 mt-1">TRADERS</div></div>
          <div><div class="font-extrabold text-lg leading-none">${roiLabel}</div><div class="text-[10px] tracking-wide text-orange-100 mt-1">AVG ROI</div></div>
          <div><div class="font-extrabold text-lg leading-none">${totalFollowers.toLocaleString('en-US')}</div><div class="text-[10px] tracking-wide text-orange-100 mt-1">FOLLOWERS</div></div>
          <div><div class="font-extrabold text-lg leading-none">● ${copies.length}</div><div class="text-[10px] tracking-wide text-orange-100 mt-1">COPYING</div></div>
        </div>
      </div>
      ${trending.length?`<div class="mb-6"><div class="text-xs font-bold tracking-wide text-gray-400 mb-2">TRENDING NOW</div><div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width:none">${trending.map(t=>`<button onclick="App.navigate('/trader/${t.id}')" class="flex items-center gap-2 px-3 py-2 rounded-full border border-gray-200 bg-white whitespace-nowrap hover:border-orange-300"><span style="width:22px;height:22px;border-radius:50%;overflow:hidden;display:inline-block">${utils.avatar(t.name,t.avatar,22)}</span><span class="text-sm font-semibold">${t.name}</span><span class="text-xs font-bold text-green-500">+${(t.roi_percent||0).toFixed(1)}%</span></button>`).join('')}</div></div>`:''}
      <div class="alert-warning mb-4 text-sm">⚠️ Risk warning: copying a trader never guarantees profit — loss days can occur. <a href="/risk-terms" class="text-orange-600 font-semibold">Read the Risk Disclosure →</a></div>
      ${top.length?`<h3 class="font-bold text-base mb-3">🏆 Performing traders this week</h3><div class="grid gap-3 mb-8">${top.map((x,i)=>Pages._tCard(x,copies,i+1)).join('')}</div>`:''}
      ${copies.length>0?`<div class="flex items-center justify-between mb-3"><h3 class="font-bold text-base">Your Copies</h3><button onclick="App.navigate('/my-copies')" class="btn-secondary text-sm" style="width:auto;padding:6px 12px">My Copies →</button></div><div class="card mb-8 divide-y divide-gray-100" style="padding:0 16px">${copies.slice(0,5).map(c=>{const p=c.profit_cents||0;return `<div class="flex items-center gap-3 py-3"><span style="width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0">${utils.avatar(c.trader_name,c.trader_avatar,36)}</span><div class="flex-1 min-w-0"><div class="font-semibold text-sm truncate">${c.trader_name} ${c.flag_emoji||''}</div><div class="text-xs text-gray-400">${utils.fmtMoney(c.amount_cents)} invested · ${utils.fmtDate(c.created_at)}</div></div><div class="text-sm font-bold ${p>=0?'text-green-500':'text-red-500'}">${p>=0?'+':''}${utils.fmtMoney(p)}</div></div>`;}).join('')}</div>`:''}
      <div id="all-traders" class="flex items-center justify-between mb-1"><div><h3 class="font-bold text-base">All Traders</h3><p class="text-xs text-gray-400">Pick a trader to start copying</p></div><button id="ct-mybtn" onclick="Pages._ctSet('my',!Pages._ct.my)" class="btn-secondary text-sm" style="width:auto;padding:6px 12px">My Traders</button></div>
      <div class="relative mb-3 mt-3"><span class="absolute left-3 top-1/2" style="transform:translateY(-50%)">🔍</span><input id="ct-search" oninput="Pages._ctSet('q',this.value)" placeholder="Search traders..." class="input-field" style="padding-left:36px" value=""></div>
      <div class="flex items-center gap-2 mb-4 flex-wrap"><div id="ct-pills" class="flex gap-2 flex-wrap">${Pages._ctPills()}</div><select onchange="Pages._ctSet('sort',this.value)" class="ml-auto text-sm border border-gray-200 rounded-full px-3 py-1.5 bg-white" style="width:auto"><option value="win" ${Pages._ct.sort==='win'?'selected':''}>Sort: Win Rate</option><option value="roi" ${Pages._ct.sort==='roi'?'selected':''}>Sort: ROI</option><option value="followers" ${Pages._ct.sort==='followers'?'selected':''}>Sort: Followers</option><option value="new" ${Pages._ct.sort==='new'?'selected':''}>Sort: Newest</option></select></div>
      <div id="ct-all-grid" class="grid gap-4">${Pages._ctList().map(x=>Pages._tCard(x,copies)).join('')||'<p class="text-sm text-gray-400 py-6 text-center">No traders match your search.</p>'}</div>
    `,'Copy Trade','Copy top traders and earn daily profit.');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
Pages._ctPills=function(){
  const pills=[['all','All'],['top','Top'],['low','Low Risk'],['new','New']];
  return pills.map(([k,label])=>`<button onclick="Pages._ctSet('f','${k}')" class="text-sm font-semibold px-4 py-1.5 rounded-full ${Pages._ct.f===k?'text-white':'bg-white border border-gray-200 text-gray-600'}" style="${Pages._ct.f===k?'background:#EA580C':''}">${label}</button>`).join('');
};
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
Pages._ctSet=function(key,val){
  Pages._ct[key]=val;
  const grid=document.getElementById('ct-all-grid');
  if(grid){const list=Pages._ctList();grid.innerHTML=list.map(x=>Pages._tCard(x,Pages._ctCopies)).join('')||'<p class="text-sm text-gray-400 py-6 text-center">No traders match your search.</p>';}
  const pills=document.getElementById('ct-pills');
  if(pills) pills.innerHTML=Pages._ctPills();
  const myBtn=document.getElementById('ct-mybtn');
  if(myBtn){myBtn.style.background=Pages._ct.my?'#EA580C':'';myBtn.style.color=Pages._ct.my?'#fff':'';myBtn.style.borderColor=Pages._ct.my?'#EA580C':'';}
};
Pages._tCard=function(t,copies,rank){
  const medal={1:{bg:'#F59E0B',fg:'#fff'},2:{bg:'#9CA3AF',fg:'#fff'},3:{bg:'#B45309',fg:'#fff'},4:{bg:'#E5E7EB',fg:'#374151'},5:{bg:'#E5E7EB',fg:'#374151'}}[rank]||null;
  const riskBadge={Low:['#ECFDF5','#059669'],Medium:['#FFFBEB','#D97706'],High:['#FEF2F2','#DC2626']}[t.risk_level]||['#F3F4F6','#374151'];
  const copying=copies&&copies.some(c=>c.trader_id===t.id);
  return `<div class="card" style="${rank===1?'border-color:#86EFAC;background:#F0FDF4':''}">
    <div class="flex items-start gap-3 mb-3">
      ${medal?`<span class="flex-shrink-0 font-extrabold text-sm" style="width:26px;height:26px;border-radius:50%;background:${medal.bg};color:${medal.fg};display:grid;place-items:center;margin-top:9px">${rank}</span>`:''}
      <span style="width:44px;height:44px;border-radius:50%;overflow:hidden;flex-shrink:0">${utils.avatar(t.name,t.avatar,44)}</span>
      <div class="flex-1 min-w-0"><div class="flex items-center gap-1.5 font-bold truncate">${t.name} <span>${t.flag_emoji||''}</span>${t.verified?'<span class="text-blue-500 text-sm">✓</span>':''}</div><div class="text-xs text-gray-400 truncate">${t.strategy||''}</div></div>
      <div class="text-right flex-shrink-0"><div class="font-extrabold text-green-500 text-lg leading-none">+${(t.roi_percent||0).toFixed(1)}%</div><div class="text-[11px] text-gray-400 mt-1">ROI</div></div>
    </div>
    <div class="grid grid-cols-4 gap-2 py-3 border-t border-b border-gray-100 text-center mb-3">
      <div><div class="text-[11px] text-gray-400">WIN</div><div class="font-bold text-sm">${(t.win_rate||0).toFixed(1)}%</div></div>
      <div><div class="text-[11px] text-gray-400">DRAWDOWN</div><div class="font-bold text-sm text-red-500">${(t.drawdown||0).toFixed(1)}%</div></div>
      <div><div class="text-[11px] text-gray-400">RISK</div><div class="font-bold text-sm">${t.risk_level||'—'}</div></div>
      <div><div class="text-[11px] text-gray-400">FOLLOWERS</div><div class="font-bold text-sm">${(t.followers||0).toLocaleString('en-US')}</div></div>
    </div>
    <div class="flex items-center justify-between">
      <div class="text-xs text-gray-400">Min: <strong>${utils.fmtMoney(t.min_copy_cents)}</strong>${rank?'':` · <span class="font-semibold px-2 py-0.5 rounded-full" style="background:${riskBadge[0]};color:${riskBadge[1]}">${(t.risk_level||'').toUpperCase()} RISK</span>`}</div>
      <div class="flex gap-2">${copying?'<span class="pill pill-green text-xs self-center">● Copying</span>':''}<button onclick="App.navigate('/trader/${t.id}')" class="btn-secondary text-sm" style="padding:8px 14px">View</button><button onclick="Pages._copyModal(${t.id},'${t.name}',${t.min_copy_cents})" class="btn-primary text-sm" style="width:auto;padding:8px 16px">Copy Now</button></div>
    </div>
  </div>`;
};
Pages._copyModal=async function(tid,name,minC){
  const me=await api.getMe().catch(()=>null),main=me?.balance?.main_cents||0;
  utils.showModal(`<div class="modal"><h2 class="text-lg font-bold mb-2">Copy ${name}</h2><p class="text-sm text-gray-400 mb-4">Main Balance available: ${utils.fmtMoney(main)}</p><label class="input-label">Amount (USD)</label><input id="copy-amt" type="number" step="0.01" min="${minC/100}" class="input-field mb-1"><p class="text-xs text-gray-400 mb-4">Min: ${utils.fmtMoney(minC)}</p><div id="copy-err" class="alert-danger hidden mb-3"></div><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button id="copy-ok" onclick="Pages._doCopy(${tid})" class="btn-primary flex-1">Confirm Copy</button></div></div>`);
};
Pages._doCopy=async function(tid){
  const btn=document.getElementById('copy-ok'),err=document.getElementById('copy-err'),amt=parseFloat(document.getElementById('copy-amt').value);
  if(!amt||amt<=0){err.textContent='Please enter a valid amount';err.classList.remove('hidden');return;}
  utils.loading(btn,true);
  try{await api.startCopy({trader_id:tid,amount:amt});utils.closeModal();utils.toast('Copy started!','success');Pages.copyTrade();}
  catch(e){err.textContent=e.message;err.classList.remove('hidden');utils.loading(btn,false);}
};
Pages.traderDetail=async function(id){
  try{const t=await api.getTrader(id);
    Components.layout(`<div class="max-w-2xl"><div class="flex items-center gap-3 mb-4"><button onclick="App.navigate('/copy-trade')" class="p-2 rounded-lg hover:bg-gray-100">${svgIcons.arrow_left}</button><h1 class="text-xl font-bold flex-1">Trader Detail</h1><button onclick="App.navigate('/copy-trade')" class="btn-secondary text-sm" style="width:auto;padding:8px 16px">← Back to Copy Trade</button></div><div class="card">${Pages._tCard(t,[])}</div></div>`,'Trader Detail','');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
