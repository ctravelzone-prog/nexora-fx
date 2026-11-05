// pages/copyTrade.js — Copy Trade page
Pages.copyTrade=async function(){
  try{
    const traders=await api.getTraders();
    const copies=await api.getMyCopies().catch(()=>[]);
    const totalCopied=copies.reduce((a,c)=>a+c.amount_cents,0);
    Components.layout(`
      <div class="rounded-2xl p-6 mb-6 text-white" style="background:linear-gradient(135deg,#FF6A00,#FF8C33)">
        <h2 class="text-2xl font-bold mb-2">Copy Top Traders — mirror their trades automatically.</h2>
        <p class="text-orange-100 text-sm mb-4">Earn while you sleep. Pick a master trader and every trade is copied to your account.</p>
        <div class="flex flex-wrap gap-2 mt-4">${['124 Traders','7.00–10.4% AVG ROI','$150.5K Copiers','● 712 Live'].map(t=>`<span class="bg-white bg-opacity-20 text-xs font-semibold px-3 py-1 rounded-full">${t}</span>`).join('')}</div>
      </div>
      ${copies.length>0?`<div class="card mb-4 flex items-center justify-between"><div><div class="font-semibold">You are already copying ${copies.length} traders · ${utils.fmtMoney(totalCopied)} invested</div><div class="text-sm text-gray-400">Increase, decrease or stop a copy any time from My Copies.</div></div><button onclick="App.navigate('/my-copies')" class="btn-primary ml-4" style="width:auto;padding:10px 16px">My Copies →</button></div>`:''}
      <div class="alert-warning mb-4 text-sm">⚠️ Risk warning: copying a trader never guarantees profit — loss days can occur. <a href="/risk-terms" class="text-orange-600 font-semibold">Read the Risk Disclosure →</a></div>
      ${(()=>{const top=[...traders].sort((a,b)=>(b.win_rate||0)-(a.win_rate||0)).slice(0,5);const topIds=new Set(top.map(x=>x.id));const rest=traders.filter(x=>!topIds.has(x.id));return `<h3 class="font-bold text-base mb-4">\u{1F3C6} Top 5 Traders \u2014 Highest Win Rate</h3><div class="grid gap-4 mb-8">${top.map((x,i)=>Pages._tCard(x,copies,i+1)).join('')}</div>${rest.length?`<h3 class="font-bold text-base mb-4">Available Traders</h3><div class="grid gap-4">${rest.map(x=>Pages._tCard(x,copies)).join('')}</div>`:''}`;})()}
    `,'Copy Trade','Copy top traders and earn daily profit.');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
Pages._tCard=function(t,copies,rank){
  const rankStyle={1:{tier:'PLATINUM',c:'#38BDF8',crown:'#E0F2FE',txt:'#fff',frame:'/assets/frames/frame-platinum.png'},2:{tier:'GOLD',c:'#FFB800',crown:'#FFD700',txt:'#1F2937',frame:'/assets/frames/frame-gold.png'},3:{tier:'SILVER',c:'#9CA3AF',crown:'#E5E7EB',txt:'#1F2937',frame:'/assets/frames/frame-silver.png'},4:{tier:'BRONZE',c:'#B45309',crown:'#CD7F32',txt:'#fff',frame:'/assets/frames/frame-bronze.png'},5:{tier:'EMERALD',c:'#059669',crown:'#10B981',txt:'#fff',frame:'/assets/frames/frame-emerald.png'}}[rank]||null;
  const topBadge=rank&&rankStyle?`<span class="ml-auto pill text-xs" style="background:${rankStyle.c};color:${rankStyle.txt};font-weight:800;letter-spacing:.5px">${rankStyle.tier} #${rank}</span>`:'';
  const avatarHtml=rank&&rankStyle?`<div style="position:relative;width:110px;height:110px;flex-shrink:0"><div style="position:absolute;left:50%;top:54.9%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;overflow:hidden">${utils.avatar(t.name,t.avatar,46)}</div><img src="${rankStyle.frame}" style="position:absolute;inset:0;width:110px;height:110px;pointer-events:none;z-index:2" alt=""></div>`:utils.avatar(t.name,t.avatar,44);
  const copying=copies&&copies.some(c=>c.trader_id===t.id);
  return `<div class="card"><div class="flex items-center gap-3 mb-3">${avatarHtml}<div><div class="flex items-center gap-2 font-bold">${t.name} <span>${t.flag_emoji||''}</span>${t.verified?'<span class="text-blue-500 text-sm">✓</span>':''}</div><div class="text-xs text-gray-400">${t.strategy||''}</div></div>${copying?'<span class="ml-auto pill pill-green text-xs">● Copying</span>':''}${topBadge}</div><div class="grid grid-cols-4 gap-3 py-3 border-t border-b border-gray-100 text-sm mb-3"><div><div class="text-xs text-gray-400">ROI</div><div class="font-bold text-green-500">+${t.roi_percent.toFixed(1)}%</div></div><div><div class="text-xs text-gray-400">Win Rate</div><div class="font-bold">${t.win_rate.toFixed(1)}%</div></div><div><div class="text-xs text-gray-400">Drawdown</div><div class="font-bold text-red-500">${t.drawdown.toFixed(1)}%</div></div><div><div class="text-xs text-gray-400">Risk</div><div class="font-bold">${t.risk_level}</div></div></div><div class="flex items-center justify-between"><div class="text-xs text-gray-400">Min: <strong>${utils.fmtMoney(t.min_copy_cents)}</strong> · ${t.followers} followers</div><div class="flex gap-2"><button onclick="App.navigate('/trader/${t.id}')" class="btn-secondary text-sm" style="padding:8px 14px">View</button><button onclick="Pages._copyModal(${t.id},'${t.name}',${t.min_copy_cents})" class="btn-primary text-sm" style="width:auto;padding:8px 16px">Copy Now</button></div></div></div>`;
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
    Components.layout(`<div class="max-w-2xl"><div class="flex items-center gap-3 mb-4"><button onclick="App.navigate('/copy-trade')" class="p-2 rounded-lg hover:bg-gray-100">${svgIcons.arrow_left}</button><h1 class="text-xl font-bold flex-1">Trader Detail</h1><button onclick="App.navigate('/copy-trade')" class="btn-secondary text-sm" style="padding:8px 16px">← Back to Copy Trade</button></div><div class="card">${Pages._tCard(t,[])}</div></div>`,'Trader Detail','');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
