/*
 * pages/schedule.js — Market Holidays: international holiday calendar
 * for major financial markets (when exchanges are closed).
 * Data: backend GET /api/market/holidays (Nager.Date, free source),
 * with a 24h server cache. Public page: no login needed.
 * Key functions:
 * - Pages.schedule() loads the holidays and opens the current month.
 * - Pages._holCountries() lists the countries present in the data.
 * - Pages._holForDay() returns the holidays on one day (with filter).
 * - Pages._renderHol() draws the month grid, day detail and upcoming list.
 * - Pages._holNav() moves to the previous / next month.
 * Rules / gotchas:
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Balances come from GET /api/user/me; showcase accounts
 *   (is_showcase=1) show DISPLAY balances set by the admin.
 * - The ?v= cache version in script tags must be bumped on every
 *   release or browsers may serve stale code.
 */
// Loads the holiday calendar and renders the current month.
// API: direct fetch to /api/market/holidays (not the api helper).
// Shows a loading line first, then the calendar or an error message.
Pages.schedule=async function(){
  var app=document.getElementById('app');
  app.innerHTML='<p class="p-8 text-gray-400">Loading holiday calendar…</p>';
  try{
    const r=await fetch('/api/market/holidays');
    if(!r.ok) throw new Error('Holidays unavailable right now');
    const data=await r.json();
    Pages._holData=data.holidays||[];
    Pages._holFilter='ALL';
    Pages._holSel=null;
    var now=new Date();
    Pages._holY=now.getFullYear(); Pages._holM=now.getMonth();
    Pages._renderHol();
  }catch(e){ app.innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>'; }
};
// Returns the distinct [code, country] pairs in the loaded data,
// sorted by country name, for the country filter dropdown.
Pages._holCountries=function(){
  var seen={}, out=[];
  (Pages._holData||[]).forEach(function(h){ if(!seen[h.code]){ seen[h.code]=1; out.push([h.code,h.country]); } });
  return out.sort(function(a,b){ return a[1]<b[1]?-1:1; });
};
// Returns the holidays on one calendar day (year, month 0-based, day),
// honouring the selected country filter ('ALL' means every country).
Pages._holForDay=function(y,m,d){
// Build an ISO date string (YYYY-MM-DD) to match h.date exactly.
  var ds=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  return (Pages._holData||[]).filter(function(h){
    return h.date===ds && (Pages._holFilter==='ALL' || h.code===Pages._holFilter);
  });
};
// Renders the month grid for the selected month, the selected-day
// detail card, and the next 10 upcoming holidays from today.
Pages._renderHol=function(){
  var y=Pages._holY, m=Pages._holM;
  var monthName=new Date(y,m,1).toLocaleString('en-US',{month:'long',year:'numeric'});
// Weekday of the 1st (0 = Sunday) decides the leading blank cells;
// new Date(y, m+1, 0) gives the last day, i.e. the days in the month.
  var first=new Date(y,m,1).getDay();
  var days=new Date(y,m+1,0).getDate();
  var today=new Date();
  var cells='';
  for(var i=0;i<first;i++) cells+='<div></div>';
  for(var d=1;d<=days;d++){
    var hs=Pages._holForDay(y,m,d);
    var isToday=(y===today.getFullYear()&&m===today.getMonth()&&d===today.getDate());
    var sel=(Pages._holSel===d);
    var dots=hs.slice(0,3).map(function(h){return '<span title="'+h.name+' ('+h.country+')" style="width:7px;height:7px;border-radius:50%;background:#FF6A00;display:inline-block"></span>';}).join('');
    var more=hs.length>3?'<span class="text-[9px] text-orange-600 font-bold">+'+(hs.length-3)+'</span>':'';
    cells+='<div onclick="Pages._holSel='+(sel?'null':d)+';Pages._renderHol()" style="min-height:64px;border:1px solid '+(sel?'#FF6A00':'#F1F5F9')+';border-radius:10px;padding:6px;cursor:pointer;background:'+(isToday?'#FFF7ED':'#fff')+'">'
      +'<div style="font-size:13px;font-weight:'+(isToday?'800':'600')+';color:'+(isToday?'#EA580C':'#0F172A')+'">'+d+'</div>'
      +'<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px;align-items:center">'+dots+more+'</div>'
      +(hs.length?'<div style="font-size:10px;color:#64748B;margin-top:3px;line-height:1.3">'+hs[0].name+'</div>':'')
      +'</div>';
  }
  // Selected day detail
  var selHtml='';
  if(Pages._holSel){
    var sh=Pages._holForDay(y,m,Pages._holSel);
    selHtml='<div class="card mt-4"><h3 class="font-bold text-sm mb-2">'+monthName.split(' ')[0]+' '+Pages._holSel+', '+y+' — holidays</h3>'
      +(sh.length?sh.map(function(h){return '<div class="flex items-center gap-2 py-1.5 text-sm"><span style="width:8px;height:8px;border-radius:50%;background:#FF6A00;display:inline-block"></span><span class="font-semibold">'+h.name+'</span><span class="text-gray-400">· '+h.country+'</span></div>';}).join(''):'<p class="text-sm text-gray-400">No market holiday on this day.</p>')
      +'</div>';
  }
  // Upcoming holidays (from today)
  var tds=new Date(today.getFullYear(),today.getMonth(),today.getDate());
// Upcoming holidays: from today onwards, at most 10, honouring the filter.
  var up=(Pages._holData||[]).filter(function(h){
    var hd=new Date(h.date+'T00:00:00');
    return hd>=tds && (Pages._holFilter==='ALL' || h.code===Pages._holFilter);
  }).slice(0,10);
  var upHtml=up.length?up.map(function(h){
    var hd=new Date(h.date+'T00:00:00');
    var lbl=hd.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
    return '<div class="flex items-center gap-3 py-2.5" style="border-top:1px solid var(--border)"><span style="width:8px;height:8px;border-radius:50%;background:#FF6A00;flex-shrink:0"></span><div class="flex-1 min-w-0"><div class="font-semibold text-sm">'+h.name+'</div><div class="text-xs text-gray-400">'+h.country+'</div></div><span class="text-xs font-semibold text-gray-500 whitespace-nowrap">'+lbl+'</span></div>';
  }).join(''):'<p class="text-sm text-gray-400 py-3">No upcoming holidays.</p>';
  var opts=Pages._holCountries().map(function(c){return '<option value="'+c[0]+'"'+(Pages._holFilter===c[0]?' selected':'')+'>'+c[1]+'</option>';}).join('');
  var _html=`
    <div class="mb-5">
      <h2 class="text-xl font-bold">📅 Market Holidays</h2>
      <p class="text-sm text-gray-500 mt-1">International calendar — public holidays in major financial markets, when exchanges are closed. Tap a day to see its holidays.</p>
    </div>
    <div class="card mb-4">
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <button onclick="Pages._holNav(-1)" class="btn-secondary text-sm" style="width:auto;padding:8px 14px">← Prev</button>
        <span class="font-bold text-base flex-1 text-center">${monthName}</span>
        <button onclick="Pages._holNav(1)" class="btn-secondary text-sm" style="width:auto;padding:8px 14px">Next →</button>
        <select onchange="Pages._holFilter=this.value;Pages._renderHol()" class="text-sm border border-gray-200 rounded-full px-3 py-1.5 bg-white" style="width:auto"><option value="ALL">All countries</option>${opts}</select>
      </div>
      <div class="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-gray-400 mb-1.5"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
      <div class="grid grid-cols-7 gap-1.5">${cells}</div>
    </div>
    ${selHtml}
    <div class="card"><h3 class="font-bold text-base mb-1">Upcoming holidays</h3>${upHtml}</div>
    <p class="text-xs text-gray-400 mt-3">Source: Nager.Date public holidays. Market closures can differ by exchange — check your broker for trading hours on a holiday.</p>
  `;
  if(utils.isLoggedIn()&&App.state.user!==null) Components.layout(_html,'Market Holidays','International calendar');
  else Components.publicLayout(_html);
};
// Moves the calendar one month back (dir -1) or forward (dir +1),
// wrapping the year at January / December. Clears the selected day.
Pages._holNav=function(dir){
  Pages._holM+=dir;
  if(Pages._holM<0){Pages._holM=11;Pages._holY--;}
  if(Pages._holM>11){Pages._holM=0;Pages._holY++;}
  Pages._holSel=null;
  Pages._renderHol();
};
