// pages/notifications.js
Pages.notifications=async function(){
  try{
    const data=await api.getNotifications();
    Components.layout(`
      <div class="flex items-center justify-between mb-4"><h2 class="font-bold text-lg">Notifications ${data.unread_count>0?`<span class="badge badge-orange ml-2">${data.unread_count}</span>`:''}</h2>
        <button onclick="api.readAllNotifications().then(()=>{App.state.unreadCount=0;utils.toast('All read','info');Pages.notifications();})" class="btn-secondary text-sm" style="padding:8px 16px">Mark All Read</button></div>
      <div class="grid gap-3">
        ${data.notifications.map(n=>`<div class="card ${!n.is_read?'border-l-4 border-orange-400':''}"><div class="flex items-start gap-3"><div class="w-8 h-8 rounded-full flex-shrink-0 ${n.type==='success'?'bg-green-100 text-green-600':n.type==='warning'?'bg-amber-100 text-amber-600':'bg-blue-100 text-blue-600'} flex items-center justify-center text-sm">${n.type==='success'?'✓':n.type==='warning'?'⚠':'ℹ'}</div><div class="flex-1 min-w-0"><div class="font-semibold text-sm">${n.title}</div><div class="text-xs text-gray-500 mt-0.5">${n.message}</div><div class="text-xs text-gray-300 mt-1">${utils.timeAgo(n.created_at)}</div>${n.action_url?`<a href="${n.action_url}" class="text-xs text-orange-500 font-semibold mt-1 block">${n.action_label||'View →'}</a>`:''}</div>${!n.is_read?'<div class="w-2 h-2 bg-orange-500 rounded-full mt-1"></div>':''}</div></div>`).join('')}
        ${data.notifications.length===0?'<div class="card text-center py-12 text-gray-400">No notifications yet</div>':''}
      </div>`,'Notifications','');
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
