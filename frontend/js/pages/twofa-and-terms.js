// twofa-and-terms.js Part 1 — 2FA page + code box helpers
Pages._initCodeRow=function(rowId){
  const row=document.getElementById(rowId);if(!row)return;
  const inputs=[...row.querySelectorAll('.code-box')];
  inputs.forEach((inp,i)=>{
    inp.addEventListener('input',()=>{
      inp.value=inp.value.replace(/\D/g,'').slice(-1);
      inp.classList.toggle('filled',inp.value!=='');
      if(inp.value&&i<inputs.length-1)inputs[i+1].focus();
    });
    inp.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!inp.value&&i>0)inputs[i-1].focus();});
    inp.addEventListener('paste',e=>{
      e.preventDefault();
      const txt=(e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
      txt.split('').forEach((ch,j)=>{if(inputs[i+j]){inputs[i+j].value=ch;inputs[i+j].classList.add('filled');}});
      inputs[Math.min(i+txt.length,inputs.length-1)].focus();
    });
  });
};
Pages._getCode=function(rowId){
  const row=document.getElementById(rowId);if(!row)return'';
  return [...row.querySelectorAll('.code-box')].map(i=>i.value).join('');
};
Pages._codeBoxes=function(id){return'<div class="code-row" id="'+id+'">'+Array(6).fill('<input class="code-box" inputmode="numeric" maxlength="1">').join('')+'</div>';};

