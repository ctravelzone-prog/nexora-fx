/*
 * admin-forget.js — Password Forget Requests page.
 *
 * Renders /admin/forget-requests: users who asked for password help with
 * just their email. Each request is a ticket with a live chat (user +
 * admin, 3s poll) where the user sends identity documents and the admin
 * verifies them, then generates an OTP that is posted into the chat.
 * Key functions: AdminPages.forgetRequests, AdminPages.viewForgetRequest,
 * AdminPages._genForgetOtp, AdminPages._rejectForget.
 *
 * Gotchas:
 * - The OTP is 8 digits, valid 24 hours, and can log in MANY times until
 *   the user changes their password (then it stops working). Generating
 *   a new OTP invalidates any older one.
 * - No SMTP is involved: the OTP is posted into the ticket chat and also
 *   shown once in a modal to copy.
 * - The chat view is NOT a route: it renders over the list page, and
 *   _activeForgetId blocks the 1s list auto-refresh while it is open
 *   (same pattern as _activeTicketId in admin-tickets.js).
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/forget-requests: users who asked for password help.
  // Data comes from adminApi.getForgetRequests().
AdminPages.forgetRequests=async function(){
  AdminPages._stopForgetPoll();
  try{
    const _gen=AdminApp._gen;
    const rows=await adminApi.getForgetRequests();if(_gen!==AdminApp._gen)return;
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Forget Requests</h2>
    <div class="alert-info mb-4 text-sm">User email diye password help-er ticket khule — ticket-e live chat-e document pathabe, verify kore <strong>Generate OTP</strong> dao. OTP 24 ghonta, password change na howa porjonto bar bar login kora jabe. OTP chat-eo jabe.</div>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>User</th><th>Contact</th><th>Message</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td data-label="User"><div style="text-align:right">${r.full_name} (@${r.username})<div class="text-xs text-gray-400">${r.email}</div></div></td><td data-label="Contact" class="text-sm">${r.contact||'—'}</td><td data-label="Message" class="text-sm max-w-xs">${r.message||'—'}</td><td data-label="Status">${utils.statusBadge(r.status)}</td><td data-label="Date" class="text-xs">${utils.fmtDateTime(r.created_at)}</td><td data-label="Actions"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button onclick="AdminPages.viewForgetRequest(${r.id})" class="btn-secondary text-xs" style="padding:6px 12px;width:auto;white-space:nowrap">Chat</button>${['pending','otp_sent'].includes(r.status)?`<button onclick="AdminPages._genForgetOtp(${r.id})" class="btn-primary text-xs" style="width:auto;padding:6px 12px;white-space:nowrap">Generate OTP</button><button onclick="AdminPages._rejectForget(${r.id})" class="btn-secondary text-xs" style="padding:6px 12px;width:auto;white-space:nowrap">Reject</button>`:'—'}</div></td></tr>`).join('')}
      ${rows.length===0?'<tr><td colspan="6" class="text-center py-8 text-gray-400">No forget requests</td></tr>':''}
    </tbody></table></div>`,'Forget Requests');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Renders one ticket's live chat: user info, message thread, admin reply
// form, Generate OTP (posts the OTP into the chat) and Reject.
// Loads via adminApi.getForgetChat; replies go through adminApi.replyForget.
AdminPages.viewForgetRequest=async function(id){
  AdminPages._stopForgetPoll();
  try{
    const d=await adminApi.getForgetChat(id);
    const r=d.request;
    AdminComponents.layout(`<div class="w-full">
      <div class="flex items-center gap-3 mb-4"><button onclick="AdminPages.forgetRequests()" class="p-2 rounded-lg hover:bg-gray-100">← Forget Requests</button><h2 class="font-bold text-lg flex-1">${r.full_name} (@${r.username})</h2><span id="admin-forget-status-badge">${utils.statusBadge(r.status)}</span><span class="text-xs text-green-600 font-semibold">● Live</span></div>
      <div class="text-xs text-gray-400 mb-4">${r.email}${r.contact?` · ${r.contact}`:''} · ${utils.fmtDateTime(r.created_at)}</div>
      <div class="card mb-4">
        <div id="admin-forget-msgs" class="space-y-4 max-h-96 overflow-y-auto">
          ${AdminPages._forgetMsgsHTML(d.messages)}
        </div>
      </div>
      <div class="card">
        <h3 class="font-bold mb-3">Admin Reply</h3>
        <form id="admin-forget-form" class="space-y-3">
          <textarea id="admin-forget-msg" class="input-field" rows="3" placeholder="Type your reply..." required></textarea>
          <div id="af-err" class="alert-danger hidden"></div>
          <div class="flex gap-3 flex-wrap">
            <button type="submit" id="af-btn" class="btn-primary flex-1">Send Reply</button>
            ${['pending','otp_sent'].includes(r.status)?`<button type="button" onclick="AdminPages._genForgetOtp(${r.id},true)" class="btn-secondary" style="padding:10px 16px">Generate OTP</button><button type="button" onclick="AdminPages._rejectForget(${r.id},true)" class="btn-secondary" style="padding:10px 16px">Reject</button>`:''}
          </div>
        </form>
      </div>
    </div>`,'Forget Request');
    const box=document.getElementById('admin-forget-msgs');if(box)box.scrollTop=box.scrollHeight;
    AdminPages._activeForgetId=id;
    AdminPages._forgetMsgCount=d.messages.length;
    AdminPages._startForgetPoll(id);
    document.getElementById('admin-forget-form').onsubmit=async(e)=>{
      e.preventDefault();const msg=document.getElementById('admin-forget-msg').value,err=document.getElementById('af-err'),btn=document.getElementById('af-btn');
      err.classList.add('hidden');utils.loading(btn,true);
      try{await adminApi.replyForget(id,{message:msg});document.getElementById('admin-forget-msg').value='';utils.loading(btn,false);utils.toast('Reply sent!','success');await AdminPages._refreshForgetMsgs(id,true);}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');utils.loading(btn,false);}
    };
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Renders one ticket's messages. Admin bubbles go right (orange), user
// bubbles go left; document attachments render as a link.
AdminPages._forgetMsgsHTML=function(msgs){return msgs.map(m=>`<div class="flex gap-3 ${m.sender_type==='admin'?'flex-row-reverse':''}">
  <div class="w-8 h-8 rounded-full flex-shrink-0 ${m.sender_type==='admin'?'bg-orange-500 text-white':'bg-gray-200 text-gray-600'} flex items-center justify-center text-xs font-bold">${m.sender_type==='admin'?'A':'U'}</div>
  <div class="max-w-xs ${m.sender_type==='admin'?'bg-orange-50 text-right ml-auto':'bg-gray-50'} rounded-xl p-3">
    ${m.message?`<p class="text-sm">${typeof Pages!=='undefined'&&Pages._escHtml?Pages._escHtml(m.message):m.message}</p>`:''}${m.attachment?`<p class="text-sm"><a href="${m.attachment}" target="_blank" class="text-orange-500 font-semibold">📎 View document</a></p>`:''}<p class="text-xs text-gray-400 mt-1">${utils.fmtDateTime(m.created_at)}</p>
  </div></div>`).join('');};
// Poll tick: reloads one ticket's chat, re-renders only when messages changed.
AdminPages._refreshForgetMsgs=async function(id,forceScroll){
  const box=document.getElementById('admin-forget-msgs');
  if(!box||AdminPages._activeForgetId!==id){AdminPages._stopForgetPoll();return;}
  if(AdminPages._forgetPollBusy)return;AdminPages._forgetPollBusy=true;
  try{
    const d=await adminApi.getForgetChat(id);
    if(!document.getElementById('admin-forget-msgs')||AdminPages._activeForgetId!==id){AdminPages._stopForgetPoll();return;}
    const badge=document.getElementById('admin-forget-status-badge');
    if(badge)badge.innerHTML=utils.statusBadge(d.request.status);
    if(d.messages.length===AdminPages._forgetMsgCount&&!forceScroll){AdminPages._forgetPollBusy=false;return;}
    const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<100;
    box.innerHTML=AdminPages._forgetMsgsHTML(d.messages);
    AdminPages._forgetMsgCount=d.messages.length;
    if(forceScroll||nearBottom)box.scrollTop=box.scrollHeight;
  }catch(e){}
  AdminPages._forgetPollBusy=false;
};
AdminPages._startForgetPoll=function(id){AdminPages._stopForgetPoll();AdminPages._activeForgetId=id;AdminPages._forgetPoll=setInterval(()=>{AdminPages._refreshForgetMsgs(id);},3000);};
AdminPages._stopForgetPoll=function(){if(AdminPages._forgetPoll){clearInterval(AdminPages._forgetPoll);AdminPages._forgetPoll=null;}AdminPages._activeForgetId=null;AdminPages._forgetPollBusy=false;};
// Confirms, then generates a 24-hour OTP via
  // adminApi.generateForgetOtp and shows it once in a modal to copy.
  // The OTP is also posted into the ticket's live chat by the backend.
AdminPages._genForgetOtp=function(id,fromChat){
  utils.confirm('Generate a 24-hour OTP for this user? Any old OTP will stop working. The OTP will also be posted into the ticket chat.',async()=>{
    try{
      const r=await adminApi.generateForgetOtp(id);
      utils.showModal(`<div class="modal text-center"><h2 class="font-bold mb-2">One-Time OTP</h2><p class="text-sm text-gray-400 mb-4">OTP ticket-er chat-eo pathano hoyeche. Copy kore chaile onno kothao pathate paro. OTP sudhu ekbar dekhabe.</p><div class="font-bold mb-4" style="font-size:32px;letter-spacing:6px">${r.otp}</div><p class="text-xs text-gray-400 mb-4">24 ghonta por batil. Password change na howa porjonto bar bar login kora jabe. Eta diye login kore user notun password set korbe.</p><button onclick="utils.closeModal();${fromChat?`AdminPages.viewForgetRequest(${id});`:'AdminPages.forgetRequests();'}" class="btn-primary">Done</button></div>`);
    }catch(e){utils.toast(e.message,'error');}
  },'Generate OTP');
};
// Confirms, then rejects a forget request via adminApi.rejectForgetRequest.
AdminPages._rejectForget=function(id,fromChat){
  utils.confirm('Reject this forget request?',async()=>{
    try{await adminApi.rejectForgetRequest(id);utils.toast('Request rejected','success');AdminPages.forgetRequests();}
    catch(e){utils.toast(e.message,'error');}
  },'Reject');
};
