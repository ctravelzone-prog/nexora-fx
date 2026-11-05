// admin-tickets.js — Support Tickets
AdminPages.tickets=async function(){
  AdminPages._stopTicketPoll();
  try{
    const _gen=AdminApp._gen;
    const tickets=await adminApi.getTickets({limit:50});if(_gen!==AdminApp._gen)return;
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Support Tickets</h2>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>ID</th><th>User</th><th>Subject</th><th>Priority</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
      ${tickets.map(t=>`<tr><td>#${t.id}</td><td>${t.full_name} (@${t.username})</td><td class="font-semibold max-w-xs truncate">${t.subject}</td><td>${t.priority==='high'?'<span class="badge badge-red">High</span>':'<span class="badge badge-gray">Normal</span>'}</td><td>${utils.statusBadge(t.status)}</td><td class="text-xs">${utils.fmtDate(t.created_at)}</td><td><button onclick="AdminPages.viewTicket(${t.id})" class="btn-secondary text-xs" style="padding:4px 8px">View</button></td></tr>`).join('')}
      ${tickets.length===0?'<tr><td colspan="7" class="text-center py-8 text-gray-400">No tickets</td></tr>':''}
    </tbody></table></div>`,'Support Tickets');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
AdminPages._stopTicketPoll=function(){if(AdminPages._ticketPoll){clearInterval(AdminPages._ticketPoll);AdminPages._ticketPoll=null;}AdminPages._activeTicketId=null;AdminPages._activeTicketStatus=null;AdminPages._ticketPollBusy=false;};
AdminPages._ticketMsgsHTML=function(msgs){return msgs.map(m=>`<div class="flex gap-3 ${m.sender_type==='admin'?'flex-row-reverse':''}">
            <div class="w-8 h-8 rounded-full flex-shrink-0 ${m.sender_type==='admin'?'bg-orange-500 text-white':'bg-gray-200 text-gray-600'} flex items-center justify-center text-xs font-bold">${m.sender_type==='admin'?'A':'U'}</div>
            <div class="max-w-xs ${m.sender_type==='admin'?'bg-orange-50 text-right ml-auto':'bg-gray-50'} rounded-xl p-3">
              <p class="text-sm">${m.message}</p><p class="text-xs text-gray-400 mt-1">${utils.fmtDateTime(m.created_at)}</p>
            </div></div>`).join('');};
AdminPages._refreshTicketMsgs=async function(id,forceScroll){
  const box=document.getElementById('admin-ticket-msgs');
  if(!box||AdminPages._activeTicketId!==id){AdminPages._stopTicketPoll();return;}
  if(AdminPages._ticketPollBusy)return;AdminPages._ticketPollBusy=true;
  try{
    const t=await adminApi.getTicket(id);
    if(!document.getElementById('admin-ticket-msgs')||AdminPages._activeTicketId!==id){AdminPages._stopTicketPoll();return;}
    const badge=document.getElementById('admin-ticket-status-badge');
    if(badge&&t.status!==AdminPages._activeTicketStatus){badge.innerHTML=utils.statusBadge(t.status);AdminPages._activeTicketStatus=t.status;}
    const html=AdminPages._ticketMsgsHTML(t.messages);
    if(box.innerHTML!==html){
      const nearBottom=forceScroll||(box.scrollHeight-box.scrollTop-box.clientHeight<120);
      box.innerHTML=html;
      if(nearBottom)box.scrollTop=box.scrollHeight;
    }
  }catch(e){}
  AdminPages._ticketPollBusy=false;
};
AdminPages._startTicketPoll=function(id){
  AdminPages._stopTicketPoll();AdminPages._activeTicketId=id;
  AdminPages._ticketPoll=setInterval(()=>{AdminPages._refreshTicketMsgs(id);},3000);
};
AdminPages.viewTicket=async function(id){
  AdminPages._stopTicketPoll();
  try{
    const t=await adminApi.getTicket(id);
    AdminComponents.layout(`<div class="max-w-2xl">
      <div class="flex items-center gap-3 mb-4"><button onclick="AdminPages.tickets()" class="p-2 rounded-lg hover:bg-gray-100">\u2190 Tickets</button><h2 class="font-bold text-lg flex-1">${t.subject}</h2><span id="admin-ticket-status-badge">${utils.statusBadge(t.status)}</span><span class="text-xs text-green-600 font-semibold">\u25cf Live</span></div>
      <div class="card mb-4">
        <div id="admin-ticket-msgs" class="space-y-4 max-h-96 overflow-y-auto">
          ${AdminPages._ticketMsgsHTML(t.messages)}
        </div>
      </div>
      <div class="card">
        <h3 class="font-bold mb-3">Admin Reply</h3>
        <form id="admin-reply-form" class="space-y-3">
          <textarea id="admin-reply-msg" class="input-field" rows="3" placeholder="Type your reply..." required></textarea>
          <div id="ar-err" class="alert-danger hidden"></div>
          <div class="flex gap-3">
            <button type="submit" id="ar-btn" class="btn-primary flex-1">Send Reply</button>
            <button type="button" onclick="adminApi.updateTicketStatus(${t.id},{status:'${t.status==='closed'?'open':'closed'}'}).then(()=>{utils.toast('Status updated','success');AdminPages.viewTicket(${t.id});}).catch(e=>utils.toast(e.message,'error'))" class="btn-secondary" style="padding:10px 16px">${t.status==='closed'?'Reopen':'Close'} Ticket</button>
          </div>
        </form>
      </div>
    </div>`,'Support Ticket');
    const box=document.getElementById('admin-ticket-msgs');if(box)box.scrollTop=box.scrollHeight;
    AdminPages._startTicketPoll(id);
    AdminPages._activeTicketStatus=t.status;
    document.getElementById('admin-reply-form').onsubmit=async(e)=>{
      e.preventDefault();const msg=document.getElementById('admin-reply-msg').value,err=document.getElementById('ar-err'),btn=document.getElementById('ar-btn');
      err.classList.add('hidden');utils.loading(btn,true);
      try{await adminApi.replyTicket(t.id,{message:msg});document.getElementById('admin-reply-msg').value='';utils.loading(btn,false);utils.toast('Reply sent!','success');await AdminPages._refreshTicketMsgs(id,true);}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');utils.loading(btn,false);}
    };
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
