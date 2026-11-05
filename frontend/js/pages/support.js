// pages/support.js — Support Tickets
Pages.support=async function(){
  Pages._stopTicketPoll();
  try{
    const tickets=await api.getTickets();
    Components.layout(`
      <div class="flex items-center justify-between mb-6"><h2 class="font-bold text-lg">Support Tickets</h2><button onclick="Pages._newTicket()" class="btn-primary" style="width:auto;padding:10px 20px">+ New Ticket</button></div>
      <div class="grid gap-3">
        ${tickets.map(t=>`<div class="card cursor-pointer hover:shadow-md transition-shadow" onclick="Pages._viewTicket(${t.id})"><div class="flex items-start justify-between gap-3"><div><div class="font-semibold">${t.subject}</div><div class="text-sm text-gray-400 mt-1">${utils.fmtDateTime(t.created_at)}</div></div><div class="flex items-center gap-2">${t.priority==='high'?'<span class="pill pill-red text-xs">High</span>':''} ${utils.statusBadge(t.status)}</div></div></div>`).join('')}
        ${tickets.length===0?'<div class="card text-center py-12 text-gray-400">No support tickets yet. Create one if you need help.</div>':''}
      </div>
    `,'Support Tickets','Get help from our support team');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
Pages._newTicket=function(){
  utils.showModal(`<div class="modal"><h2 class="text-lg font-bold mb-4">Create Support Ticket</h2>
    <form id="ticket-form" class="space-y-4">
      <div><label class="input-label">Subject</label><input name="subject" type="text" class="input-field" placeholder="What do you need help with?" required></div>
      <div><label class="input-label">Priority</label><select name="priority" class="input-field"><option value="normal">Normal</option><option value="high">High</option></select></div>
      <div><label class="input-label">Message</label><textarea name="message" class="input-field" rows="4" placeholder="Describe your issue in detail..." required></textarea></div>
      <div id="ticket-err" class="alert-danger hidden"></div>
      <div class="flex gap-3"><button type="button" onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button type="submit" id="ticket-btn" class="btn-primary flex-1">Submit Ticket</button></div>
    </form></div>`);
  document.getElementById('ticket-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,err=document.getElementById('ticket-err'),btn=document.getElementById('ticket-btn');
    utils.loading(btn,true);
    try{await api.createTicket({subject:f.subject.value,message:f.message.value,priority:f.priority.value});utils.closeModal();utils.toast('Ticket created!','success');Pages.support();}
    catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
    utils.loading(btn,false);
  };
};
Pages._stopTicketPoll=function(){if(Pages._ticketPoll){clearInterval(Pages._ticketPoll);Pages._ticketPoll=null;}Pages._activeTicketId=null;Pages._activeTicketStatus=null;Pages._ticketPollBusy=false;};
Pages._ticketMsgsHTML=function(msgs){return msgs.map(m=>`<div class="flex gap-3 ${m.sender_type==='admin'?'flex-row-reverse':''}">
              <div class="w-8 h-8 rounded-full flex-shrink-0 ${m.sender_type==='admin'?'bg-orange-500':'bg-gray-200'} flex items-center justify-center text-xs font-bold ${m.sender_type==='admin'?'text-white':'text-gray-600'}">${m.sender_type==='admin'?'A':'U'}</div>
              <div class="max-w-xs lg:max-w-md ${m.sender_type==='admin'?'bg-orange-50 text-right':'bg-gray-50'} rounded-xl p-3">
                <p class="text-sm">${m.message}</p><p class="text-xs text-gray-400 mt-1">${utils.fmtDateTime(m.created_at)}</p>
              </div></div>`).join('');};
Pages._refreshTicketMsgs=async function(id,forceScroll){
  const box=document.getElementById('ticket-msgs');
  if(!box||Pages._activeTicketId!==id){Pages._stopTicketPoll();return;}
  if(Pages._ticketPollBusy)return;Pages._ticketPollBusy=true;
  try{
    const t=await api.getTicket(id);
    if(!document.getElementById('ticket-msgs')||Pages._activeTicketId!==id){Pages._stopTicketPoll();return;}
    if(t.status==='closed'&&document.getElementById('reply-form')){Pages._viewTicket(id);return;}
    const badge=document.getElementById('ticket-status-badge');
    if(badge&&t.status!==Pages._activeTicketStatus){badge.innerHTML=utils.statusBadge(t.status);Pages._activeTicketStatus=t.status;}
    const html=Pages._ticketMsgsHTML(t.messages);
    if(box.innerHTML!==html){
      const nearBottom=forceScroll||(box.scrollHeight-box.scrollTop-box.clientHeight<120);
      box.innerHTML=html;
      if(nearBottom)box.scrollTop=box.scrollHeight;
    }
  }catch(e){}
  Pages._ticketPollBusy=false;
};
Pages._startTicketPoll=function(id){
  Pages._stopTicketPoll();Pages._activeTicketId=id;
  Pages._ticketPoll=setInterval(()=>{Pages._refreshTicketMsgs(id);},3000);
};
Pages._viewTicket=async function(id){
  Pages._stopTicketPoll();
  try{
    const t=await api.getTicket(id);
    Components.layout(`
      <div class="max-w-2xl">
        <div class="flex items-center gap-3 mb-4"><button onclick="Pages.support()" class="p-2 rounded-lg hover:bg-gray-100">${svgIcons.arrow_left}</button><div><h1 class="font-bold">${t.subject}</h1><div class="flex items-center gap-2 mt-1"><span id="ticket-status-badge">${utils.statusBadge(t.status)}</span><span class="text-xs text-gray-400">${utils.fmtDate(t.created_at)}</span><span class="text-xs text-green-600 font-semibold">\u25cf Live</span></div></div></div>
        <div class="card mb-4">
          <div id="ticket-msgs" class="space-y-4 max-h-96 overflow-y-auto">
            ${Pages._ticketMsgsHTML(t.messages)}
          </div>
        </div>
        ${t.status!=='closed'?`<form id="reply-form" class="card"><label class="input-label">Reply</label><textarea name="message" class="input-field mb-3" rows="3" placeholder="Type your reply..." required></textarea><div id="reply-err" class="alert-danger hidden mb-2"></div><button type="submit" id="reply-btn" class="btn-primary">Send Reply</button></form>`:'<div class="alert-info">This ticket is closed.</div>'}
      </div>
    `,'Support Ticket','');
    const box=document.getElementById('ticket-msgs');if(box)box.scrollTop=box.scrollHeight;
    if(t.status!=='closed')Pages._startTicketPoll(id);
    Pages._activeTicketStatus=t.status;
    if(t.status!=='closed') document.getElementById('reply-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('reply-err'),btn=document.getElementById('reply-btn');
      utils.loading(btn,true);
      try{await api.replyTicket(id,{message:f.message.value});f.message.value='';utils.loading(btn,false);await Pages._refreshTicketMsgs(id,true);}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');utils.loading(btn,false);}
    };
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
