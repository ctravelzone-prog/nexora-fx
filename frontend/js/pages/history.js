// pages/history.js — Transaction history with tabs + dark summary band
Pages.history=async function(){
  try{
    const txns=await api.getTransactions({limit:100});
    const f=utils.fmtMoney;
    const tIn=txns.filter(t=>t.direction==='in').reduce((a,t)=>a+t.amount_cents,0);
    const tOut=txns.filter(t=>t.direction==='out').reduce((a,t)=>a+t.amount_cents,0);
    const tFee=txns.reduce((a,t)=>a+t.fee_cents,0);
    const cats={all:txns,dep:txns.filter(t=>t.type==='deposit'),wd:txns.filter(t=>t.type.startsWith('withdraw')),copy:txns.filter(t=>t.type.startsWith('copy_')),ref:txns.filter(t=>t.type==='referral_commission')};
    const backBtn='<button onclick="history.back()" style="width:36px;height:36px;border:1px solid var(--border);border-radius:10px;background:#fff;cursor:pointer;display:grid;place-items:center">'+svgIcons.arrow_left+'</button>';
    const darkBand='<div style="background:var(--dark2);border-radius:20px;color:#fff;padding:20px 24px;margin-bottom:14px"><small style="font-size:10px;font-weight:800;letter-spacing:1px;color:#94A3B8">TOTAL BALANCE</small><div style="font-size:26px;font-weight:800;margin-top:4px">'+f(tIn-tOut-tFee)+'</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px;border-top:1px solid rgba(255,255,255,.12);padding-top:12px"><div><small style="font-size:10px;font-weight:800;letter-spacing:1px;color:#94A3B8">TOTAL IN</small><b style="font-size:17px;display:block;margin-top:3px;color:#34D399">+'+f(tIn)+'</b></div><div><small style="font-size:10px;font-weight:800;letter-spacing:1px;color:#94A3B8">TOTAL OUT</small><b style="font-size:17px;display:block;margin-top:3px;color:#F87171">-'+f(tOut)+'</b></div><div><small style="font-size:10px;font-weight:800;letter-spacing:1px;color:#94A3B8">FEES</small><b style="font-size:17px;display:block;margin-top:3px;color:#FDBA74">'+f(tFee)+'</b></div></div></div>';
    const tabs='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+Object.entries(cats).map(([k,v],i)=>'<button onclick="Pages._htab(\''+k+'\')" id="htab-'+k+'" style="border:1px solid '+(i===0?'var(--ink)':'var(--border)')+';background:'+(i===0?'var(--ink)':'#fff')+';color:'+(i===0?'#fff':'var(--body)')+';border-radius:999px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">'+k.charAt(0).toUpperCase()+k.slice(1)+' <span style="opacity:.6;font-size:11px">'+v.length+'</span></button>').join('')+'</div>';
    const tbl='<div class="card" style="padding:0;overflow:hidden"><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Fee</th><th>Net</th><th>Status</th><th>Ref</th></tr></thead><tbody id="hist-body">'+Pages._hrows(txns)+'</tbody></table></div></div>';
    const safe=s=>JSON.stringify(s).replace(/'/g,"&#39;");
    const store='<div id="hist-d" style="display:none" data-all=\''+safe(txns)+'\' data-dep=\''+safe(cats.dep)+'\' data-wd=\''+safe(cats.wd)+'\' data-copy=\''+safe(cats.copy)+'\' data-ref=\''+safe(cats.ref)+'\'></div>';
    Components.layout('<div class="flex items-center gap-3 mb-4">'+backBtn+'<div><h1 style="font-size:21px;font-weight:800">Transactions</h1><p style="font-size:13px;color:var(--muted)">Full history</p></div></div>'+darkBand+tabs+tbl+store,'Transactions','');
  }catch(e){document.getElementById('app').innerHTML='<p class="p-8" style="color:var(--red)">'+e.message+'</p>';}
};
Pages._hrows=function(rows){
  if(!rows.length)return'<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">No transactions</td></tr>';
  return rows.map(t=>'<tr><td style="font-size:12px;color:var(--muted);white-space:nowrap">'+utils.fmtDateTime(t.created_at)+'</td><td><b style="color:var(--ink)">'+t.type.replace(/_/g,' ')+'</b></td><td style="font-weight:800;color:'+(t.direction==='in'?'var(--green-d)':'var(--red)')+'">'+( t.direction==='in'?'+':'-')+utils.fmtMoney(t.amount_cents)+'</td><td style="color:var(--muted)">'+utils.fmtMoney(t.fee_cents)+'</td><td style="font-weight:700;color:'+(t.direction==='in'?'var(--green-d)':'var(--red)')+'">'+( t.direction==='in'?'+':'-')+utils.fmtMoney(t.net_cents)+'</td><td>'+utils.statusBadge(t.status)+'</td><td style="font-size:12px;color:var(--muted)">'+( t.reference||'—')+'</td></tr>').join('');
};
Pages._htab=function(k){
  document.querySelectorAll('[id^="htab-"]').forEach(b=>{b.style.background='#fff';b.style.color='var(--body)';b.style.borderColor='var(--border)';});
  const btn=document.getElementById('htab-'+k);
  if(btn){btn.style.background='var(--ink)';btn.style.color='#fff';btn.style.borderColor='var(--ink)';}
  try{const rows=JSON.parse(document.getElementById('hist-d').getAttribute('data-'+k)||'[]');document.getElementById('hist-body').innerHTML=Pages._hrows(rows);}catch(e){}
};