Pages.twoFA=async function(){
  try{
    const status=await api.get2FAStatus();
    const card=(html)=>'<div class="card" style="max-width:480px;margin:0 auto">'+html+'</div>';
    let content='';
    if(!status.admin_enabled){
      content=card('<div style="text-align:center;padding:24px 8px"><div style="font-size:48px;margin-bottom:12px">🔒</div><h2 style="font-weight:800;font-size:18px;margin-bottom:8px">2FA is currently disabled by admin</h2><p style="font-size:13px;color:var(--muted);margin-bottom:16px">Two-factor authentication is not available on this platform yet.</p><button style="opacity:.5;cursor:not-allowed;background:linear-gradient(135deg,var(--orange),var(--orange2));color:#fff;border:none;border-radius:10px;padding:10px 24px;font-weight:700;font-size:15px" disabled>Enable 2FA</button></div>');
    } else if(status.user_enabled){
      content=card('<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px"><div style="width:40px;height:40px;border-radius:50%;background:#ECFDF5;color:var(--green-d);display:grid;place-items:center;font-weight:800;font-size:18px">✓</div><div><h2 style="font-weight:800;font-size:17px">2FA Enabled</h2><span class="st st-green">Active</span></div></div><form id="dis2fa"><label style="font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:8px">Enter 6-Digit Code to Disable</label>'+Pages._codeBoxes('dis-code-row')+'<div id="dis-err" style="display:none;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:12px;padding:12px;font-size:13px;color:#991B1B;margin-top:8px"></div><button type="submit" id="dis-btn" style="margin-top:14px;background:#FEF2F2;color:#EF4444;border:1.5px solid #FCA5A5;border-radius:10px;padding:12px 24px;font-weight:700;width:100%;cursor:pointer;font-family:inherit;font-size:15px">Disable 2FA</button></form>');
    } else {
      content=card('<h2 style="font-weight:800;font-size:17px;margin-bottom:8px">Enable Two-Factor Authentication</h2><p style="font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.6">Protect your account with Google Authenticator, Authy, or any TOTP app (RFC 6238). Real TOTP — no demo codes.</p><button onclick="Pages._setup2FA()" style="background:linear-gradient(135deg,var(--orange),var(--orange2));color:#fff;border:none;border-radius:10px;padding:12px 24px;font-weight:700;width:100%;cursor:pointer;font-family:inherit;font-size:15px">Generate QR Code &amp; Setup</button>');
    }
    Components.layout(content,'2FA Security','');
    if(status.admin_enabled&&status.user_enabled){
      Pages._initCodeRow('dis-code-row');
      document.getElementById('dis2fa').onsubmit=async(e)=>{
        e.preventDefault();const code=Pages._getCode('dis-code-row');
        const err=document.getElementById('dis-err'),btn=document.getElementById('dis-btn');
        err.style.display='none';utils.loading(btn,true);
        try{await api.disable2FA({code});utils.toast('2FA disabled','success');Pages.twoFA();}
        catch(ex){err.textContent=ex.message;err.style.display='block';utils.loading(btn,false);}
      };
    }
  }catch(e){document.getElementById('app').innerHTML='<p class="p-8" style="color:var(--red)">'+e.message+'</p>';}

Pages._setup2FA=async function(){
  try{
    const data=await api.setup2FA();
    utils.showModal('<div class="modal">'
      +'<h2 style="font-size:18px;font-weight:800;margin-bottom:12px">Scan QR Code</h2>'
      +'<img src="'+data.qr+'" style="width:192px;height:192px;display:block;margin:0 auto 12px;border:1px solid var(--border);border-radius:14px" alt="2FA QR">'
      +'<p style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:4px">Manual key:</p>'
      +'<code style="display:block;text-align:center;background:var(--bg2);border-radius:10px;padding:10px;font-size:11px;word-break:break-all;margin-bottom:16px">'+data.manual_key+'</code>'
      +'<form id="v2fa"><label style="font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:8px">Enter 6-Digit Code to Verify</label>'
      +Pages._codeBoxes('v2fa-code-row')
      +'<div id="v2fa-err" style="display:none;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:12px;padding:12px;font-size:13px;color:#991B1B;margin-top:10px"></div>'
      +'<div style="display:flex;gap:10px;margin-top:16px">'
        +'<button type="button" onclick="utils.closeModal()" style="flex:1;background:#fff;border:1.5px solid var(--border);border-radius:10px;padding:12px;font-weight:700;cursor:pointer;font-family:inherit">Cancel</button>'
        +'<button type="submit" id="v2fa-btn" style="flex:1;background:linear-gradient(135deg,var(--orange),var(--orange2));color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer;font-family:inherit">Verify &amp; Enable</button>'
      +'</div></form></div>');
    Pages._initCodeRow('v2fa-code-row');
    document.getElementById('v2fa').onsubmit=async(e)=>{
      e.preventDefault();const code=Pages._getCode('v2fa-code-row');
      const err=document.getElementById('v2fa-err'),btn=document.getElementById('v2fa-btn');
      err.style.display='none';utils.loading(btn,true);
      try{await api.verify2FA({code});utils.closeModal();utils.toast('2FA enabled! Save your backup codes.','success');Pages.twoFA();}
      catch(ex){err.textContent=ex.message;err.style.display='block';utils.loading(btn,false);}
    };
  }catch(e){utils.toast(e.message,'error');}
};

Pages.riskTerms=function(){
  const _s=(App.state&&App.state.settings)||{}; const _tp=_s.profit_target_bp?parseInt(_s.profit_target_bp)/100:10;
  Components.layout('<div style="max-width:760px" class="card">'
    +'<h1 style="font-size:22px;font-weight:800;margin-bottom:16px">Risk Disclosure &amp; Terms</h1>'
    +'<h2 style="font-size:17px;font-weight:800;margin-top:16px;margin-bottom:8px">1 · Profit is a target — never guaranteed</h2>'
    +'<p style="font-size:13.5px;color:var(--body);line-height:1.7;margin-bottom:12px">Nexora FX works toward a profit target of <b style="color:var(--ink)">up to '+_tp+'% over 22 profit days</b> on your Copy Invested amount. This is a <b>target, not a promise</b>. No rate, percentage or past result on this platform guarantees future profit.</p>'
    +'<h2 style="font-size:17px;font-weight:800;margin-top:16px;margin-bottom:8px">2 · Loss days and no-profit days</h2>'
    +'<p style="font-size:13.5px;color:var(--body);line-height:1.7;margin-bottom:12px">Loss days can occur — on a loss day your Daily PnL can be negative. Saturday and Sunday: no profit. Markets are closed on weekends, so no Daily PnL is credited on Sat/Sun — those days do not count toward the 22 profit days.</p>'
    +'<h2 style="font-size:17px;font-weight:800;margin-top:16px;margin-bottom:8px">3 · Fee structure</h2>'
    +'<p style="font-size:13.5px;color:var(--body);line-height:1.7;margin-bottom:12px">Main Balance deposits have a 3-month lock. Early withdrawal incurs a 15% fee. Profit Balance withdrawals require a $10.00 minimum with no fee. Referral commissions are one-time, 4% of the referred user\'s first deposit only.</p>'
    +'<h2 style="font-size:17px;font-weight:800;margin-top:16px;margin-bottom:8px">4 · Terms &amp; Conditions</h2>'
    +'<p style="font-size:13.5px;color:var(--body);line-height:1.7">By using Nexora FX you agree to our terms of service. All amounts shown are sample design data. Nexora FX is a UK-based platform.</p>'
    +'</div>','Risk Disclosure &amp; Terms','');
};

};
