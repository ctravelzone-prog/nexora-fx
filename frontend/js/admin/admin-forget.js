// admin-forget.js — Password Forget Requests (message to admin) + one-time OTP
AdminPages.forgetRequests=async function(){
  try{
    const _gen=AdminApp._gen;
    const rows=await adminApi.getForgetRequests();if(_gen!==AdminApp._gen)return;
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Forget Requests</h2>
    <div class="alert-info mb-4 text-sm">User message diye password help chaile ekhane request asbe. Kotha bole verify kore <strong>Generate OTP</strong> dao — OTP 24 ghonta, 1 bar use kora jabe. OTP diye login kore user notun password set korbe.</div>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>User</th><th>Contact</th><th>Message</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${r.full_name} (@${r.username})<div class="text-xs text-gray-400">${r.email}</div></td><td class="text-sm">${r.contact||'—'}</td><td class="text-sm max-w-xs">${r.message||'—'}</td><td>${utils.statusBadge(r.status)}</td><td class="text-xs">${utils.fmtDateTime(r.created_at)}</td><td>${['pending','otp_sent'].includes(r.status)?`<button onclick="AdminPages._genForgetOtp(${r.id})" class="btn-primary text-xs mr-1" style="width:auto;padding:6px 12px">Generate OTP</button><button onclick="AdminPages._rejectForget(${r.id})" class="btn-secondary text-xs" style="padding:6px 12px">Reject</button>`:'—'}</td></tr>`).join('')}
      ${rows.length===0?'<tr><td colspan="6" class="text-center py-8 text-gray-400">No forget requests</td></tr>':''}
    </tbody></table></div>`,'Forget Requests');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
AdminPages._genForgetOtp=function(id){
  utils.confirm('Generate a 24-hour one-time OTP for this user? Any old OTP will stop working.',async()=>{
    try{
      const r=await adminApi.generateForgetOtp(id);
      utils.showModal(`<div class="modal text-center"><h2 class="font-bold mb-2">One-Time OTP</h2><p class="text-sm text-gray-400 mb-4">Copy kore user-ke message-e pathao. OTP sudhu ekbar dekhabe.</p><div class="font-bold mb-4" style="font-size:32px;letter-spacing:6px">${r.otp}</div><p class="text-xs text-gray-400 mb-4">24 ghonta por batil, 1 bar use kora jabe. Eta diye login kore user notun password set korbe.</p><button onclick="utils.closeModal();AdminPages.forgetRequests();" class="btn-primary">Done</button></div>`);
    }catch(e){utils.toast(e.message,'error');}
  },'Generate OTP');
};
AdminPages._rejectForget=function(id){
  utils.confirm('Reject this forget request?',async()=>{
    try{await adminApi.rejectForgetRequest(id);utils.toast('Request rejected','success');AdminPages.forgetRequests();}
    catch(e){utils.toast(e.message,'error');}
  },'Reject');
};
