/*
 * admin-notifications.js — Send Notification page.
 *
 * Renders /admin/send-notification: a form to notify All Users or one
 * searched user, with type, title, message and an optional action link.
 * Key functions: AdminPages.sendNotification, AdminPages._searchNotifUser.
 *
 * Gotchas:
 * - For a single user, the admin must search and click a result first; the
 *   chosen user id is stored in a hidden field and the form refuses to send
 *   without it.
 * - Sends through adminApi.sendNotif; the user list search is capped at 5.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/send-notification: target (All Users or one searched
  // user), type, title, message and optional action link. Sends via
  // adminApi.sendNotif.
AdminPages.sendNotification=async function(){
  AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Send Notification</h2>
  <div class="card max-w-lg">
    <form id="notif-form" class="space-y-4">
      <div><label class="input-label">Target</label>
        <select name="target" id="notif-target" class="input-field" onchange="document.getElementById('user-search-row').style.display=this.value==='user'?'block':'none'">
          <option value="all">All Users</option>
          <option value="user">Single User</option>
        </select>
      </div>
      <div id="user-search-row" style="display:none">
        <label class="input-label">Search User</label>
        <div class="flex gap-2">
          <input id="nu-search" type="text" class="input-field flex-1" placeholder="Username or email">
          <button type="button" onclick="AdminPages._searchNotifUser()" class="btn-secondary text-sm" style="padding:10px 16px">Search</button>
        </div>
        <div id="nu-result" class="mt-2"></div>
        <input type="hidden" id="nu-uid" name="user_id">
      </div>
      <div><label class="input-label">Type</label>
        <select name="type" class="input-field">
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="action_required">Action Required</option>
        </select>
      </div>
      <div><label class="input-label">Title</label><input name="title" type="text" class="input-field" required placeholder="Notification title"></div>
      <div><label class="input-label">Message</label><textarea name="message" class="input-field" rows="3" required placeholder="Notification message..."></textarea></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">Action URL (optional)</label><input name="action_url" type="text" class="input-field" placeholder="/deposit"></div>
        <div><label class="input-label">Action Label (optional)</label><input name="action_label" type="text" class="input-field" placeholder="View →"></div>
      </div>
      <div id="notif-err" class="alert-danger hidden"></div>
      <button type="submit" id="notif-btn" class="btn-primary">Send Notification</button>
    </form>
  </div>`,'Send Notification');
  document.getElementById('notif-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,err=document.getElementById('notif-err'),btn=document.getElementById('notif-btn');
    err.classList.add('hidden');utils.loading(btn,true);
    const uid=document.getElementById('nu-uid').value;
    const q=n=>f.querySelector('[name="'+n+'"]').value;
    const payload={title:q('title'),message:q('message'),type:q('type'),action_url:q('action_url')||null,action_label:q('action_label')||null};
    if(q('target')==='user'){if(!uid){err.textContent='Please search and select a user';err.classList.remove('hidden');utils.loading(btn,false);return;}payload.user_id=parseInt(uid);}
    try{await adminApi.sendNotif(payload);utils.toast('Notification sent!','success');f.reset();document.getElementById('user-search-row').style.display='none';document.getElementById('nu-result').innerHTML='';}
    catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
    utils.loading(btn,false);
  };
};
// Searches users by username or email (up to 5 via adminApi.getUsers)
  // and shows clickable results; clicking one stores its id for the send.
AdminPages._searchNotifUser=async function(){
  const q=document.getElementById('nu-search').value.trim();if(!q)return;
  try{const users=await adminApi.getUsers({search:q,limit:5});
    const r=document.getElementById('nu-result');
    if(!users.length){r.innerHTML='<p class="text-sm text-gray-400">No users found</p>';return;}
    r.innerHTML=users.map(u=>`<div class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onclick="document.getElementById('nu-uid').value=${u.id};document.getElementById('nu-result').innerHTML='<div class=\\'card bg-green-50 text-sm\\'>${u.full_name} (@${u.username}) selected ✓</div>';"><div class="font-semibold text-sm">${u.full_name}</div><div class="text-xs text-gray-400">@${u.username}</div></div>`).join('');
  }catch(e){utils.toast(e.message,'error');}
};
